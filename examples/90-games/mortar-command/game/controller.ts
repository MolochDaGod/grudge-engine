// game/controller.ts — ported from controllers.js
import { Vector3, Vector2, Matrix } from '@babylonjs/core/Maths/math.vector'
import { Axis } from '@babylonjs/core/Maths/math.axis'
import { Space }  from '@babylonjs/core/Maths/math.axis'
import { Ray }    from '@babylonjs/core/Culling/ray'
import type { MCScene, AgentInfo } from './types'
import {
  FRAMETHRESH_GUI, FIELD_EXTENTS, phases, edge,
  STATION_MAX_HEALTH, AGENT_MAX_SPEED, AGENT_MIN_SPEED, AGENT_MAX_HEALTH,
  MORTAR_BOOST_LIFE, AGENT_SENSOR_RADIUS,
} from './constants'
import { TERRAIN_MESH_NAME } from './tableConstants'
import { getAngle } from './utils'
import { setArtifactDetected } from './agent'
import { updateRounds, updateThePackage } from './mortars'
import { updateMines } from './mines'
import { activatorChance, activator_aging, disableMortarBoost } from './activators'
import { destroyStation, updatePowerStationGraphics, enableStationWreckage } from './station'
import { handleGameOver } from './lifecycle'
import {
  randomSteerMotivator, seekZoneMotivator, locateArtifactMotivator,
  moveToTargetMotivator, avoidEdgeMotivator,
} from './steering'

const TURN_RATE = 3  // degrees per frame

export function startAgentAnim(scene: MCScene): void {
  let frameCounter    = 0
  let modeCheckCounter = 0
  const modeCheckThresh = 10

  scene.onBeforeRenderObservable.add(() => {
    scene.gameFrame++
    updateRounds(scene)
    updateThePackage(scene)
    updateMines(scene)
    detectArtifacts(scene)

    // Animate stations
    for (const station of scene.powerStations) {
      const spinSpeed = ((STATION_MAX_HEALTH - station.health) * .01) + .01
      station.shell.rotate(Axis.Y, spinSpeed, Space.LOCAL)
    }

    // Animate activators
    for (const activator of scene.activators) {
      activator.rotator.rotate(Axis.Y, .02, Space.LOCAL)
      activator_aging(activator, scene)
    }

    if (modeCheckCounter === modeCheckThresh) {
      setModeInputs(scene)
      for (const agent of scene.agents) steeringPoll(agent)
      activatorChance(scene)
      if ((scene.gameFrame - scene.mortarBoostFrame) > MORTAR_BOOST_LIFE) disableMortarBoost(scene)
      modeCheckCounter = 0
    }

    for (const agent of scene.agents) anim(agent, scene)

    if (frameCounter === FRAMETHRESH_GUI) {
      if (scene.gameScore > scene.hiGameScore) scene.hiGameScore = scene.gameScore
      scene.onUpdateGUI?.()
      updateHUD(scene)
      frameCounter = 0
    }

    frameCounter++
    modeCheckCounter++
  })
}

function updateHUD(scene: MCScene): void {
  const s = document.getElementById('score-display')
  const h = document.getElementById('hi-score-display')
  if (s) s.textContent = String(scene.gameScore)
  if (h) h.textContent = String(scene.hiGameScore)

  if (!scene.thePackage.loaded) {
    const pct = Math.min((scene.packagePoints / 12000) * 100, 100)
    const bar = document.getElementById('innerbar')
    if (bar) bar.setAttribute('style', `width:${pct.toFixed(0)}%`)
    if (pct >= 100) {
      scene.thePackage.loaded = true
      const img = document.getElementById('package-loaded') as HTMLImageElement
      if (img) img.src = 'https://assets.grudge-studio.com/game-assets/mortar-command/textures/mortar_lit.png'
    }
  }
}

// ── Agent AI animation step ───────────────────────────────────────────────
function anim(agent: AgentInfo, scene: MCScene): void {
  const terrainMesh = scene.getMeshByName(TERRAIN_MESH_NAME)
  if (!terrainMesh) return

  // Heading update from steer
  const steer = agent.steer
  const turnAmt = TURN_RATE
  if (steer.left  > 0) agent.heading -= steer.left  * turnAmt
  if (steer.right > 0) agent.heading += steer.right * turnAmt
  if (agent.heading >  180) agent.heading -= 360
  if (agent.heading < -180) agent.heading += 360

  // Face direction
  agent.meshes.body.rotation.y = agent.heading * (Math.PI / 180)

  // Move
  drive(agent, scene)

  // Update terrain normal at current pos
  const ray = new Ray(
    new Vector3(agent.pos.x, agent.pos.y + 5, agent.pos.z),
    new Vector3(0, -1, 0),
  )
  const worldInverse = new Matrix()
  terrainMesh.getWorldMatrix().invertToRef(worldInverse)
  const localRay = Ray.Transform(ray, worldInverse)
  const pick = terrainMesh.intersects(localRay)
  if (pick.hit) {
    agent.norm = pick.getNormal(true, false) ?? new Vector3(0, 1, 0)
    agent.pos.y = pick.pickedPoint!.y + 0.5
    agent.meshes.body.position.y = agent.pos.y
  }

  // Detect near edge
  const p = agent.pos
  if      (p.x > FIELD_EXTENTS.xMax - 3) agent.nearEdge = edge.PLUS_X
  else if (p.x < FIELD_EXTENTS.xMin + 3) agent.nearEdge = edge.MINUS_X
  else if (p.z > FIELD_EXTENTS.zMax - 3) agent.nearEdge = edge.PLUS_Z
  else if (p.z < FIELD_EXTENTS.zMin + 3) agent.nearEdge = edge.MINUS_Z
  else                                    agent.nearEdge = edge.NONE
}

function drive(agent: AgentInfo, scene: MCScene): void {
  let r = AGENT_MAX_SPEED * (agent.health / AGENT_MAX_HEALTH)
  if (r < AGENT_MIN_SPEED) r = AGENT_MIN_SPEED

  const hrad  = agent.heading * (Math.PI / 180)
  const hvecx = Math.cos(hrad)
  const hvecz = Math.sin(hrad)
  const hvec  = Vector3.Normalize(new Vector3(hvecx, 0, hvecz))
  const nvec  = Vector3.Normalize(agent.norm)
  const theta = getAngle(hvec, nvec) * (180 / Math.PI)
  let inclineCoeff = theta < 45 ? 1 : theta > 135 ? 0 : (-1/90) * theta + 1.5
  if (inclineCoeff < 0) inclineCoeff = 0

  const ds = inclineCoeff * r
  const p  = agent.pos
  const tx = p.x + ds * hvecx
  const tz = p.z + ds * hvecz
  if (tx < FIELD_EXTENTS.xMax && tx > FIELD_EXTENTS.xMin) p.x = tx
  if (tz < FIELD_EXTENTS.zMax && tz > FIELD_EXTENTS.zMin) p.z = tz
  agent.meshes.body.position.x = p.x
  agent.meshes.body.position.z = p.z
}

function steeringPoll(agent: AgentInfo): void {
  let steer = { left: 0, right: 0, straight: 0 }

  if (agent.nearEdge !== edge.NONE) {
    steer = avoidEdgeMotivator(agent)
  } else {
    switch (agent.phase) {
      case phases.SEEK_ARTIFACT_ZONE:
        steer = seekZoneMotivator(agent)
        break
      case phases.LOCATE_ARTIFACT:
        steer = locateArtifactMotivator(agent)
        break
      case phases.COLLECT_ARTIFACT:
      case phases.SEEK_STATION:
        steer = moveToTargetMotivator(agent)
        break
      default:
        steer = randomSteerMotivator()
    }
  }
  agent.steer = steer
}

// ── Mode inputs (artifact/station targeting) ──────────────────────────────
function setModeInputs(scene: MCScene): void {
  for (const agent of scene.agents) {
    if (agent.artifactCollected) hasArtifactMode(agent, scene)
    else                         getArtifactMode(agent, scene)
  }
}

function hasArtifactMode(agent: AgentInfo, scene: MCScene): void {
  const station = hasReachedStation(agent, scene)
  if (station) {
    station.health -= agent.payloadMass
    if (station.health <= 0) {
      enableStationWreckage(scene, station)
      destroyStation(station, scene)
      if (scene.powerStations.length === 0) handleGameOver(scene)
    } else {
      updatePowerStationGraphics(station, scene)
      scene.getSoundByName?.('station-damage')?.play()
    }
    agent.phase = phases.SEEK_ARTIFACT_ZONE; agent.targetSelected = false
    agent.targetName = 'none'; agent.artifactCollected = false; agent.payloadMass = 0
    agent.meshes.cargo.isVisible = false
    agent.hotGrid.fill(0)
  } else if (!targetStationExists(agent, scene)) {
    selectStation(agent, scene)
  }
}

function getArtifactMode(agent: AgentInfo, scene: MCScene): void {
  const inZone = agent.pos.x < -12.5
  if (!inZone) {
    agent.phase = phases.SEEK_ARTIFACT_ZONE
    return
  }
  const reached = hasReachedVisibleArtifact(agent, scene)
  if (reached) {
    agent.artifactCollected = true; agent.payloadMass = reached.type.mass
    agent.meshes.cargo.isVisible = true; agent.targetSelected = false
    agent.targetName = 'none'; agent.phase = phases.SEEK_STATION
    scene.getSoundByName?.('ore')?.play()
    const idx = scene.artifacts.indexOf(reached)
    if (idx > -1) { scene.artifacts[idx].meshes.shell.dispose(); scene.artifacts.splice(idx, 1) }
    import('./agent').then(({ addArtifact }) => addArtifact(scene))
    selectStation(agent, scene)
  } else {
    const visible = scene.artifacts.filter(a => a.detected)
    if (visible.length > 0) {
      agent.phase = phases.COLLECT_ARTIFACT
      const pick = visible[Math.floor(Math.random() * visible.length)]
      agent.targetName = pick.name; agent.targetSelected = true
    } else {
      agent.phase = phases.LOCATE_ARTIFACT
    }
  }
}

function hasReachedStation(agent: AgentInfo, scene: MCScene) {
  for (const s of scene.powerStations) {
    if (Vector3.Distance(agent.pos, s.pos) < s.interactRadius) return s
  }
  return null
}

function targetStationExists(agent: AgentInfo, scene: MCScene): boolean {
  return scene.powerStations.some(s => s.name === agent.targetName)
}

function selectStation(agent: AgentInfo, scene: MCScene): void {
  if (scene.powerStations.length === 0) return
  const s = scene.powerStations[Math.floor(Math.random() * scene.powerStations.length)]
  agent.targetName = s.name; agent.targetSelected = true
}

function hasReachedVisibleArtifact(agent: AgentInfo, scene: MCScene) {
  for (const a of scene.artifacts) {
    if (a.detected && Vector3.Distance(agent.pos, a.pos) < a.interactRadius) return a
  }
  return null
}

// ── Detect artifacts by proximity ─────────────────────────────────────────
function detectArtifacts(scene: MCScene): void {
  for (const artifact of scene.artifacts) {
    for (const agent of scene.agents) {
      if (Vector3.Distance(agent.pos, artifact.pos) < AGENT_SENSOR_RADIUS) {
        if (!artifact.detected) setArtifactDetected(artifact, true)
        // update hotgrid
        const gx = Math.floor((artifact.pos.x - (-24.55)) / 3)
        const gz = Math.floor((artifact.pos.z - (-13.5))  / 3)
        const idx = gz * 4 + gx
        if (idx >= 0 && idx < 36) agent.hotGrid[idx]++
        break
      }
    }
  }
}
