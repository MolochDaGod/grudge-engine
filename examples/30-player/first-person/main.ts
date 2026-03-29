import '@babylonjs/loaders/glTF'
import { UniversalCamera }     from '@babylonjs/core/Cameras/universalCamera'
import { HemisphericLight }    from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight }    from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator }     from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { MeshBuilder }         from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial }    from '@babylonjs/core/Materials/standardMaterial'
import { Color3 }              from '@babylonjs/core/Maths/math.color'
import { Vector3 }             from '@babylonjs/core/Maths/math.vector'
import { GrudgeEngine }        from '../../../src/core/GrudgeEngine'

const grudge = GrudgeEngine.create({ canvasId: 'grudge-canvas', clearColor: [0.04, 0.05, 0.1, 1] })
const { scene, engine } = grudge

// Lighting
const hemi = new HemisphericLight('h', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.4
const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), scene)
sun.position = new Vector3(10, 30, 10)
sun.intensity = 1.0
const shadows = new ShadowGenerator(1024, sun)
shadows.useBlurExponentialShadowMap = true

// FPS Camera — pointer lock
const cam = new UniversalCamera('fps', new Vector3(0, 1.7, -5), scene)
cam.setTarget(new Vector3(0, 1.7, 0))
cam.speed = 0.2
cam.minZ = 0.1
cam.keysUp    = [87] // W
cam.keysDown  = [83] // S
cam.keysLeft  = [65] // A
cam.keysRight = [68] // D
cam.attachControl(grudge.canvas, true)

// Click canvas to lock pointer
grudge.canvas.addEventListener('click', () => grudge.canvas.requestPointerLock())

const hud = document.getElementById('hud')!
document.addEventListener('pointerlockchange', () => {
  hud.textContent = document.pointerLockElement
    ? 'WASD — Move  |  Mouse — Look  |  ESC — Unlock'
    : 'Click to capture mouse'
})
hud.textContent = 'Click to capture mouse'

// Ground
const ground = MeshBuilder.CreateGround('g', { width: 60, height: 60 }, scene)
const gm = new StandardMaterial('gm', scene)
gm.diffuseColor = new Color3(0.15, 0.2, 0.12)
ground.material = gm; ground.receiveShadows = true

// Walls / obstacles
const wallData: [number, number, number, number, number][] = [
  [0, 1.5, 10, 8, 3], [-5, 1, -3, 3, 2], [7, 2, 0, 2, 4],
  [-8, 1.5, 5, 4, 3], [3, 1, -8, 5, 2],
]
wallData.forEach(([x, y, z, w, h], i) => {
  const box = MeshBuilder.CreateBox(`w${i}`, { width: w, height: h, depth: 0.4 }, scene)
  box.position.set(x, y / 2 + h / 2, z)
  const m = new StandardMaterial(`wm${i}`, scene)
  m.diffuseColor = new Color3(0.3 + i * 0.04, 0.3, 0.35)
  box.material = m; box.receiveShadows = true
  shadows.addShadowCaster(box)
})

// Crates
for (let i = 0; i < 12; i++) {
  const s = 0.6 + Math.random() * 0.8
  const box = MeshBuilder.CreateBox(`c${i}`, { size: s }, scene)
  box.position.set((Math.random() - 0.5) * 30, s / 2, (Math.random() - 0.5) * 30)
  const m = new StandardMaterial(`cm${i}`, scene)
  m.diffuseColor = new Color3(0.4, 0.3, 0.2)
  box.material = m; box.receiveShadows = true
  shadows.addShadowCaster(box)
}

grudge.start()
