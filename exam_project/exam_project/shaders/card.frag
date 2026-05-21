in vec2 TexCoord;
out vec4 FragColor;

uniform sampler2D SourceTexture;
uniform sampler2D MaskTexture;
uniform float GoldenMode;
uniform vec2 ScreenSize;
uniform vec2 CardAspectRatio;

uniform float Time;
uniform float SheenSpeed;
uniform float SheenWidth;
uniform float SheenIntensity;
uniform float SheenAngleDeg;
uniform float SheenBandOffset;
uniform float EnableSheen;

uniform float GoldSharpness;
uniform float GoldGateCenter;
uniform float GoldHueShift;

uniform float GoldReliefStrength;
uniform float GoldRimStrength;

uniform float GoldFlowStrength;
uniform float GoldFlowSpeed;
uniform float GoldFlowBlobScale;
uniform float GoldFlowDensity;
uniform float EnableFlow;

uniform float GoldFlowStrengthB;
uniform float GoldFlowSpeedB;
uniform float GoldFlowBlobScaleB;
uniform float GoldFlowDensityB;

uniform float SparkleDensity;
uniform float SparkleBrightness;
uniform float SparkleSize;
uniform float SparkleSpeed;
uniform float EnableSparkles;

uniform float PixelSize;
uniform float EnablePixelArt;

uniform float DebugMaskView;

float hash21(vec2 p)
{
    p = fract(p * vec2(443.8975, 397.2973));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
}

float valueNoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 toGold(vec3 baseColor, vec2 uv)
{
    float luminance = dot(baseColor, vec3(0.299, 0.587, 0.114));

    float gateWidth = 0.45 / GoldSharpness;
    float gate = smoothstep(GoldGateCenter, GoldGateCenter + gateWidth, luminance);

    vec3 goldShadow    = vec3(0.20, 0.10, 0.02);
    vec3 goldMid       = vec3(0.95, 0.70, 0.18);
    vec3 goldHighlight = mix(vec3(0.95, 0.80, 0.45),
                             vec3(1.40, 1.30, 1.00),
                             clamp((GoldSharpness - 1.0) / 5.0, 0.0, 1.0));

    float bodyT = clamp(luminance / max(GoldGateCenter, 0.01), 0.0, 1.0);
    vec3 body = mix(goldShadow, goldMid, bodyT);
    vec3 hi = mix(goldMid, goldHighlight, gate);
    vec3 result = mix(body, hi, gate);

    vec3 paleGold = vec3(1.10, 1.05, 0.95);
    result = mix(result, result * paleGold * 0.95 + vec3(0.05, 0.10, 0.20) * GoldHueShift, GoldHueShift);

    return result;
}

vec3 toSilver(vec3 baseColor)
{
    float luminance = dot(baseColor, vec3(0.299, 0.587, 0.114));

    vec3 silverShadow    = vec3(0.20, 0.22, 0.28);
    vec3 silverMid       = vec3(0.70, 0.75, 0.82);
    vec3 silverHighlight = vec3(0.95, 0.97, 1.00);

    vec3 result;
    if (luminance < 0.5)
        result = mix(silverShadow, silverMid, luminance * 2.0);
    else
        result = mix(silverMid, silverHighlight, (luminance - 0.5) * 2.0);

    return result;
}

vec3 toAgedParchment(vec3 baseColor)
{
    vec3 sepia = baseColor * vec3(0.7, 0.55, 0.35);
    return sepia * 0.7;
}

float gaussianBand(float d, float c, float w)
{
    float x = (d - c) / max(w, 1e-4);
    return exp(-x * x);
}

float lumAt(vec2 sampleUv)
{
    vec3 c = texture(SourceTexture, sampleUv).rgb;
    return dot(c, vec3(0.299, 0.587, 0.114));
}

// 4-tap neighbour sampling to avoid 2x2 quad snapping from dFdx/dFdy.
float computeRelief(vec2 uv)
{
    vec2 texel = 1.0 / vec2(textureSize(SourceTexture, 0));

    float lR = lumAt(uv + vec2( texel.x, 0.0));
    float lL = lumAt(uv + vec2(-texel.x, 0.0));
    float lU = lumAt(uv + vec2(0.0,  texel.y));
    float lD = lumAt(uv + vec2(0.0, -texel.y));

    vec2 grad = vec2(lR - lL, lU - lD) * 0.5;

    vec3 fakeNormal = normalize(vec3(-grad * 1000.0, 1.0));
    vec3 lightDir = normalize(vec3(-0.5, 0.7, 0.5));
    return dot(fakeNormal, lightDir);
}

float computeRimWeight(float maskValue)
{
    float w = fwidth(maskValue);
    return clamp(w * 30.0, 0.0, 1.0) * maskValue;
}

// Domain-warped two-octave value noise with density threshold and breathing.
float flowLayer(vec2 uv, float t, float scale, float density)
{
    float s1 = scale;
    float s2 = scale * 2.3;

    float n1 = valueNoise(uv * s1 + vec2( t * 0.13, t * 0.09));
    vec2  warp = vec2(n1 - 0.5) * 0.6;
    float n2 = valueNoise(uv * s2 + warp + vec2(-t * 0.07, t * 0.11));

    float blobs = n1 * 0.7 + n2 * 0.3;

    float lo = mix(0.75, 0.30, density);
    float hi = lo + 0.30;
    float hot = smoothstep(lo, hi, blobs);

    float localPhase = n1 * 6.2831;
    float breathe = 0.5 + 0.5 * sin(t * 1.7 + localPhase);
    hot *= mix(0.6, 1.0, breathe);

    return hot;
}

void computeFlow(vec2 uv, out float hotA, out float hotB)
{
    float tA = Time * GoldFlowSpeed;
    float tB = Time * GoldFlowSpeedB;
    hotA = flowLayer(uv,              tA, GoldFlowBlobScale,  GoldFlowDensity);
    hotB = flowLayer(uv + vec2(17.3), tB, GoldFlowBlobScaleB, GoldFlowDensityB);
}

// Radial dot sparkles on a coarse grid, 3x3 cell scan.
float computeSparkles(vec2 uv)
{
    vec2 aspect = vec2(CardAspectRatio.x / CardAspectRatio.y, 1.0);
    float gridScale = 14.0;
    vec2 gridUv = uv * aspect * gridScale;

    vec2 cell = floor(gridUv);
    vec2 frag = fract(gridUv);

    float total = 0.0;

    for (int oy = -1; oy <= 1; ++oy)
    for (int ox = -1; ox <= 1; ++ox)
    {
        vec2 offset = vec2(float(ox), float(oy));
        vec2 neighbourCell = cell + offset;

        float presence = hash21(neighbourCell + vec2(11.0, 23.0));
        float presenceThreshold = 1.0 - SparkleDensity;
        if (presence < presenceThreshold) continue;

        vec2 jitter = vec2(
            hash21(neighbourCell + vec2(7.0, 19.0)),
            hash21(neighbourCell + vec2(31.0, 41.0))
        );
        vec2 sparkleCenter = offset + jitter;
        vec2 delta = frag - sparkleCenter;

        float phase = hash21(neighbourCell + vec2(53.0, 71.0));
        float lifeT = fract(Time * SparkleSpeed * 0.3 + phase);
        float life = 1.0 - abs(lifeT * 2.0 - 1.0);
        life = pow(life, 2.5);

        float radiusSq = 0.01 * SparkleSize;
        float dot2 = exp(-dot(delta, delta) / radiusSq) * 1.8;

        total += dot2 * life;
    }

    return total;
}

void main()
{
    float screenAspect = ScreenSize.x / ScreenSize.y;
    float cardAspect = CardAspectRatio.x / CardAspectRatio.y;
    vec2 uv = TexCoord;
    if (screenAspect > cardAspect)
    {
        float scale = screenAspect / cardAspect;
        uv.x = (uv.x - 0.5) * scale + 0.5;
    }
    else
    {
        float scale = cardAspect / screenAspect;
        uv.y = (uv.y - 0.5) * scale + 0.5;
    }
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)
    {
        FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // Pixel-art snap. All downstream samples inherit the grid.
    if (EnablePixelArt > 0.5)
    {
        vec2 aspect = vec2(1.0, CardAspectRatio.y / CardAspectRatio.x);
        vec2 gridUv = uv * aspect * PixelSize;
        gridUv = (floor(gridUv) + 0.5) / PixelSize;
        uv = gridUv / aspect;
    }

    vec4 mask = texture(MaskTexture, uv);
    float coverage = mask.r + mask.g + mask.b + mask.a;
    if (coverage < 0.01)
    {
        FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec4 albedo = texture(SourceTexture, uv);
    vec3 baseColor = albedo.rgb;

    baseColor = mix(baseColor, vec3(0.10, 0.10, 0.15), mask.b);

    vec3 normalColor = baseColor;

    vec3 goldColor = toGold(baseColor, uv);

    float relief = computeRelief(uv);
    goldColor *= 1.0 + relief * GoldReliefStrength;

    // Rim: fwidth normally, discrete neighbour check in pixel mode.
    float rimWeight;
    if (EnablePixelArt > 0.5)
    {
        vec2 aspect = vec2(1.0, CardAspectRatio.y / CardAspectRatio.x);
        vec2 texStep = (1.0 / PixelSize) / aspect;

        vec2 uvR = clamp(uv + vec2( texStep.x, 0.0), vec2(0.0), vec2(1.0));
        vec2 uvL = clamp(uv + vec2(-texStep.x, 0.0), vec2(0.0), vec2(1.0));
        vec2 uvU = clamp(uv + vec2(0.0,  texStep.y), vec2(0.0), vec2(1.0));
        vec2 uvD = clamp(uv + vec2(0.0, -texStep.y), vec2(0.0), vec2(1.0));

        vec4 nR = texture(MaskTexture, uvR);
        vec4 nL = texture(MaskTexture, uvL);
        vec4 nU = texture(MaskTexture, uvU);
        vec4 nD = texture(MaskTexture, uvD);

        // Inner edge: neighbouring region is not gold.
        float minNeighbourGold = min(min(nR.r, nL.r), min(nU.r, nD.r));
        float innerEdge = 1.0 - smoothstep(0.3, 0.7, minNeighbourGold);

        // Outer edge: neighbour is outside the card silhouette.
        float covR = nR.r + nR.g + nR.b + nR.a;
        float covL = nL.r + nL.g + nL.b + nL.a;
        float covU = nU.r + nU.g + nU.b + nU.a;
        float covD = nD.r + nD.g + nD.b + nD.a;
        float minNeighbourCoverage = min(min(covR, covL), min(covU, covD));
        float outerEdge = 1.0 - smoothstep(0.05, 0.5, minNeighbourCoverage);

        float edge = max(innerEdge, outerEdge);
        float here = step(0.5, mask.r);
        rimWeight = here * edge;
    }
    else
    {
        rimWeight = computeRimWeight(mask.r);
    }
    vec3 rimColor = vec3(1.20, 0.85, 0.30);
    goldColor += rimColor * rimWeight * GoldRimStrength;

    // Two-layer additive flow, tuned to push peaks into the bloom range.
    float hotA = 0.0;
    float hotB = 0.0;
    computeFlow(uv, hotA, hotB);
    hotA *= EnableFlow;
    hotB *= EnableFlow;

    vec3 flowTintA = vec3(1.25, 1.00, 0.55);
    vec3 flowTintB = vec3(1.40, 1.10, 0.70);
    goldColor += flowTintA * hotA * GoldFlowStrength;
    goldColor += flowTintB * hotB * GoldFlowStrengthB;

    float blob = hotA + hotB;

    vec3 goldenColor = baseColor;
    goldenColor = mix(goldenColor, goldColor,                  mask.r);
    goldenColor = mix(goldenColor, toSilver(baseColor),        mask.g);
    goldenColor = mix(goldenColor, toAgedParchment(baseColor), mask.a);

    float sparkleMask = clamp(mask.r + mask.g, 0.0, 1.0);
    float sparkles = computeSparkles(uv) * sparkleMask * EnableSparkles;
    vec3 sparkleTint = vec3(1.10, 1.05, 0.90);
    goldenColor += sparkleTint * sparkles * SparkleBrightness;

    // Sheen sweep, boosted by flow hotspots.
    float angleRad = radians(SheenAngleDeg);
    vec2 sweepDir = vec2(cos(angleRad), sin(angleRad));
    float d = dot(uv - vec2(0.5), sweepDir);

    float sweepHalfRange = 0.71 + SheenWidth * 2.0;
    float phase = mod(Time * SheenSpeed, 2.0 * sweepHalfRange) - sweepHalfRange;

    float band1 = gaussianBand(d, phase,                    SheenWidth);
    float band2 = gaussianBand(d, phase + SheenBandOffset,  SheenWidth * 0.7) * 0.5;
    float sheen = (band1 + band2) * SheenIntensity;

    float metalMask = clamp(mask.r + mask.g, 0.0, 1.0);
    float sheenBoost = 1.0 + blob * 2.0 * mask.r * EnableFlow;
    vec3 sheenTint = mix(vec3(1.0), goldenColor, 0.25) * sheenBoost;
    goldenColor += sheen * metalMask * sheenTint * GoldenMode * EnableSheen;

    vec3 color = mix(normalColor, goldenColor, GoldenMode);

    if (DebugMaskView > 0.5)
    {
        vec3 tint = vec3(1.0);
        tint = mix(tint, vec3(1.0, 0.2, 0.2), mask.r);
        tint = mix(tint, vec3(0.2, 1.0, 0.2), mask.g);
        tint = mix(tint, vec3(0.2, 0.2, 1.0), mask.b);
        tint = mix(tint, vec3(1.0, 1.0, 0.2), mask.a);
        color *= tint;
    }

    FragColor = vec4(color, 1.0);
}