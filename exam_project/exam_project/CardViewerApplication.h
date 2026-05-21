#pragma once

#include <ituGL/application/Application.h>
#include <ituGL/texture/FramebufferObject.h>
#include <ituGL/renderer/Renderer.h>
#include <ituGL/utils/DearImGui.h>
#include <ituGL/camera/Camera.h>

#include <array>
#include <memory>

class Texture2DObject;
class Material;
class ShaderProgram;

class CardViewerApplication : public Application
{
public:
    CardViewerApplication();
    ~CardViewerApplication() noexcept override = default;

protected:
    void Initialize() override;
    void Update() override;
    void Render() override;
    void Cleanup() override;

private:
    void InitializeCard();
    void InitializeFramebuffers();
    void InitializeRenderer();
    void InitializeCamera();

    std::shared_ptr<Material> CreatePostFXMaterial(const char* fragmentShaderPath, std::shared_ptr<Texture2DObject> sourceTexture = nullptr);

    void RenderGUI();

private:
    std::shared_ptr<Camera> m_camera;

    // Helper object for debug GUI
    DearImGui m_imGui;

    // Renderer
    Renderer m_renderer;

    // Card textures
    std::shared_ptr<Texture2DObject> m_cardAlbedoTexture;
    std::shared_ptr<Texture2DObject> m_cardMaskTexture;

    // Materials
    std::shared_ptr<Material> m_cardMaterial;
    std::shared_ptr<Material> m_bloomMaterial;
    std::shared_ptr<Material> m_composeMaterial;

    // Framebuffers
    std::shared_ptr<FramebufferObject> m_sceneFramebuffer;
    std::shared_ptr<Texture2DObject> m_sceneTexture;
    std::array<std::shared_ptr<FramebufferObject>, 2> m_tempFramebuffers;
    std::array<std::shared_ptr<Texture2DObject>, 2> m_tempTextures;

    // Card configuration values
    bool  m_debugMaskView;
    bool m_goldenMode;
    bool m_enableSheen;

    // Post-processing configuration values
    float m_exposure;
    float m_contrast;
    float m_hueShift;
    float m_saturation;
    glm::vec3 m_colorFilter;
    int m_blurIterations;
    glm::vec2 m_bloomRange;
    float m_bloomIntensity;

    // Sheen
    float m_sheenSpeed;
    float m_sheenWidth;
    float m_sheenIntensity;
    float m_sheenAngleDeg;
    float m_sheenBandOffset;

    float m_goldSharpness;
    float m_goldGateCenter;
    float m_goldHueShift;

    float m_goldReliefStrength;
    float m_goldRimStrength;

    float m_goldFlowStrength;
    float m_goldFlowSpeed;
    float m_goldFlowBlobScale;
    float m_goldFlowDensity;
    bool m_enableFlow;

    float m_goldFlowStrengthB;
    float m_goldFlowBlobScaleB;
    float m_goldFlowDensityB;
    float m_goldFlowSpeedB;

    float m_sparkleDensity;
    float m_sparkleBrightness;
    float m_sparkleSize;
    float m_sparkleSpeed;
    bool  m_enableSparkles;

    float m_pixelSize;
    bool  m_enablePixelArt;
};