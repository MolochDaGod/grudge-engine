import '@babylonjs/loaders'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import { ArcRotateCamera }  from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator }  from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { MeshBuilder }      from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { SceneLoader }      from '@babylonjs/core/Loading/sceneLoader'
import { Color3 }           from '@babylonjs/core/Maths/math.color'
import { Vector3 }          from '@babylonjs/core/Maths/math.vector'
import { GrudgeEngine }     from '../../../src/core/GrudgeEngine'
import { autoNormalizeCharacter } from '../../../src/core/character'

const R2_RTS = 'https://assets.grudge-studio.com/models/characters/rts'

const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.04, 0.04, 0.08, 1] })
const { scene } = grudge

new HemisphericLight('h', new Vector3(0, 1, 0), scene).intensity = 0.5
const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), scene)
sun.position = new Vector3(5, 10, 5); sun.intensity = 1.2
const shadows = new ShadowGenerator(512, sun)
shadows.useBlurExponentialShadowMap = true

const cam = new ArcRotateCamera('c', -Math.PI / 2, Math.PI / 3, 5, new Vector3(0, 1, 0), scene)
cam.lowerRadiusLimit = 2; cam.upperRadiusLimit = 12
cam.attachControl(grudge.canvas, true)

// Platform
const base = MeshBuilder.CreateCylinder('base', { diameter: 2.5, height: 0.15, tessellation: 32 }, scene)
const bm = new StandardMaterial('bm', scene)
bm.diffuseColor = new Color3(0.7, 0.3, 0.1)
bm.specularColor = new Color3(0.4, 0.4, 0.4)
base.material = bm; base.receiveShadows = true

// Load Knight (warrior class) from R2 RTS character set
SceneLoader.ImportMeshAsync('', `${R2_RTS}/`, 'Knight_Male.glb', scene)
  .then(r => {
    const root = r.meshes[0]
    autoNormalizeCharacter(root)          // ← fix Mixamo cm-scale if needed
    root.position.y = 0.1
    r.meshes.forEach(m => { shadows.addShadowCaster(m); m.receiveShadows = true })
    // Auto-play first embedded animation
    if (scene.animationGroups.length > 0) scene.animationGroups[0].start(true)
  })
  .catch(() => {
    // Fallback: show a coloured capsule so the scene isn't empty
    const cap = MeshBuilder.CreateCapsule('char', { radius: 0.35, height: 1.7 }, scene)
    cap.position.y = 0.95
    const m = new StandardMaterial('cm', scene); m.diffuseColor = new Color3(0.7, 0.3, 0.1)
    cap.material = m; shadows.addShadowCaster(cap)
  })

// Orbit
let angle = 0
grudge.start((dt) => {
  angle += dt * 0.0004
  cam.alpha = angle
})
document.getElementById('hud')!.textContent = 'Warrior — Knight class  |  Grudge Warlords  |  Drag to orbit'
