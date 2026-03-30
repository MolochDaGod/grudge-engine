/**
 * babylon-full.ts — Grudge Engine complete Babylon.js surface
 *
 * Import this ONE file at the top of any example that was written as a
 * Babylon.js Playground snippet (plain JS using the global BABYLON.* namespace).
 *
 * It is equivalent to loading the full Babylon.js CDN bundle — every loader,
 * renderer, material, post-process, and plugin is registered as a side-effect.
 *
 * Usage (TypeScript example)
 * --------------------------
 *   import '../../src/babylon-full'          // ← registers everything
 *   import { Engine } from '@babylonjs/core/Engines/engine'
 *   import { SkyMaterial } from '@babylonjs/materials/sky/skyMaterial'
 *   // ... rest of your ported code
 *
 * Usage (raw playground JS — zero changes needed)
 * ------------------------------------------------
 *   // At the very top of the JS file add ONE import:
 *   import { BABYLON } from '../../src/babylon-full'
 *   // All playground BABYLON.* references now resolve correctly.
 *
 * Package → feature map
 * ---------------------
 *  @babylonjs/core                — Engine, Scene, Mesh, Camera, Light, Animation,
 *                                   ParticleSystem, ShadowGenerator, NodeMaterial,
 *                                   PostProcess, SSAO2, DefaultRenderingPipeline,
 *                                   GlowLayer, HighlightLayer, NodeRenderGraph ...
 *  @babylonjs/loaders             — GLB/GLTF 1+2, OBJ, STL, FBX, .babylon, SPLAT
 *  @babylonjs/materials           — SkyMaterial, WaterMaterial, GridMaterial,
 *                                   FireMaterial, CellMaterial, GradientMaterial,
 *                                   LavaMaterial, MixMaterial, FurMaterial,
 *                                   TriPlanarMaterial, TerrainMaterial ...
 *  @babylonjs/procedural-textures — WoodProceduralTexture, MarbleProceduralTexture,
 *                                   GrassProceduralTexture, CloudProceduralTexture ...
 *  @babylonjs/post-processes      — LensFlareSystem, MotionBlurPostProcess,
 *                                   ScreenSpaceReflectionPostProcess,
 *                                   VolumetricLightScatteringPostProcess,
 *                                   DigitalRainPostProcess, TonemappingPostProcess ...
 *  @babylonjs/gui                 — AdvancedDynamicTexture, Button, TextBlock,
 *                                   Slider, InputText, Image, Container ...
 *  @babylonjs/serializers         — SceneSerializer, OBJExport, STLExport,
 *                                   GLTF2Export ...
 *  @babylonjs/havok               — HavokPlugin (v2 physics)
 *  @babylonjs/addons              — IEnvironmentHelper, UtilityLayerRenderer
 *                                   helpers, IBLShadows, ArcRotateCameraGamepad ...
 *  @babylonjs/ktx2decoder         — KTX2 / Basis compressed texture support
 *  @babylonjs/accessibility       — AccessibilityViewer, scene tag trees
 *  @babylonjs/inspector           — Scene Inspector (press Ctrl+Alt+I)
 */

// ─────────────────────────────────────────────────────────────────────────────
// SIDE-EFFECT IMPORTS — order matters for some registrations
// ─────────────────────────────────────────────────────────────────────────────

// Core renderers + scene components that are NOT auto-loaded by tree-shaking
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import '@babylonjs/core/Physics/physicsEngineComponent'
import '@babylonjs/core/Rendering/outlineRenderer'
import '@babylonjs/core/Rendering/edgesRenderer'
import '@babylonjs/core/Rendering/depthRenderer'
import '@babylonjs/core/Rendering/geometryBufferRenderer'
import '@babylonjs/core/Rendering/prePassRendererSceneComponent'
import '@babylonjs/core/Audio/audioSceneComponent'
import '@babylonjs/core/Misc/screenshotTools'
import '@babylonjs/core/XR/webXRDefaultExperience'
import '@babylonjs/core/Particles/webgl2ParticleSystem'

// All file loaders (GLTF 1/2, GLB, OBJ, STL, FBX, .babylon, SPLAT)
import '@babylonjs/loaders'

// Extended material library
import '@babylonjs/materials'

// Procedural textures
import '@babylonjs/procedural-textures'

// Extra post-processes
import '@babylonjs/post-processes'

// Scene serializers (GLTF2Export, OBJExport, STLExport …)
import '@babylonjs/serializers'

// KTX2 / Basis compressed texture support
import '@babylonjs/ktx2decoder'

// Addons (IBL shadows, utility helpers, extended camera options …)
import '@babylonjs/addons'

// Accessibility scene tagging
import '@babylonjs/accessibility'

// Inspector (Ctrl+Alt+I in any scene — zero extra config)
import '@babylonjs/inspector'

// ─────────────────────────────────────────────────────────────────────────────
// BABYLON NAMESPACE — for porting raw playground JS with zero changes
// ─────────────────────────────────────────────────────────────────────────────
//
// In playground JS you write:  var engine = new BABYLON.Engine(canvas, true)
// After importing this file:   const { BABYLON } = await import('./babylon-full')
//                               const engine = new BABYLON.Engine(canvas, true)
//
// Or just destructure what you need at the top:
//   import { BABYLON } from '../../src/babylon-full'
//   const { Engine, Scene, Vector3 } = BABYLON

export * as BABYLON from '@babylonjs/core'

// Re-export each sub-library under its own name so you can also do:
//   import { Materials, GUI, ProceduralTextures } from '../../src/babylon-full'
export * as Materials           from '@babylonjs/materials'
export * as GUI                 from '@babylonjs/gui'
export * as ProceduralTextures  from '@babylonjs/procedural-textures'
export * as PostProcesses       from '@babylonjs/post-processes'
export * as Serializers         from '@babylonjs/serializers'
export * as Addons              from '@babylonjs/addons'
