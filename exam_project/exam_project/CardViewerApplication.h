#pragma once

#include <ituGL/application/Application.h>
#include <ituGL/texture/FramebufferObject.h>
#include <ituGL/renderer/Renderer.h>
#include <ituGL/utils/DearImGui.h>

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

    std::shared_ptr<Material> CreatePostFXMaterial(const char* fragmentShaderPath, std::shared_ptr<Texture2DObject> sourceTexture = nullptr);

    void RenderGUI();

private:
    DearImGui m_imGui;

    Renderer m_renderer;

    std::shared_ptr<Texture2DObject> m_cardAlbedoTexture;
    std::shared_ptr<Texture2DObject> m_cardMaskTexture;

    std::shared_ptr<Material> m_cardMaterial;
    std::shared_ptr<Material> m_bloomMaterial;
    std::shared_ptr<Material> m_composeMaterial;

    std::shared_ptr<FramebufferObject> m_sceneFramebuffer;
    std::shared_ptr<Texture2DObject> m_sceneTexture;
    std::array<std::shared_ptr<FramebufferObject>, 2> m_tempFramebuffers;
    std::array<std::shared_ptr<Texture2DObject>, 2> m_tempTextures;

    bool m_goldenMode;

    float m_exposure;
    float m_contrast;
    float m_hueShift;
    float m_saturation;
    glm::vec3 m_colorFilter;
    int m_blurIterations;
    glm::vec2 m_bloomRange;
    float m_bloomIntensity;
};