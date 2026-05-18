//Inputs
in vec2 TexCoord;

//Outputs
out vec4 FragColor;

//Uniforms
uniform sampler2D SourceTexture;
uniform sampler2D MaskTexture;
uniform float GoldenMode;
uniform int DebugMode;
uniform vec2 ScreenSize;
uniform vec2 CardAspectRatio;

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

    vec4 albedo = texture(SourceTexture, uv);
    vec4 mask = texture(MaskTexture, uv);

    vec3 color = albedo.rgb;

    color = mix(color, vec3(1.0, 0.0, 0.0), mask.r * 0.5);
    color = mix(color, vec3(0.0, 1.0, 0.0), mask.g * 0.5);
    color = mix(color, vec3(0.2, 0.2, 0.4), mask.b);
    color = mix(color, vec3(1.0, 1.0, 0.0), mask.a * 0.5);

    FragColor = vec4(color, 1.0);
}