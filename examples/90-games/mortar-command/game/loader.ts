// game/loader.ts — ported from assets-loader.js
import '@babylonjs/loaders/glTF'
import { AssetsManager }      from '@babylonjs/core/Misc/assetsManager'
import { MeshBuilder }        from '@babylonjs/core/Meshes/meshBuilder'
import { BackgroundMaterial } from '@babylonjs/core/Materials/Background/backgroundMaterial'
import { Texture }            from '@babylonjs/core/Materials/Textures/texture'
import { Vector3 }            from '@babylonjs/core/Maths/math.vector'
import { Sound }              from '@babylonjs/core/Audio/sound'
import { VertexData }         from '@babylonjs/core/Meshes/mesh.vertexData'
import { ActionManager, ExecuteCodeAction } from '@babylonjs/core/Actions'
import type { MCScene }       from './types'
import { MC_TABLE_XFORM, TABLE_BACKGROUND_ALPHA, mcAsset } from './tableConstants'

export function loadAssets(scene: MCScene, onAllLoaded: () => void): void {
  const mgr = new AssetsManager(scene)
  mgr.useDefaultLoadingScreen = false

  // ── Sounds ────────────────────────────────────────────────────────────────
  const soundDefs: Array<[string, string]> = [
    ['power-off',        'sounds/power-off.wav'],
    ['newActivator',     'sounds/new_activator.wav'],
    ['activatorPowerUp', 'sounds/power-up.wav'],
    ['activatorHit',     'sounds/dink.wav'],
    ['heavyMortar',      'sounds/heavymortar.wav'],
    ['play',             'sounds/bleachit.wav'],
    ['hum',              'sounds/hum.wav'],
    ['insertCoin',       'sounds/insertcoin.wav'],
    ['gunhit',           'sounds/gunhit.wav'],
    ['gun',              'sounds/gun.wav'],
    ['mortar',           'sounds/mortar.wav'],
    ['mortarHit',        'sounds/mortarHit.wav'],
    ['station-damage',   'sounds/station-damage.wav'],
    ['station-destroyed','sounds/station.wav'],
    ['ore',              'sounds/ore.wav'],
    ['agent-destroyed',  'sounds/agent-destroyed.wav'],
    ['mine',             'sounds/mine.wav'],
  ]

  for (const [name, path] of soundDefs) {
    const t = mgr.addBinaryFileTask(name + 'SoundTask', mcAsset(path))
    t.onSuccess = (task: any) => {
      new Sound(name, task.data, scene, null, { autoplay: false })
    }
  }

  // ── Terrain GLTF ─────────────────────────────────────────────────────────
  const terrainTask = mgr.addMeshTask(
    'terrainLoadTask', '',
    mcAsset('') + '/',
    'NTC_Draco.gltf',
  )
  terrainTask.onSuccess = (task: any) => {
    const newMeshes = task.loadedMeshes
    newMeshes[0].scaling = new Vector3(
      MC_TABLE_XFORM.scale[0],
      MC_TABLE_XFORM.scale[1],
      MC_TABLE_XFORM.scale[2],
    )
    newMeshes[0].addRotation(0, Math.PI, 0)
    newMeshes[0].position = new Vector3(
      MC_TABLE_XFORM.pos[0],
      MC_TABLE_XFORM.pos[1],
      MC_TABLE_XFORM.pos[2],
    )

    const terrain = newMeshes[1]
    terrain.updateFacetData()

    // Flip normals (gltf right-handed → BJS left-handed)
    const vd = VertexData.ExtractFromMesh(terrain)
    for (let i = 0; i < vd.normals!.length; i++) vd.normals![i] *= -1
    terrain.computeWorldMatrix(true)

    terrain.actionManager = new ActionManager(scene)
    terrain.actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
        scene.hoverCursor = `url('${mcAsset('textures/cursor.png')}') 12 12, auto`
      }),
    )
  }

  // ── Progress callback ─────────────────────────────────────────────────────
  const messages = [
    'Loading…96%','Loading…93%','Loading…90%','Loading…88%','Loading…85%',
    'Loading…79%','Loading…76%','Loading…70%','Loading…65%','Loading…68%',
    'Loading…66%','Loading…60%','Loading…58%','Loading…55%','Loading…50%',
    'Loading…45%','Loading…40%','Loading…35%',
  ]
  mgr.onProgress = (remaining) => {
    const el = document.getElementById('loading-span')
    if (el) el.textContent = messages[remaining] ?? 'Loading…'
  }

  mgr.onTaskErrorObservable.add((task) => {
    console.warn('Asset load error:', task.name, (task as any).errorObject?.message)
  })

  mgr.onFinish = () => onAllLoaded()
  mgr.load()
}

export function addGround(scene: MCScene): void {
  const ground = MeshBuilder.CreateGround('ground1', { width: 130, height: 130, subdivisions: 2 }, scene)
  ground.receiveShadows = false

  const bgMat = new BackgroundMaterial('backgroundMaterial', scene)
  bgMat.diffuseTexture = new Texture(mcAsset('textures/backgroundGround.png'), scene)
  bgMat.diffuseTexture.hasAlpha = true
  bgMat.opacityFresnel = true
  bgMat.alpha = TABLE_BACKGROUND_ALPHA
  bgMat.shadowLevel = 0.4
  ground.material = bgMat
}
