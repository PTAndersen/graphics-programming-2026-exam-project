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

vec3 toGold(vec3 baseColor)
{
    float luminance = dot(baseColor, vec3(0.299, 0.587, 0.114));
    
    vec3 goldShadow    = vec3(0.30, 0.20, 0.05);
    vec3 goldMid       = vec3(0.85, 0.65, 0.20);
    vec3 goldHighlight = vec3(1.00, 0.92, 0.55);
    
    vec3 result;
    if (luminance < 0.5)
        result = mix(goldShadow, goldMid, luminance * 2.0);
    else
        result = mix(goldMid, goldHighlight, (luminance - 0.5) * 2.0);
    
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

void main()
{
    // Aspect ratio remap
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
    
    // Card silhouette check
    vec4 mask = texture(MaskTexture, uv);
    float coverage = mask.r + mask.g + mask.b + mask.a;
    if (coverage < 0.01)
    {
        FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    
    // Base color
    vec4 albedo = texture(SourceTexture, uv);
    vec3 baseColor = albedo.rgb;
    
    baseColor = mix(baseColor, vec3(0.10, 0.10, 0.15), mask.b);
    
    // Normal mode
    vec3 normalColor = baseColor;
    
    // Golden mode, per region transformations
    vec3 goldenColor = baseColor;
    goldenColor = mix(goldenColor, toGold(baseColor),          mask.r);
    goldenColor = mix(goldenColor, toSilver(baseColor),        mask.g);
    // Art region (mask.b) keeps the dark slate base color for now
    goldenColor = mix(goldenColor, toAgedParchment(baseColor), mask.a);
    
    // Blend between modes
    vec3 color = mix(normalColor, goldenColor, GoldenMode);
    
    FragColor = vec4(color, 1.0);
}