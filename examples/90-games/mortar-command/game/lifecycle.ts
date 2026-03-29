// game/lifecycle.ts — ported from lifecycle.js
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { Rectangle }              from '@babylonjs/gui/2D/controls/rectangle'
import { TextBlock }              from '@babylonjs/gui/2D/controls/textBlock'
import { Button }                 from '@babylonjs/gui/2D/controls/button'
import type { MCScene }           from './types'
import { GAME_PHASES, GAME_LEVELS, ARTIFACT_TYPES, LEVELS_MODE } from './constants'
import { placePowerStations, addPowerStations, removeStationWreckage } from './station'
import { deployMines, placeMines, clearMines } from './mines'
import { addActivator, clearActivators } from './activators'
import { destroyAgent, addArtifact } from './agent'
import { mcAsset } from './tableConstants'

export function handleLevelComplete(scene: MCScene): void {
  if (LEVELS_MODE === 'manual') {
    scene.gameLevel = scene.gameLevel < GAME_LEVELS.length - 1 ? scene.gameLevel + 1 : 0
  } else {
    scene.gameLevel++
  }
  addLevelControl(scene)
}

export function handleGameOver(scene: MCScene): void {
  clearMines(scene)
  clearActivators(scene)
  scene.gameScores.push(scene.gameScore)
  scene.hiGameScore = Math.max(...scene.gameScores)
  scene.onUpdateGUI?.()
  addGameOverControl(scene)
}

function addGameOverControl(scene: MCScene): void {
  scene.gamePhase = GAME_PHASES.gameOver
  const ui = AdvancedDynamicTexture.CreateFullscreenUI('gameOverUI')

  const panel = new Rectangle()
  panel.width = '300px'; panel.height = '140px'; panel.cornerRadius = 10
  panel.color = 'white'; panel.thickness = 3; panel.background = '#C70039'; panel.alpha = 0.75
  ui.addControl(panel)

  const text = new TextBlock()
  text.text = 'GAME OVER'; text.color = 'white'; text.fontSize = 24; text.top = '-40px'
  ui.addControl(text)

  const btn = Button.CreateSimpleButton('retry', 'Insert Coin')
  btn.width = '120px'; btn.height = '40px'; btn.top = '20px'
  btn.cornerRadius = 10; btn.color = 'white'; btn.thickness = 2
  btn.background = '#514c59'; btn.hoverCursor = 'pointer'; btn.isPointerBlocker = true
  btn.onPointerClickObservable.add(() => {
    scene.getSoundByName?.('insertCoin')?.play()
    removeStationWreckage(scene)
    panel.dispose(); text.dispose(); btn.dispose(); ui.dispose()
    scene.gameLevel = 0; scene.gameScore = 0; scene.gameNumber++
    addPowerStations(scene); scene.mortarBoost = false
    addLevelControl(scene)
    scene.thePackage.loaded = false; scene.packagePoints = 0
    const bar = document.getElementById('innerbar')
    if (bar) bar.setAttribute('style', 'width:0%')
    const img = document.getElementById('package-loaded') as HTMLImageElement
    if (img) img.src = mcAsset('textures/mortar_unlit.png')
    scene.activator_score_thresh_set = false; scene.activator_last_score = 0
  })
  ui.addControl(btn)
}

export function addLevelControl(scene: MCScene): void {
  if (!scene.gameStarted) {
    placePowerStations(scene)
    placeMines(scene)
    scene.gameStarted = true
  }

  scene.gamePhase = GAME_PHASES.startLevel
  const lvl = scene.gameLevel

  // Clear old agents
  for (const a of [...scene.agents]) destroyAgent(a, scene)
  scene.agents = []
  scene.agentsDestroyed = 0

  // Clear artifacts
  for (const a of scene.artifacts) a.meshes.shell.dispose()
  scene.artifacts = []

  // Clear fire targets
  for (const m of scene.fireTargets) m.dispose()
  scene.fireTargets = []

  // Level data
  const levelData = GAME_LEVELS[lvl] ?? GAME_LEVELS[GAME_LEVELS.length - 1]
  const ui = AdvancedDynamicTexture.CreateFullscreenUI('levelUI')

  const panel = new Rectangle()
  panel.width = '400px'; panel.height = '180px'; panel.cornerRadius = 10
  panel.color = 'white'; panel.thickness = 3; panel.background = '#615c69'; panel.alpha = 0.75
  ui.addControl(panel)

  const t1 = new TextBlock()
  t1.text = `Level ${lvl + 1}`; t1.color = 'white'; t1.fontSize = 24; t1.top = '-50px'
  ui.addControl(t1)

  const t2 = new TextBlock()
  t2.text = levelData.tip; t2.color = 'white'; t2.fontSize = 14; t2.top = '-10px'
  ui.addControl(t2)

  const btn = Button.CreateSimpleButton('play', 'Play')
  btn.width = '90px'; btn.height = '40px'; btn.top = '45px'
  btn.cornerRadius = 10; btn.color = 'white'; btn.thickness = 2
  btn.background = '#514c59'; btn.hoverCursor = 'pointer'; btn.isPointerBlocker = true
  btn.onPointerClickObservable.add(() => {
    scene.getSoundByName?.('play')?.play()
    panel.dispose(); t1.dispose(); t2.dispose(); btn.dispose(); ui.dispose()
    scene.gamePhase = GAME_PHASES.playing

    // Spawn agents for this level
    for (const _h of levelData.agents) addAgentDeferred(scene)

    // Spawn artifacts
    const { small, med, large } = levelData.artifacts
    for (let i = 0; i < small; i++)  addArtifact(scene, { ...ARTIFACT_TYPES.small })
    for (let i = 0; i < med; i++)    addArtifact(scene, { ...ARTIFACT_TYPES.medium })
    for (let i = 0; i < large; i++)  addArtifact(scene, { ...ARTIFACT_TYPES.large })

    // Update HUD
    const ld = document.getElementById('level-display')
    if (ld) ld.textContent = String(lvl + 1)
    scene.onUpdateGUI?.()
  })
  ui.addControl(btn)
}

// Defer agent spawning so terrain is ready
function addAgentDeferred(scene: MCScene): void {
  // Import lazily to avoid circular references at module init time
  import('./agent').then(({ addAgent }) => addAgent(scene))
}
