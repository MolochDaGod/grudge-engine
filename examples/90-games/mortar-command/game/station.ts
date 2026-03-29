// game/station.ts — ported from station.js
import { MeshBuilder }   from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Vector3 }       from '@babylonjs/core/Maths/math.vector'
import { Animation }     from '@babylonjs/core/Animations/animation'
import { Color3 }        from '@babylonjs/core/Maths/math.color'
import type { MCScene, PowerStation } from './types'
import { STATION_SIZE, STATION_INTERACT_COEFF, STATION_MAX_HEALTH, GUN_POSITION } from './constants'
import { getGroundElevation } from './utils'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'

// Station layout on the table
const STATION_POSITIONS = [
  { x: 18,  z: 10  },
  { x: 18,  z: 0   },
  { x: 18,  z: -10 },
  { x: 13,  z: 5   },
  { x: 13,  z: -5  },
]

function makePowerStation(name: string, scene: MCScene) {
  const CoT = new TransformNode(name + '_powerStationRoot', scene)
  const rmat = scene.getMaterialByName('stationPylons_Lit')
  const perimeterRadius = STATION_INTERACT_COEFF * STATION_SIZE
  const pylons: Mesh[] = []

  for (let i = 0; i < 12; i++) {
    const pylon = MeshBuilder.CreateCylinder(`${name}_pylon_${i}`,
      { diameterBottom: 0.2, diameterTop: 0.07, height: 0.5, tessellation: 8 }, scene) as Mesh
    pylon.convertToFlatShadedMesh()
    const theta = i * (Math.PI / 6)
    pylon.position = new Vector3(Math.cos(theta) * perimeterRadius, 0, Math.sin(theta) * perimeterRadius)
    pylon.material = rmat
    pylon.parent = CoT
    pylons.push(pylon)
  }

  const pedestal = MeshBuilder.CreateCylinder(`${name}_pedestal`,
    { diameterTop: 0, tessellation: 16 }, scene) as Mesh
  pedestal.scaling = new Vector3(0.8, 0.15, 0.8)
  pedestal.position = new Vector3(0, -.8, 0)
  pedestal.material = scene.getMaterialByName('pedestalMat')
  pedestal.parent = CoT

  // Truncated icosahedron core (using sphere as simpler stand-in for type safety)
  const core = MeshBuilder.CreatePolyhedron(name,
    { type: 11, size: 0.6 * STATION_SIZE }, scene) as Mesh
  core.material = scene.getMaterialByName('powerCoreMat')
  core.parent = CoT

  const innerCore = MeshBuilder.CreateSphere(`${name}_innerCore`,
    { diameter: 1.2 }, scene) as Mesh
  innerCore.scaling = new Vector3(1.2, 1.2, 1.2)
  innerCore.material = scene.getMaterialByName('innerPowerCoreMat')
  innerCore.parent = core

  // Pulse animation on inner core emissive colour
  const anim = new Animation(`${name}_stationAnim`, 'material.emissiveColor', 30,
    Animation.ANIMATIONTYPE_COLOR3, Animation.ANIMATIONLOOPMODE_CYCLE)
  anim.setKeys([
    { frame: 0,  value: new Color3(0, 0, 0) },
    { frame: 30, value: new Color3(1, 1, 0) },
    { frame: 60, value: new Color3(0, 0, 0) },
  ])
  innerCore.animations = [anim]
  scene.beginAnimation(innerCore, 0, 60, true)

  return { CoT, pylons, shell: core, innerCore, particles: null }
}

export function addPowerStation(scene: MCScene, x: number, z: number, id: number): void {
  const name = 'station_' + id
  const ps   = makePowerStation(name, scene)
  const y    = getGroundElevation(x, z, scene)
  const mesh = ps.CoT
  mesh.position = new Vector3(x, y + 0.85, z)

  for (const pylon of ps.pylons) {
    const pyGE = getGroundElevation(
      pylon.position.x + mesh.position.x,
      pylon.position.z + mesh.position.z,
      scene,
    )
    pylon.position.y = pyGE - ps.CoT.position.y
  }

  const station: PowerStation = {
    name, id,
    pos:         mesh.position,
    mesh:        ps.CoT,
    shell:       ps.shell,
    innerCore:   ps.innerCore,
    pylons:      ps.pylons,
    particles:   ps.particles,
    health:      STATION_MAX_HEALTH,
    interactRadius: STATION_INTERACT_COEFF * STATION_SIZE,
  }

  scene.powerStations.push(station)
  scene.liveStations = scene.powerStations.length
}

export function addPowerStations(scene: MCScene): void {
  scene.powerStations = []
  for (let i = 0; i < STATION_POSITIONS.length; i++) {
    addPowerStation(scene, STATION_POSITIONS[i].x, STATION_POSITIONS[i].z, i)
  }
  scene.liveStations = scene.powerStations.length
}

export function placePowerStations(scene: MCScene): void {
  for (const station of scene.powerStations) {
    const y = getGroundElevation(station.pos.x, station.pos.z, scene)
    station.mesh.position.y = y + 0.85
    for (const pylon of station.pylons) {
      const pyGE = getGroundElevation(
        pylon.position.x + station.mesh.position.x,
        pylon.position.z + station.mesh.position.z,
        scene,
      )
      pylon.position.y = pyGE - station.mesh.position.y
    }
  }
}

export function updatePowerStationGraphics(station: PowerStation, scene: MCScene): void {
  const damagedMat = scene.getMaterialByName('stationPylons_Dark')
  const damage = STATION_MAX_HEALTH - station.health
  for (let i = 0; i < damage; i++) station.pylons[i].material = damagedMat
  const s = (0.78 / 11) * damage + 1.2
  station.innerCore.scaling = new Vector3(s, s, s)
}

export function destroyStation(station: PowerStation, scene: MCScene, handleUpdateGUIinfo?: () => void): void {
  station.shell.setEnabled(false)
  station.innerCore.setEnabled(false)
  const idx = scene.powerStations.indexOf(station)
  if (idx > -1) scene.powerStations.splice(idx, 1)
  scene.liveStations = scene.powerStations.length
  scene.wreckedStations.push(station)
  if (handleUpdateGUIinfo) handleUpdateGUIinfo()
}

export function enableStationWreckage(scene: MCScene, station: PowerStation): void {
  // Show broken appearance
  station.shell.material = scene.getMaterialByName('powerCoreBrokenMat')
  station.innerCore.material = scene.getMaterialByName('innerPowerCoreBrokenMat')
  station.shell.setEnabled(true)
  station.innerCore.setEnabled(true)
}

export function repairOneStation(scene: MCScene): void {
  const wreck = scene.wreckedStations.find(w => w.shell.isEnabled())
  if (!wreck) return
  const { id, mesh } = wreck
  wreck.shell.dispose()
  wreck.innerCore.dispose()
  const idx = scene.wreckedStations.indexOf(wreck)
  scene.wreckedStations.splice(idx, 1)
  addPowerStation(scene, mesh.position.x, mesh.position.z, id)
}

export function removeStationWreckage(scene: MCScene): void {
  for (const w of scene.wreckedStations) {
    w.shell.dispose()
    w.innerCore.dispose()
  }
  scene.wreckedStations = []
}

export function makeBase(scene: MCScene): void {
  // Firing tower at GUN_POSITION
  const base = MeshBuilder.CreateBox('base', { size: 1.5 }, scene) as Mesh
  base.position = new Vector3(GUN_POSITION.x, GUN_POSITION.y - 0.5, GUN_POSITION.z)
  base.material = scene.getMaterialByName('pedestalMat')
  const barrel = MeshBuilder.CreateCylinder('barrel',
    { diameter: 0.3, height: 2 }, scene) as Mesh
  barrel.position = new Vector3(GUN_POSITION.x - 1, GUN_POSITION.y + 0.5, GUN_POSITION.z)
  barrel.rotation.z = Math.PI / 2
  barrel.material = scene.getMaterialByName('agentMat')
}
