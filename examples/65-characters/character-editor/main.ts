/**
 * Character Editor — Grudge Engine
 *
 * Architecture mirrors the BJS Animation Retargeting Playground pattern:
 *   Avatar   → loads a character GLB, exposes its skeleton
 *   Animation → loads UAL1/UAL2 animation libraries, retargets to Avatar
 *   Retarget  → bone-name mapping engine (KayKit ↔ Mixamo ↔ Generic)
 *   GUI      → left-panel character browser + right-panel animation grid
 *
 * Features
 *  - 24 characters from Grudge R2 (rts/ prefix)
 *  - Embedded animations from each character
 *  - UAL1 + UAL2 Universal Animation Library animations (retargeted live)
 *  - KayKit weapon equip (attach to right-hand bone)
 *  - Live stats: verts, tris, bones, materials, height
 *  - Playback speed + blend-time sliders
 *  - PBR 3-point lighting, soft shadows, SSAO2, Bloom
 */

import '@babylonjs/loaders'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'

import { Engine }           from '@babylonjs/core/Engines/engine'
import { Scene }            from '@babylonjs/core/scene'
import { ArcRotateCamera }  from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { PointLight }       from '@babylonjs/core/Lights/pointLight'
import { ShadowGenerator }  from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Vector3 }          from '@babylonjs/core/Maths/math.vector'
import { Color3, Color4 }   from '@babylonjs/core/Maths/math.color'
import { MeshBuilder }      from '@babylonjs/core/Meshes/meshBuilder'
import { PBRMaterial }      from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { GridMaterial }     from '@babylonjs/materials/grid/gridMaterial'
import { SceneLoader }      from '@babylonjs/core/Loading/sceneLoader'
import { AbstractMesh }     from '@babylonjs/core/Meshes/abstractMesh'
import { Skeleton }         from '@babylonjs/core/Bones/skeleton'
import { AnimationGroup }   from '@babylonjs/core/Animations/animationGroup'
import { Bone }             from '@babylonjs/core/Bones/bone'
import { GlowLayer }        from '@babylonjs/core/Layers/glowLayer'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'
import { SSAO2RenderingPipeline }   from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline'
import { normBoneName, autoNormalizeCharacter, retargetAnimationGroup } from '../../../src/core/character'

// ── R2 base URLs ───────────────────────────────────────────────────────────────────
const R2_CHARS   = 'https://assets.grudge-studio.com/models/characters/rts'
const R2_ANIMS   = 'https://assets.grudge-studio.com/models/animations'
const R2_WEAPONS = 'https://assets.grudge-studio.com/models/weapons/kaykit'

// ── Character manifest ──────────────────────────────────────────────────────
interface CharDef { id: string; name: string; file: string; cat: string; icon: string }

const CHARACTERS: CharDef[] = [
  { id:'knight',   name:'Knight',          file:'Knight_Male.glb',          cat:'warrior', icon:'⚔️' },
  { id:'gknight',  name:'Golden Knight',   file:'Knight_Golden_Male.glb',   cat:'warrior', icon:'🛡️' },
  { id:'soldier',  name:'Soldier',         file:'Soldier_Male.glb',         cat:'warrior', icon:'🪖' },
  { id:'bsoldier', name:'Blue Soldier',    file:'BlueSoldier_Male.glb',     cat:'warrior', icon:'💙' },
  { id:'viking',   name:'Viking',          file:'Viking_Male.glb',          cat:'warrior', icon:'🪓' },
  { id:'barbarian',name:'Barbarian',       file:'BarbarianGlad.glb',        cat:'warrior', icon:'💪' },
  { id:'berserker',name:'Berserker',       file:'berserker.glb',            cat:'warrior', icon:'🔥' },
  { id:'pirate',   name:'Pirate',          file:'Pirate_Male.glb',          cat:'rogue',   icon:'🏴‍☠️' },
  { id:'ninja',    name:'Ninja',           file:'Ninja_Male.glb',           cat:'rogue',   icon:'🥷' },
  { id:'anne',     name:'Anne',            file:'Anne.glb',                 cat:'rogue',   icon:'🗡️' },
  { id:'swat',     name:'Swat',            file:'Swat.glb',                 cat:'rogue',   icon:'🔫' },
  { id:'wizard',   name:'Wizard',          file:'Wizard.glb',               cat:'caster',  icon:'🧙' },
  { id:'witch',    name:'Witch',           file:'Witch.glb',                cat:'caster',  icon:'🧹' },
  { id:'awizard',  name:'Arcane Wizard',   file:'Animated_Wizard.glb',     cat:'caster',  icon:'✨' },
  { id:'elf',      name:'Elf',             file:'Elf.glb',                  cat:'rogue',   icon:'🧝' },
  { id:'goblin',   name:'Goblin',          file:'Goblin_Male.glb',          cat:'creature',icon:'👺' },
  { id:'adventurer',name:'Adventurer',     file:'Adventurer.glb',           cat:'warrior', icon:'🗺️' },
  { id:'king',     name:'King',            file:'King.glb',                 cat:'warrior', icon:'👑' },
  { id:'zombie_m', name:'Zombie',          file:'Zombie_Male.glb',          cat:'undead',  icon:'🧟' },
  { id:'zombie_f', name:'Zombie Queen',    file:'Zombie_Female.glb',        cat:'undead',  icon:'🧟‍♀️' },
  { id:'awoman',   name:'Warrior Woman',   file:'Animated_Woman.glb',       cat:'warrior', icon:'⚔️' },
  { id:'base',     name:'Base Character',  file:'Animated_Character_Base.glb', cat:'other', icon:'🧍' },
]

// ── KayKit weapon set ───────────────────────────────────────────────────────
const WEAPONS = [
  { id:'sword_A',  label:'Sword A'  }, { id:'axe_A',    label:'Axe'    },
  { id:'hammer_A', label:'Hammer'   }, { id:'staff_A',  label:'Staff'  },
  { id:'bow_A',    label:'Bow'      }, { id:'dagger_A', label:'Dagger' },
  { id:'shield_A', label:'Shield'   }, { id:'spear_A',  label:'Spear'  },
  { id:'wand_A',   label:'Wand'     },
]

// Right-hand bone aliases
const RH_NORMS = [
  'fist.r','fistr','righthand','hand_r','handr','hand.r','wrist_r','wristr',
  'righthandindex1','handright','r_hand','rhand',
].map(normBoneName)

function findRightHand(skeleton: Skeleton): Bone | null {
  return skeleton.bones.find(b => RH_NORMS.includes(normBoneName(b.name))) ?? null
}

// ── Engine + Scene ───────────────────────────────────────────────────────────
const canvas     = document.getElementById('grudge-canvas') as HTMLCanvasElement
const engine     = new Engine(canvas, true, { adaptToDeviceRatio: true, stencil: true })
const scene      = new Scene(engine)
scene.clearColor = new Color4(0.05, 0.06, 0.09, 1)
window.addEventListener('resize', () => engine.resize())

// ── Camera ────────────────────────────────────────────────────────────────────
const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 3, 4, new Vector3(0, 1, 0), scene)
camera.lowerRadiusLimit   = 1.5
camera.upperRadiusLimit   = 10
camera.wheelDeltaPercentage = 0.01
camera.attachControl(canvas, true)

// ── Lights + shadows ──────────────────────────────────────────────────────────
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.35; hemi.groundColor = new Color3(0.05, 0.05, 0.08)

const key = new DirectionalLight('key', new Vector3(-0.8, -1.2, -0.5), scene)
key.position = new Vector3(4, 8, 4); key.intensity = 1.8

const fill = new DirectionalLight('fill', new Vector3(1, -0.2, 1), scene)
fill.position = new Vector3(-4, 6, -4); fill.intensity = 0.6; fill.diffuse = new Color3(0.5, 0.6, 0.9)

const rim = new PointLight('rim', new Vector3(0, 3, -3), scene)
rim.diffuse = new Color3(0.4, 0.7, 1); rim.intensity = 30; rim.range = 8

const shadows = new ShadowGenerator(1024, key)
shadows.useBlurExponentialShadowMap = true; shadows.blurKernel = 16

// ── Ground + grid ─────────────────────────────────────────────────────────────
const ground = MeshBuilder.CreateGround('ground', { width: 6, height: 6 }, scene)
ground.receiveShadows = true
const groundMat = new PBRMaterial('gmat', scene)
groundMat.albedoColor = new Color3(0.08, 0.09, 0.12)
groundMat.metallic = 0.2; groundMat.roughness = 0.9
ground.material = groundMat

const gridMesh = MeshBuilder.CreateGround('grid', { width: 10, height: 10 }, scene)
gridMesh.position.y = 0.002
const gm = new GridMaterial('gm', scene)
gm.majorUnitFrequency = 5; gm.minorUnitVisibility = 0.3
gm.gridRatio = 0.5; gm.mainColor = new Color3(0.3, 0.4, 0.5); gm.lineColor = new Color3(0.15, 0.2, 0.25)
gm.opacity = 0.4; gm.backFaceCulling = false
gridMesh.material = gm

// ── Post-processing ────────────────────────────────────────────────────────────
const pip = new DefaultRenderingPipeline('pip', true, scene, [camera])
pip.bloomEnabled = true; pip.bloomThreshold = 0.4; pip.bloomWeight = 0.4
pip.fxaaEnabled  = true
pip.imageProcessingEnabled = true
pip.imageProcessing.contrast = 1.2; pip.imageProcessing.exposure = 1.1
pip.imageProcessing.vignetteEnabled = true; pip.imageProcessing.vignetteWeight = 1.2

const ssao = new SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.5, blurRatio: 1 }, [camera])
ssao.radius = 2; ssao.totalStrength = 0.8; ssao.maxZ = 20

// ── State ─────────────────────────────────────────────────────────────────────
let charMeshes:      AbstractMesh[]   = []
let charSkeleton:    Skeleton | null  = null
let embeddedGroups:  AnimationGroup[] = []
let retargetedGroups1: AnimationGroup[] = []
let retargetedGroups2: AnimationGroup[] = []
let weaponMesh:      AbstractMesh | null = null
let currentAnim:     AnimationGroup | null = null
let ual1Groups:      AnimationGroup[] = []  // source UAL1 groups (mesh hidden)
let ual2Groups:      AnimationGroup[] = []  // source UAL2 groups (mesh hidden)
let ual1Loaded    = false
let ual2Loaded    = false
let animSpeed     = 1.0
let blendDuration = 0.15
let activeTab     = 'embedded'
let paused        = false
let activeCharId  = ''
let activeAnimName = ''
let showGrid      = true
let bgDark        = true

// ── UI refs ────────────────────────────────────────────────────────────────────
const loadingMsg   = document.getElementById('loading-msg')!
const charNameEl   = document.getElementById('char-name-display')!
const animGrid     = document.getElementById('anim-grid')!
const weaponGrid   = document.getElementById('weapon-grid')!
const badgeAnim    = document.getElementById('badge-anim')!
const fpsDisplay   = document.getElementById('fps-display')!

const statMeshes   = document.getElementById('stat-meshes')!
const statVerts    = document.getElementById('stat-verts')!
const statTris     = document.getElementById('stat-tris')!
const statMats     = document.getElementById('stat-mats')!
const statBones    = document.getElementById('stat-bones')!
const statAnims    = document.getElementById('stat-anims')!
const statHeight   = document.getElementById('stat-height')!

// ── Helpers ────────────────────────────────────────────────────────────────────
function setLoading(msg: string | null) {
  if (msg) { loadingMsg.textContent = msg; loadingMsg.classList.remove('hidden') }
  else     { loadingMsg.classList.add('hidden') }
}

function playAnim(group: AnimationGroup, loop = true) {
  if (currentAnim && currentAnim !== group) currentAnim.stop()
  currentAnim = group
  group.start(loop, animSpeed)
  badgeAnim.textContent = group.name.replace(/_retargeted$/,'')
  badgeAnim.className   = 'topbar-badge active'
  paused = false
  document.getElementById('btn-pause')!.textContent = '⏸ Pause'
  // Highlight active button
  document.querySelectorAll('.anim-btn').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.name === group.name.replace(/_retargeted$/,'')))
  activeAnimName = group.name.replace(/_retargeted$/,'')
}

function updateStats() {
  if (!charMeshes.length) return
  let verts = 0, tris = 0, mats = new Set<string>()
  let minY = Infinity, maxY = -Infinity
  charMeshes.forEach(m => {
    const mesh = m as any
    if (mesh.getTotalVertices) verts += mesh.getTotalVertices()
    if (mesh.getTotalIndices)  tris  += mesh.getTotalIndices() / 3
    if (mesh.material) mats.add(mesh.material.uniqueId)
    const bi = m.getBoundingInfo?.()
    if (bi) { minY = Math.min(minY, bi.boundingBox.minimumWorld.y); maxY = Math.max(maxY, bi.boundingBox.maximumWorld.y) }
  })
  const boneCount = charSkeleton?.bones.length ?? 0
  const animCount = embeddedGroups.length + retargetedGroups1.length + retargetedGroups2.length

  statMeshes.textContent = String(charMeshes.length)
  statVerts.textContent  = verts.toLocaleString()
  statTris.textContent   = Math.round(tris).toLocaleString()
  statMats.textContent   = String(mats.size)
  statBones.textContent  = String(boneCount)
  statAnims.textContent  = String(animCount)
  statHeight.textContent = isFinite(maxY - minY) ? `${(maxY - minY).toFixed(2)} m` : '—'

  const vClass = verts > 15000 ? 'warn' : 'good'
  const tClass = tris  > 30000 ? 'warn' : 'good'
  statVerts.className = 'stat-val ' + vClass
  statTris.className  = 'stat-val ' + tClass
}

// ── Render anim buttons ────────────────────────────────────────────────────────
function renderAnimGrid() {
  animGrid.innerHTML = ''
  let groups: AnimationGroup[] = []
  if (activeTab === 'embedded') groups = embeddedGroups
  else if (activeTab === 'ual1') groups = retargetedGroups1
  else groups = retargetedGroups2

  if (groups.length === 0) {
    animGrid.innerHTML = `<div style="color:var(--muted);font-size:9px;grid-column:span 2;padding:6px">No animations — load a character first</div>`
    return
  }

  for (const g of groups) {
    const cleanName = g.name.replace(/_retargeted$/,'')
    const btn = document.createElement('button')
    btn.className = 'anim-btn' + (activeAnimName === cleanName ? ' active' : '')
    btn.dataset.name = cleanName
    btn.textContent = cleanName.replace(/_/g,' ')
    btn.title = cleanName
    btn.addEventListener('click', () => playAnim(g))
    animGrid.appendChild(btn)
  }
}

// ── Build weapon grid ──────────────────────────────────────────────────────────
function buildWeaponGrid() {
  weaponGrid.innerHTML = ''
  const noneBtn = document.createElement('button')
  noneBtn.className = 'weapon-btn active'; noneBtn.textContent = '— None'
  noneBtn.addEventListener('click', () => {
    weaponMesh?.dispose(); weaponMesh = null
    document.querySelectorAll('.weapon-btn').forEach(b => b.classList.remove('active'))
    noneBtn.classList.add('active')
  })
  weaponGrid.appendChild(noneBtn)

  for (const w of WEAPONS) {
    const btn = document.createElement('button')
    btn.className = 'weapon-btn'; btn.textContent = w.label
    btn.addEventListener('click', () => equipWeapon(w.id, btn))
    weaponGrid.appendChild(btn)
  }
}

async function equipWeapon(weaponId: string, btn: HTMLButtonElement) {
  weaponMesh?.dispose(); weaponMesh = null
  document.querySelectorAll('.weapon-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')

  if (!charSkeleton) return
  const rhBone = findRightHand(charSkeleton)
  if (!rhBone) { console.warn('No right-hand bone found'); return }

  try {
    const result = await SceneLoader.ImportMeshAsync('', `${R2_WEAPONS}/`, `${weaponId}.gltf`, scene)
    weaponMesh = result.meshes[0]
    weaponMesh.scaling.setAll(0.6)
    // Attach to right hand bone
    const parentMesh = charMeshes.find(m => (m as any).skeleton === charSkeleton) ?? charMeshes[0]
    if (parentMesh) (weaponMesh as any).attachToBone(rhBone, parentMesh)
  } catch (e) { console.warn('Weapon load failed:', e) }
}

// ── Load UAL animation libraries (once) ───────────────────────────────────────
async function ensureUAL1() {
  if (ual1Loaded) return
  ual1Loaded = true
  setLoading('Loading UAL1 animations…')
  try {
    const before = scene.animationGroups.length
    const result = await SceneLoader.ImportMeshAsync('', `${R2_ANIMS}/`, 'UAL1_Standard.glb', scene)
    result.meshes.forEach(m => { m.setEnabled(false); m.isPickable = false })
    ual1Groups = scene.animationGroups.slice(before)
    ual1Groups.forEach(g => g.stop())
  } catch (e) { console.warn('UAL1 load failed:', e) }
  setLoading(null)
}

async function ensureUAL2() {
  if (ual2Loaded) return
  ual2Loaded = true
  setLoading('Loading UAL2 animations…')
  try {
    const before = scene.animationGroups.length
    const result = await SceneLoader.ImportMeshAsync('', `${R2_ANIMS}/`, 'UAL2_Standard.glb', scene)
    result.meshes.forEach(m => { m.setEnabled(false); m.isPickable = false })
    ual2Groups = scene.animationGroups.slice(before)
    ual2Groups.forEach(g => g.stop())
  } catch (e) { console.warn('UAL2 load failed:', e) }
  setLoading(null)
}

// ── Load character ─────────────────────────────────────────────────────────────
async function loadCharacter(def: CharDef) {
  if (def.id === activeCharId) return
  activeCharId = def.id

  // Cleanup previous
  currentAnim?.stop(); currentAnim = null
  charMeshes.forEach(m => m.dispose()); charMeshes = []
  weaponMesh?.dispose(); weaponMesh = null
  embeddedGroups.forEach(g => g.dispose()); embeddedGroups = []
  retargetedGroups1.forEach(g => g.dispose()); retargetedGroups1 = []
  retargetedGroups2.forEach(g => g.dispose()); retargetedGroups2 = []
  charSkeleton = null

  setLoading(`Loading ${def.name}…`)
  charNameEl.textContent = def.name
  badgeAnim.textContent  = 'No Anim'; badgeAnim.className = 'topbar-badge'
  activeAnimName = ''

  try {
    const before = scene.animationGroups.length
    const result = await SceneLoader.ImportMeshAsync('', `${R2_CHARS}/`, def.file, scene)

    charMeshes   = result.meshes
    charSkeleton = result.skeletons[0] ?? null

    // Collect new animation groups (embedded)
    embeddedGroups = scene.animationGroups.slice(before)
    embeddedGroups.forEach(g => g.stop())

    // Scale + centre
    const root = charMeshes[0]
    root.position.y = 0

    // Shadows
    charMeshes.forEach(m => { shadows.addShadowCaster(m); m.receiveShadows = true })

    // Camera target
    const bounds = root.getHierarchyBoundingVectors()
    const height = bounds.max.y - bounds.min.y
    camera.setTarget(new Vector3(0, height * 0.5, 0))
    camera.radius = Math.max(3, height * 1.8)

    // Auto-normalize scale (Mixamo FBX GLBs arrive at ~100:1 cm scale)
    const norm = autoNormalizeCharacter(root)
    if (norm.adjusted) {
      console.info(`[character-editor] Scale corrected: raw height ${norm.rawHeight.toFixed(1)} → applied ×${norm.scale.toFixed(4)}`)
    }

    // Retarget UAL1 + UAL2 if loaded
    if (charSkeleton) {
      if (ual1Loaded) {
        retargetedGroups1 = ual1Groups.map(g => retargetAnimationGroup(g, charSkeleton!, g.name + '_retargeted', scene)).filter(Boolean) as AnimationGroup[]
      }
      if (ual2Loaded) {
        retargetedGroups2 = ual2Groups.map(g => retargetAnimationGroup(g, charSkeleton!, g.name + '_retargeted', scene)).filter(Boolean) as AnimationGroup[]
      }
    }

    // Auto-play first embedded animation
    if (embeddedGroups.length > 0) {
      playAnim(embeddedGroups[0])
    }

    updateStats()
    renderAnimGrid()
  } catch (e) {
    console.error('Character load failed:', e)
    charNameEl.textContent = `Failed: ${def.name}`
  }

  setLoading(null)
}

// ── Build character list ───────────────────────────────────────────────────────
function buildCharList(filter = '') {
  const list = document.getElementById('char-list')!
  list.innerHTML = ''
  const f = filter.toLowerCase()
  for (const c of CHARACTERS) {
    if (f && !c.name.toLowerCase().includes(f) && !c.cat.includes(f)) continue
    const item = document.createElement('div')
    item.className = 'char-item' + (activeCharId === c.id ? ' active' : '')
    item.innerHTML = `
      <div class="char-thumb">${c.icon}</div>
      <div>
        <div class="char-name">${c.name}</div>
        <span class="cat-tag cat-${c.cat}">${c.cat}</span>
      </div>`
    item.addEventListener('click', () => {
      document.querySelectorAll('.char-item').forEach(el => el.classList.remove('active'))
      item.classList.add('active')
      loadCharacter(c)
    })
    list.appendChild(item)
  }
}

// ── Tab switching ─────────────────────────────────────────────────────────────
async function switchTab(pack: string) {
  activeTab = pack
  document.querySelectorAll('.anim-tab').forEach(t =>
    t.classList.toggle('active', (t as HTMLElement).dataset.pack === pack)
  )
  if (pack === 'ual1') await ensureUAL1()
  if (pack === 'ual2') await ensureUAL2()

  // Retarget if skeleton is ready but groups not yet built
    if (charSkeleton) {
    if (pack === 'ual1' && retargetedGroups1.length === 0) {
      retargetedGroups1 = ual1Groups.map(g => retargetAnimationGroup(g, charSkeleton!, g.name + '_retargeted', scene)).filter(Boolean) as AnimationGroup[]
    }
    if (pack === 'ual2' && retargetedGroups2.length === 0) {
      retargetedGroups2 = ual2Groups.map(g => retargetAnimationGroup(g, charSkeleton!, g.name + '_retargeted', scene)).filter(Boolean) as AnimationGroup[]
    }
    updateStats()
  }
  renderAnimGrid()
}

// ── Wire up controls ──────────────────────────────────────────────────────────
document.getElementById('char-search')!.addEventListener('input', (e) => buildCharList((e.target as HTMLInputElement).value))

document.querySelectorAll('.anim-tab').forEach(tab =>
  tab.addEventListener('click', () => switchTab((tab as HTMLElement).dataset.pack!))
)

const speedSlider = document.getElementById('ctrl-speed') as HTMLInputElement
const blendSlider = document.getElementById('ctrl-blend') as HTMLInputElement
speedSlider.addEventListener('input', () => {
  animSpeed = parseFloat(speedSlider.value)
  document.getElementById('val-speed')!.textContent = animSpeed.toFixed(1)
  if (currentAnim) currentAnim.speedRatio = animSpeed
})
blendSlider.addEventListener('input', () => {
  blendDuration = parseFloat(blendSlider.value)
  document.getElementById('val-blend')!.textContent = blendDuration.toFixed(2)
})

document.getElementById('btn-pause')!.addEventListener('click', () => {
  if (!currentAnim) return
  paused = !paused
  paused ? currentAnim.pause() : currentAnim.restart()
  document.getElementById('btn-pause')!.textContent = paused ? '▶ Resume' : '⏸ Pause'
})
document.getElementById('btn-stop')!.addEventListener('click', () => {
  currentAnim?.stop(); currentAnim = null
  badgeAnim.textContent = 'No Anim'; badgeAnim.className = 'topbar-badge'
  document.querySelectorAll('.anim-btn').forEach(b => b.classList.remove('active'))
  activeAnimName = ''
})

document.getElementById('btn-reset-cam')!.addEventListener('click', () => {
  camera.setTarget(new Vector3(0, 1, 0)); camera.radius = 4
  camera.alpha = -Math.PI / 2; camera.beta = Math.PI / 3
})
document.getElementById('btn-toggle-bg')!.addEventListener('click', () => {
  bgDark = !bgDark
  scene.clearColor = bgDark ? new Color4(0.05,0.06,0.09,1) : new Color4(0.8,0.82,0.9,1)
})
document.getElementById('btn-toggle-grid')!.addEventListener('click', () => {
  showGrid = !showGrid; gridMesh.isVisible = showGrid
})

// ── FPS counter ───────────────────────────────────────────────────────────────
let fpsFrames = 0
scene.onBeforeRenderObservable.add(() => {
  if (++fpsFrames % 30 === 0) fpsDisplay.textContent = `${engine.getFps().toFixed(0)} fps`
})

// ── Init ──────────────────────────────────────────────────────────────────────
buildCharList()
buildWeaponGrid()
setLoading(null)
engine.runRenderLoop(() => scene.render())
