//Inputs
in vec2 TexCoord;

//Outputs
out vec4 FragColor;

//Uniforms
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
uniform float GoldAnisotropy;
uniform float GoldHueShift;

uniform float GoldReliefStrength;
uniform float GoldRimStrength;
uniform float GoldGlintDensity;
uniform float GoldGlintBrightness;

uniform float GoldFlowStrength;
uniform float GoldFlowSpeed;
uniform float GoldFlowBlobScale;
uniform float EnableFlow;

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

    float gate = smoothstep(0.55, 0.55 + 0.35 / GoldSharpness, luminance);

    vec3 goldShadow    = vec3(0.20, 0.10, 0.02);
    vec3 goldMid       = vec3(0.95, 0.70, 0.18);
    vec3 goldHighlight = vec3(1.00, 0.95, 0.70);

    float bodyT = clamp(luminance / 0.55, 0.0, 1.0);
    vec3 body = mix(goldShadow, goldMid, bodyT);
    vec3 hi = mix(goldMid, goldHighlight, gate);
    vec3 result = mix(body, hi, gate);

    vec2 grain = vec2(dFdx(luminance), dFdy(luminance));
    vec2 streakDir = normalize(vec2(0.7, 0.7));
    float streak = clamp(abs(dot(grain, streakDir)) * 80.0, 0.0, 1.0);
    float streakWeight = smoothstep(0.4, 0.9, luminance) * GoldAnisotropy;
    result += vec3(0.35, 0.28, 0.10) * streak * streakWeight;

    vec3 warmWhite = vec3(1.00, 0.96, 0.88);
    result = mix(result, mix(result, warmWhite, gate * 0.6), GoldHueShift);

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

float computeGlints(vec2 uv, float gateValue)
{
    vec2 sampleUv = uv * 800.0 + vec2(Time * 0.5, Time * 0.3);
    float n = hash21(floor(sampleUv));
    float threshold = 1.0 - 0.05 * GoldGlintDensity;
    float glint = smoothstep(threshold, threshold + 0.01, n);
    return glint * gateValue;
}

float computeFlow(vec2 uv, out float blobOut)
{
    float t = Time * GoldFlowSpeed;

    float s1 = GoldFlowBlobScale;
    float s2 = GoldFlowBlobScale * 1.7;
    float n1 = valueNoise(uv * s1 + vec2( t * 0.10, t * 0.07));
    float n2 = valueNoise(uv * s2 + vec2(-t * 0.06, t * 0.09));
    float blobs = (n1 * 0.6 + n2 * 0.4);
    float blobsCentered = (blobs - 0.5) * 0.20;

    float breathe = sin(t * 1.3) * 0.02;

    blobOut = blobsCentered;
    return 1.0 + (blobsCentered + breathe) * GoldFlowStrength;
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
    float reliefMul = 1.0 + relief * GoldReliefStrength;
    goldColor *= reliefMul;

    float rimWeight = computeRimWeight(mask.r);
    vec3 rimColor = vec3(1.20, 0.85, 0.30);
    goldColor += rimColor * rimWeight * GoldRimStrength;

    float goldLum = dot(goldColor, vec3(0.299, 0.587, 0.114));
    float glintGate = smoothstep(0.5, 1.0, goldLum);
    float glints = computeGlints(uv, glintGate);
    goldColor += vec3(1.0, 0.9, 0.6) * glints * GoldGlintBrightness;

    float blob = 0.0;
    float flowMul = mix(1.0, computeFlow(uv, blob), EnableFlow);
    goldColor *= flowMul;

    vec3 goldenColor = baseColor;
    goldenColor = mix(goldenColor, goldColor,                  mask.r);
    goldenColor = mix(goldenColor, toSilver(baseColor),        mask.g);
    goldenColor = mix(goldenColor, toAgedParchment(baseColor), mask.a);

    float angleRad = radians(SheenAngleDeg);
    vec2 sweepDir = vec2(cos(angleRad), sin(angleRad));
    float d = dot(uv - vec2(0.5), sweepDir);

    float sweepHalfRange = 0.71 + SheenWidth * 2.0;
    float phase = mod(Time * SheenSpeed, 2.0 * sweepHalfRange) - sweepHalfRange;

    float band1 = gaussianBand(d, phase,                    SheenWidth);
    float band2 = gaussianBand(d, phase + SheenBandOffset,  SheenWidth * 0.7) * 0.5;
    float sheen = (band1 + band2) * SheenIntensity;

    float metalMask = clamp(mask.r + mask.g, 0.0, 1.0);
    float sheenBoost = 1.0 + blob * 6.0 * mask.r * EnableFlow;
    vec3 sheenTint = mix(vec3(1.0), goldenColor, 0.25) * sheenBoost;
    vec3 sheenContribution = sheen * metalMask * sheenTint * GoldenMode * EnableSheen;

    goldenColor += sheenContribution;

    vec3 color = mix(normalColor, goldenColor, GoldenMode);

    FragColor = vec4(color, 1.0);
}
