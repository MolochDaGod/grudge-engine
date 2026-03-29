// game/steering.ts — ported from steering-motivators.js
import { Vector2 } from '@babylonjs/core/Maths/math.vector'
import type { AgentInfo } from './types'
import { headingToVector2, getAngleOriented } from './utils'
import { hotgrid, edge, FIELD_EXTENTS, GUTTER_WIDTH } from './constants'

export type Steer = { left: number; right: number; straight: number }

export function randomSteerMotivator(): Steer {
  const goStraight = 0.5
  const turnLeft = (1 - goStraight) / 2
  const turnRight = 1 - turnLeft
  const rand = Math.random()
  if (rand < turnLeft)  return { left: Math.random(), right: 0, straight: 0 }
  if (rand > turnRight) return { left: 0, right: Math.random(), straight: 0 }
  return { left: 0, right: 0, straight: Math.random() }
}

export function moveToTargetMotivator(agent: AgentInfo): Steer {
  return seekPointMotivator(agent.pos, agent.heading, agent.meshes.body.position.clone())
}

export function locateArtifactMotivator(agent: AgentInfo): Steer {
  const min = Math.min(...agent.hotGrid)
  if (agent.hotGrid[agent.gridTargetIdx] > min) {
    let start = Math.floor(Math.random() * hotgrid.ROWS * hotgrid.COLUMNS)
    let found = agent.hotGrid.indexOf(min, start)
    if (found < 0) found = agent.hotGrid.indexOf(min)
    agent.gridTargetIdx = found
  }
  const cellPos = getCellPos(agent.gridTargetIdx)
  return seekPointMotivator(agent.pos, agent.heading, { x: cellPos.x, y: 0, z: cellPos.z } as any)
}

export function seekZoneMotivator(agent: AgentInfo): Steer {
  const h = agent.heading
  const steer: Steer = { left: 0, right: 0, straight: 0 }
  if (h > 0) steer.left  = (180 - h) / 180
  else       steer.right = (180 + h) / 180
  return steer
}

export function avoidEdgeMotivator(agent: AgentInfo): Steer {
  const steer: Steer = { left: 0, right: 0, straight: 0 }
  const h    = agent.heading
  const hrad = h * (Math.PI / 180)
  let dx: number, dz: number, r: number

  switch (agent.nearEdge) {
    case edge.PLUS_X:
      if (h >= -90 && h < 90) {
        dx = FIELD_EXTENTS.xMax - agent.pos.x; r = Math.abs(dx / Math.cos(hrad))
        if (r < GUTTER_WIDTH) h > 0 ? (steer.left = 1 - r/GUTTER_WIDTH) : (steer.right = 1 - r/GUTTER_WIDTH)
      }
      break
    case edge.MINUS_X:
      if (h > 90 || h < -90) {
        dx = FIELD_EXTENTS.xMin - agent.pos.x; r = Math.abs(dx / Math.cos(hrad))
        if (r < GUTTER_WIDTH) h > 90 ? (steer.right = 1 - r/GUTTER_WIDTH) : (steer.left = 1 - r/GUTTER_WIDTH)
      }
      break
    case edge.PLUS_Z:
      if (h > 0 && h < 180) {
        dz = FIELD_EXTENTS.zMax - agent.pos.z; r = Math.abs(dz / Math.sin(hrad))
        if (r < GUTTER_WIDTH) h < 90 ? (steer.right = 1 - r/GUTTER_WIDTH) : (steer.left = 1 - r/GUTTER_WIDTH)
      }
      break
    case edge.MINUS_Z:
      if (h < 0 && h > -180) {
        dz = FIELD_EXTENTS.zMin - agent.pos.z; r = Math.abs(dz / Math.sin(hrad))
        if (r < GUTTER_WIDTH) h > -90 ? (steer.left = 1 - r/GUTTER_WIDTH) : (steer.right = 1 - r/GUTTER_WIDTH)
      }
      break
  }
  return steer
}

function seekPointMotivator(pos: any, heading: number, seekPoint: any): Steer {
  const hvec = headingToVector2(heading)
  let svec = new Vector2(seekPoint.x - pos.x, seekPoint.z - pos.z)
  svec = Vector2.Normalize(svec)
  const deg = getAngleOriented(hvec, svec) * (180 / Math.PI)
  if (deg > 0) return { left: deg / 180, right: 0, straight: 0 }
  return { left: 0, right: -deg / 180, straight: 0 }
}

function getCellPos(idx: number): { x: number; z: number } {
  const zoff = idx / hotgrid.COLUMNS
  const row  = Math.floor(zoff)
  const col  = Math.round((zoff - row) * 4)
  const half = hotgrid.CELL_SIZE / 2
  return {
    x: (hotgrid.extents.XMAX - half) - col * 3,
    z: (hotgrid.extents.ZMAX - half) - row * 3,
  }
}
