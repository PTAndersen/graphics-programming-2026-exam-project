#include "CardViewerApplication.h"

#include <ituGL/asset/ShaderLoader.h>
#include <ituGL/asset/Texture2DLoader.h>

#include <ituGL/shader/Material.h>
#include <ituGL/shader/ShaderProgram.h>

#include <ituGL/renderer/PostFXRenderPass.h>

#include <ituGL/texture/Texture2DObject.h>

#include <imgui.h>

CardViewerApplication::CardViewerApplication()
    : Application(1024, 1024, "Card Viewer")
    , m_renderer(GetDevice())
    , m_sceneFramebuffer(std::make_shared<FramebufferObject>())
    , m_debugMaskView(false)
    , m_goldenMode(false)
    , m_enableSheen(true)
    , m_exposure(1.0f)
    , m_contrast(1.0f)
    , m_hueShift(0.0f)
    , m_saturation(1.0f)
    , m_colorFilter(1.0f)
    , m_blurIterations(1)
    , m_bloomRange(1.0f, 2.0f)
    , m_bloomIntensity(1.0f)
    , m_sheenIntensity(0.2f)
    , m_sheenWidth(0.05f)
    , m_sheenSpeed(0.2f)
    , m_sheenAngleDeg(70.0f)
    , m_sheenBandOffset(0.18f)
    , m_goldSharpness(2.5f)
    , m_goldGateCenter(0.25f)
    , m_goldHueShift(0.0f)
    , m_goldReliefStrength(0.4f)
    , m_goldRimStrength(0.8f)
    , m_enableFlow(true)
    , m_goldFlowStrength(0.15f)
    , m_goldFlowSpeed(3.0f)
    , m_goldFlowBlobScale(10.0f)
    , m_goldFlowDensity(0.6f)
    , m_goldFlowStrengthB(0.5f)
    , m_goldFlowBlobScaleB(12.5f)
    , m_goldFlowDensityB(0.5f)
    , m_goldFlowSpeedB(1.1f)
    , m_sparkleDensity(0.4f)
    , m_sparkleBrightness(0.3f)
    , m_sparkleSize(0.3f)
    , m_sparkleSpeed(1.2f)
    , m_enableSparkles(true)
    , m_pixelSize(100.0f)
    , m_enablePixelArt(false)
{
}

void CardViewerApplication::Initialize()
{
    Application::Initialize();

    glfwSetWindowAttrib(GetMainWindow().GetInternalWindow(), GLFW_RESIZABLE, GLFW_FALSE);

    // Initialize DearImGUI
    m_imGui.Initialize(GetMainWindow());

    InitializeCamera();
    InitializeRenderer();
}

void CardViewerApplication::Update()
{
    Application::Update();
    m_renderer.SetCurrentCamera(*m_camera);

    int width, height;
    GetMainWindow().GetDimensions(width, height);
    m_cardMaterial->SetUniformValue("ScreenSize", glm::vec2((float)width, (float)height));
    m_cardMaterial->SetUniformValue("Time", (float)glfwGetTime());
}

void CardViewerApplication::Render()
{
    Application::Render();

    GetDevice().Clear(true, Color(0.0f, 0.0f, 0.0f, 1.0f), true, 1.0f);

    // Render the card and post-processing chain
    m_renderer.Render();

    // Render the debug user interface
    RenderGUI();
}

void CardViewerApplication::Cleanup()
{
    m_imGui.Cleanup();
    Application::Cleanup();
}

void CardViewerApplication::InitializeCard()
{
    Texture2DLoader maskLoader(TextureObject::FormatRGBA, TextureObject::InternalFormatRGBA);
    maskLoader.SetFlipVertical(true);
    m_cardMaskTexture = maskLoader.LoadShared("textures/card_mask.png");

    Texture2DLoader albedoLoader(TextureObject::FormatRGBA, TextureObject::InternalFormatSRGBA8);
    albedoLoader.SetFlipVertical(true);
    m_cardAlbedoTexture = albedoLoader.LoadShared("textures/card_albedo.png");

    m_cardMaterial = CreatePostFXMaterial("shaders/card.frag", m_cardAlbedoTexture);
    m_cardMaterial->SetUniformValue("MaskTexture", m_cardMaskTexture);
    m_cardMaterial->SetUniformValue("DebugMaskView", m_debugMaskView ? 1.0f : 0.0f);
    m_cardMaterial->SetUniformValue("GoldenMode", m_goldenMode ? 1.0f : 0.0f);
    m_cardMaterial->SetUniformValue("EnableSheen",      m_enableSheen      ? 1.0f : 0.0f);
    m_cardMaterial->SetUniformValue("CardAspectRatio", glm::vec2(1589.0f, 2361.0f));

    int width, height;
    GetMainWindow().GetDimensions(width, height);
    m_cardMaterial->SetUniformValue("ScreenSize", glm::vec2((float)width, (float)height));

    m_cardMaterial->SetUniformValue("Time", 0.0f);
    m_cardMaterial->SetUniformValue("SheenSpeed", m_sheenSpeed);
    m_cardMaterial->SetUniformValue("SheenWidth", m_sheenWidth);
    m_cardMaterial->SetUniformValue("SheenIntensity", m_sheenIntensity);
    m_cardMaterial->SetUniformValue("SheenAngleDeg", m_sheenAngleDeg);
    m_cardMaterial->SetUniformValue("SheenBandOffset", m_sheenBandOffset);
    m_cardMaterial->SetUniformValue("GoldSharpness", m_goldSharpness);
    m_cardMaterial->SetUniformValue("GoldGateCenter", m_goldGateCenter);
    m_cardMaterial->SetUniformValue("GoldHueShift", m_goldHueShift);

    m_cardMaterial->SetUniformValue("GoldReliefStrength", m_goldReliefStrength);
    m_cardMaterial->SetUniformValue("GoldRimStrength", m_goldRimStrength);

    m_cardMaterial->SetUniformValue("EnableFlow", m_enableFlow ? 1.0f : 0.0f);
    m_cardMaterial->SetUniformValue("GoldFlowStrength", m_goldFlowStrength);
    m_cardMaterial->SetUniformValue("GoldFlowSpeed", m_goldFlowSpeed);
    m_cardMaterial->SetUniformValue("GoldFlowBlobScale", m_goldFlowBlobScale);
    m_cardMaterial->SetUniformValue("GoldFlowDensity", m_goldFlowDensity);

    m_cardMaterial->SetUniformValue("GoldFlowStrengthB", m_goldFlowStrengthB);
    m_cardMaterial->SetUniformValue("GoldFlowBlobScaleB", m_goldFlowBlobScaleB);
    m_cardMaterial->SetUniformValue("GoldFlowDensityB", m_goldFlowDensityB);
    m_cardMaterial->SetUniformValue("GoldFlowSpeedB", m_goldFlowSpeedB);

    m_cardMaterial->SetUniformValue("SparkleDensity", m_sparkleDensity);
    m_cardMaterial->SetUniformValue("SparkleBrightness", m_sparkleBrightness);
    m_cardMaterial->SetUniformValue("SparkleSize", m_sparkleSize);
    m_cardMaterial->SetUniformValue("SparkleSpeed", m_sparkleSpeed);
    m_cardMaterial->SetUniformValue("EnableSparkles", m_enableSparkles ? 1.0f : 0.0f);

    m_cardMaterial->SetUniformValue("PixelSize", m_pixelSize);
    m_cardMaterial->SetUniformValue("EnablePixelArt", m_enablePixelArt ? 1.0f : 0.0f);
}

void CardViewerApplication::InitializeCamera()
{
    m_camera = std::make_shared<Camera>();
    m_camera->SetViewMatrix(glm::vec3(0, 0, 1), glm::vec3(0, 0, 0), glm::vec3(0, 1, 0));
    m_camera->SetPerspectiveProjectionMatrix(1.0f, 1.0f, 0.1f, 100.0f);

    m_renderer.SetCurrentCamera(*m_camera);
}

void CardViewerApplication::InitializeFramebuffers()
{
    int width, height;
    GetMainWindow().GetDimensions(width, height);

    // Scene texture
    m_sceneTexture = std::make_shared<Texture2DObject>();
    m_sceneTexture->Bind();
    m_sceneTexture->SetImage(0, width, height, TextureObject::FormatRGBA, TextureObject::InternalFormat::InternalFormatRGBA16F);
    m_sceneTexture->SetParameter(TextureObject::ParameterEnum::MinFilter, GL_LINEAR);
    m_sceneTexture->SetParameter(TextureObject::ParameterEnum::MagFilter, GL_LINEAR);
    Texture2DObject::Unbind();

    // Scene framebuffer
    m_sceneFramebuffer->Bind();
    m_sceneFramebuffer->SetTexture(FramebufferObject::Target::Draw, FramebufferObject::Attachment::Color0, *m_sceneTexture);
    m_sceneFramebuffer->SetDrawBuffers(std::array<FramebufferObject::Attachment, 1>({ FramebufferObject::Attachment::Color0 }));
    FramebufferObject::Unbind();

    // Temporary textures and framebuffers (for bloom + blur)
    for (int i = 0; i < m_tempFramebuffers.size(); ++i)
    {
        m_tempTextures[i] = std::make_shared<Texture2DObject>();
        m_tempTextures[i]->Bind();
        m_tempTextures[i]->SetImage(0, width, height, TextureObject::FormatRGBA, TextureObject::InternalFormat::InternalFormatRGBA16F);
        m_tempTextures[i]->SetParameter(TextureObject::ParameterEnum::WrapS, GL_CLAMP_TO_EDGE);
        m_tempTextures[i]->SetParameter(TextureObject::ParameterEnum::WrapT, GL_CLAMP_TO_EDGE);
        m_tempTextures[i]->SetParameter(TextureObject::ParameterEnum::MinFilter, GL_LINEAR);
        m_tempTextures[i]->SetParameter(TextureObject::ParameterEnum::MagFilter, GL_LINEAR);

        m_tempFramebuffers[i] = std::make_shared<FramebufferObject>();
        m_tempFramebuffers[i]->Bind();
        m_tempFramebuffers[i]->SetTexture(FramebufferObject::Target::Draw, FramebufferObject::Attachment::Color0, *m_tempTextures[i]);
        m_tempFramebuffers[i]->SetDrawBuffers(std::array<FramebufferObject::Attachment, 1>({ FramebufferObject::Attachment::Color0 }));
    }
    Texture2DObject::Unbind();
    FramebufferObject::Unbind();
}

void CardViewerApplication::InitializeRenderer()
{
    int width, height;
    GetMainWindow().GetDimensions(width, height);

    // Initialize the framebuffers and textures
    InitializeFramebuffers();

    // Card pass: renders the card into m_sceneFramebuffer
    InitializeCard();
    m_renderer.AddRenderPass(std::make_unique<PostFXRenderPass>(m_cardMaterial, m_sceneFramebuffer));

    // Bloom pass
    m_bloomMaterial = CreatePostFXMaterial("shaders/postfx/bloom.frag", m_sceneTexture);
    m_bloomMaterial->SetUniformValue("Range", m_bloomRange);
    m_bloomMaterial->SetUniformValue("Intensity", m_bloomIntensity);
    m_renderer.AddRenderPass(std::make_unique<PostFXRenderPass>(m_bloomMaterial, m_tempFramebuffers[0]));

    // Blur passes
    std::shared_ptr<Material> blurHorizontalMaterial = CreatePostFXMaterial("shaders/postfx/blur.frag", m_tempTextures[0]);
    blurHorizontalMaterial->SetUniformValue("Scale", glm::vec2(1.0f / width, 0.0f));
    std::shared_ptr<Material> blurVerticalMaterial = CreatePostFXMaterial("shaders/postfx/blur.frag", m_tempTextures[1]);
    blurVerticalMaterial->SetUniformValue("Scale", glm::vec2(0.0f, 1.0f / height));
    for (int i = 0; i < m_blurIterations; ++i)
    {
        m_renderer.AddRenderPass(std::make_unique<PostFXRenderPass>(blurHorizontalMaterial, m_tempFramebuffers[1]));
        m_renderer.AddRenderPass(std::make_unique<PostFXRenderPass>(blurVerticalMaterial, m_tempFramebuffers[0]));
    }

    // Final compose pass: scene + bloom, tone mapping, color grading, written to default framebuffer
    m_composeMaterial = CreatePostFXMaterial("shaders/postfx/compose.frag", m_sceneTexture);
    m_composeMaterial->SetUniformValue("Exposure", m_exposure);
    m_composeMaterial->SetUniformValue("Contrast", m_contrast);
    m_composeMaterial->SetUniformValue("HueShift", m_hueShift);
    m_composeMaterial->SetUniformValue("Saturation", m_saturation);
    m_composeMaterial->SetUniformValue("ColorFilter", m_colorFilter);
    m_composeMaterial->SetUniformValue("BloomTexture", m_tempTextures[0]);
    m_renderer.AddRenderPass(std::make_unique<PostFXRenderPass>(m_composeMaterial, m_renderer.GetDefaultFramebuffer()));
}

std::shared_ptr<Material> CardViewerApplication::CreatePostFXMaterial(const char* fragmentShaderPath, std::shared_ptr<Texture2DObject> sourceTexture)
{
    std::vector<const char*> vertexShaderPaths;
    vertexShaderPaths.push_back("shaders/version330.glsl");
    vertexShaderPaths.push_back("shaders/renderer/fullscreen.vert");
    Shader vertexShader = ShaderLoader(Shader::VertexShader).Load(vertexShaderPaths);

    std::vector<const char*> fragmentShaderPaths;
    fragmentShaderPaths.push_back("shaders/version330.glsl");
    fragmentShaderPaths.push_back("shaders/utils.glsl");
    fragmentShaderPaths.push_back(fragmentShaderPath);
    Shader fragmentShader = ShaderLoader(Shader::FragmentShader).Load(fragmentShaderPaths);

    std::shared_ptr<ShaderProgram> shaderProgramPtr = std::make_shared<ShaderProgram>();
    shaderProgramPtr->Build(vertexShader, fragmentShader);

    std::shared_ptr<Material> material = std::make_shared<Material>(shaderProgramPtr);
    if (sourceTexture)
    {
        material->SetUniformValue("SourceTexture", sourceTexture);
    }
    return material;
}

void CardViewerApplication::RenderGUI()
{
    m_imGui.BeginFrame();

    if (auto window = m_imGui.UseWindow("Card"))
    {
        if (ImGui::Checkbox("Debug Mask View", &m_debugMaskView))
            m_cardMaterial->SetUniformValue("DebugMaskView", m_debugMaskView ? 1.0f : 0.0f);
        
        if (ImGui::Checkbox("Golden Mode", &m_goldenMode))
        {
            m_cardMaterial->SetUniformValue("GoldenMode", m_goldenMode ? 1.0f : 0.0f);
        }

        ImGui::Separator();
        ImGui::Text("Pixel Art");

        if (ImGui::Checkbox("Pixelate", &m_enablePixelArt))
            m_cardMaterial->SetUniformValue("EnablePixelArt", m_enablePixelArt ? 1.0f : 0.0f);
        if (ImGui::SliderFloat("Pixel Size", &m_pixelSize, 24.0f, 400.0f))
            m_cardMaterial->SetUniformValue("PixelSize", m_pixelSize);

        ImGui::Separator();
        ImGui::Text("Sheen");

        if (ImGui::Checkbox("Sheen", &m_enableSheen))
            m_cardMaterial->SetUniformValue("EnableSheen", m_enableSheen ? 1.0f : 0.0f);
        if (ImGui::SliderFloat("Speed", &m_sheenSpeed, 0.0f, 3.0f))
            m_cardMaterial->SetUniformValue("SheenSpeed", m_sheenSpeed);
        if (ImGui::SliderFloat("Width", &m_sheenWidth, 0.01f, 0.30f))
            m_cardMaterial->SetUniformValue("SheenWidth", m_sheenWidth);
        if (ImGui::SliderFloat("Intensity", &m_sheenIntensity, 0.0f, 5.0f))
            m_cardMaterial->SetUniformValue("SheenIntensity", m_sheenIntensity);
        if (ImGui::SliderFloat("Angle", &m_sheenAngleDeg, 0.0f, 180.0f))
            m_cardMaterial->SetUniformValue("SheenAngleDeg", m_sheenAngleDeg);
        if (ImGui::SliderFloat("Band Offset", &m_sheenBandOffset, -0.5f, 0.5f))
            m_cardMaterial->SetUniformValue("SheenBandOffset", m_sheenBandOffset);

        ImGui::Separator();
        ImGui::Text("Gold");

        if (ImGui::SliderFloat("Sharpness", &m_goldSharpness, 1.0f, 6.0f))
            m_cardMaterial->SetUniformValue("GoldSharpness", m_goldSharpness);
        if (ImGui::SliderFloat("Gate Center", &m_goldGateCenter, 0.05f, 0.95f))
            m_cardMaterial->SetUniformValue("GoldGateCenter", m_goldGateCenter);
        if (ImGui::SliderFloat("Hue Shift", &m_goldHueShift, 0.0f, 1.0f))
            m_cardMaterial->SetUniformValue("GoldHueShift", m_goldHueShift);

        if (ImGui::SliderFloat("Relief", &m_goldReliefStrength, 0.0f, 1.0f))
            m_cardMaterial->SetUniformValue("GoldReliefStrength", m_goldReliefStrength);
        if (ImGui::SliderFloat("Rim", &m_goldRimStrength, 0.0f, 2.0f))                          // re-add
            m_cardMaterial->SetUniformValue("GoldRimStrength", m_goldRimStrength);
        
        ImGui::Separator();
        ImGui::Text("Flow A");

        if (ImGui::Checkbox("Flow", &m_enableFlow))
            m_cardMaterial->SetUniformValue("EnableFlow", m_enableFlow ? 1.0f : 0.0f);
        if (ImGui::SliderFloat("Flow Strength", &m_goldFlowStrength, 0.0f, 3.0f))
            m_cardMaterial->SetUniformValue("GoldFlowStrength", m_goldFlowStrength);
        if (ImGui::SliderFloat("Flow Speed", &m_goldFlowSpeed, 0.1f, 3.0f))
            m_cardMaterial->SetUniformValue("GoldFlowSpeed", m_goldFlowSpeed);
        if (ImGui::SliderFloat("Flow Blob Scale", &m_goldFlowBlobScale, 4.0f, 40.0f))
            m_cardMaterial->SetUniformValue("GoldFlowBlobScale", m_goldFlowBlobScale);
        if (ImGui::SliderFloat("Flow Density", &m_goldFlowDensity, 0.0f, 1.0f))
            m_cardMaterial->SetUniformValue("GoldFlowDensity", m_goldFlowDensity);
        
        ImGui::Separator();
        ImGui::Text("Flow B");

        if (ImGui::SliderFloat("Strength B", &m_goldFlowStrengthB, 0.0f, 3.0f))
            m_cardMaterial->SetUniformValue("GoldFlowStrengthB", m_goldFlowStrengthB);
        if (ImGui::SliderFloat("Speed B", &m_goldFlowSpeedB, 0.1f, 3.0f))
            m_cardMaterial->SetUniformValue("GoldFlowSpeedB", m_goldFlowSpeedB);
        if (ImGui::SliderFloat("Blob Scale B", &m_goldFlowBlobScaleB, 4.0f, 60.0f))
            m_cardMaterial->SetUniformValue("GoldFlowBlobScaleB", m_goldFlowBlobScaleB);
        if (ImGui::SliderFloat("Density B", &m_goldFlowDensityB, 0.0f, 1.0f))
            m_cardMaterial->SetUniformValue("GoldFlowDensityB", m_goldFlowDensityB);

        ImGui::Separator();
        ImGui::Text("Sparkles");

        if (ImGui::Checkbox("Sparkles", &m_enableSparkles))
            m_cardMaterial->SetUniformValue("EnableSparkles", m_enableSparkles ? 1.0f : 0.0f);
        if (ImGui::SliderFloat("Sparkle Density", &m_sparkleDensity, 0.0f, 0.5f))
            m_cardMaterial->SetUniformValue("SparkleDensity", m_sparkleDensity);
        if (ImGui::SliderFloat("Sparkle Brightness", &m_sparkleBrightness, 0.0f, 5.0f))
            m_cardMaterial->SetUniformValue("SparkleBrightness", m_sparkleBrightness);
        if (ImGui::SliderFloat("Sparkle Size", &m_sparkleSize, 0.3f, 2.0f))
            m_cardMaterial->SetUniformValue("SparkleSize", m_sparkleSize);
        if (ImGui::SliderFloat("Sparkle Speed", &m_sparkleSpeed, 0.1f, 3.0f))
            m_cardMaterial->SetUniformValue("SparkleSpeed", m_sparkleSpeed);
    }

    if (auto window = m_imGui.UseWindow("Post FX"))
    {
        if (m_composeMaterial)
        {
            if (ImGui::DragFloat("Exposure", &m_exposure, 0.01f, 0.01f, 5.0f))
            {
                m_composeMaterial->SetUniformValue("Exposure", m_exposure);
            }

            ImGui::Separator();

            if (ImGui::SliderFloat("Contrast", &m_contrast, 0.5f, 1.5f))
            {
                m_composeMaterial->SetUniformValue("Contrast", m_contrast);
            }
            if (ImGui::SliderFloat("Hue Shift", &m_hueShift, -0.5f, 0.5f))
            {
                m_composeMaterial->SetUniformValue("HueShift", m_hueShift);
            }
            if (ImGui::SliderFloat("Saturation", &m_saturation, 0.0f, 2.0f))
            {
                m_composeMaterial->SetUniformValue("Saturation", m_saturation);
            }
            if (ImGui::ColorEdit3("Color Filter", &m_colorFilter[0]))
            {
                m_composeMaterial->SetUniformValue("ColorFilter", m_colorFilter);
            }

            ImGui::Separator();

            if (ImGui::DragFloat2("Bloom Range", &m_bloomRange[0], 0.1f, 0.1f, 10.0f))
            {
                m_bloomMaterial->SetUniformValue("Range", m_bloomRange);
            }
            if (ImGui::DragFloat("Bloom Intensity", &m_bloomIntensity, 0.1f, 0.0f, 5.0f))
            {
                m_bloomMaterial->SetUniformValue("Intensity", m_bloomIntensity);
            }
        }
    }

    m_imGui.EndFrame();
}