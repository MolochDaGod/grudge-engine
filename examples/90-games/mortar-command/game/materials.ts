// game/materials.ts — ported from materials.js
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture }          from '@babylonjs/core/Materials/Textures/texture'
import { Color3, Color4 }   from '@babylonjs/core/Maths/math.color'
import type { MCScene }     from './types'
import { mcAsset }          from './tableConstants'

export const roundParticlecolors = {
  particles_color1:    new Color4(1, 1, 1, 1),
  particles_color2:    new Color4(.4, .3, 0.2, 1),
  particles_colorDead: new Color4(0.3, 0.1, 0, 0),
}
export const roundParticlecolorsBoost = {
  particles_color1:    new Color4(.3, 1, .3, 1),
  particles_color2:    new Color4(.4, .7, 0.2, 1),
  particles_colorDead: new Color4(0.1, 0.3, 0, 0),
}
export const blastParticlesProps = {
  minSize: .05, maxSize: .3, maxLifeTime: .003,
  color1:    new Color4(.6, .2, .2, 1),
  color2:    new Color4(.3, .1, .3, 1),
  colorDead: new Color4(0.3, 0, 0, 0),
  emitRate: 300, minEmitPower: 1, maxEmitPower: 6,
}
export const blastParticlesPropsBoost = {
  minSize: .05, maxSize: .32, maxLifeTime: .005,
  color1:    new Color4(.7, .1, .1, 1),
  color2:    new Color4(.3, .1, .3, 1),
  colorDead: new Color4(0, 0.1, 0, 0),
  emitRate: 800, minEmitPower: 1, maxEmitPower: 20,
}

export function createMaterials(scene: MCScene): void {
  const m = (name: string) => new StandardMaterial(name, scene)

  const activatorbasemat = m('activatorbasemat')
  activatorbasemat.diffuseColor = new Color3(.2, .2, .2)

  const abc1 = m('activatorbaseconemat_1'); abc1.diffuseColor = new Color3(.5, .5, .5)
  const abc2 = m('activatorbaseconemat_2'); abc2.diffuseColor = new Color3(.9, .9, .9)
  const abc3 = m('activatorbaseconemat_3'); abc3.diffuseColor = new Color3(.8, 0, 1)
  const abc4 = m('activatorbaseconemat_4'); abc4.diffuseColor = new Color3(.2, 1, .2)

  const holomat = m('holomat')
  holomat.backFaceCulling = false
  holomat.alpha = 1
  holomat.opacityTexture  = new Texture(mcAsset('textures/scanlines_op.png'), scene)
  holomat.emissiveTexture = new Texture(mcAsset('textures/scanlines.png'), scene)
  holomat.diffuseTexture  = new Texture(mcAsset('textures/scanlines.png'), scene)

  const iconmat_mine = m('iconmat_mines')
  iconmat_mine.emissiveTexture = new Texture(mcAsset('textures/mines.png'), scene)
  iconmat_mine.backFaceCulling = false
  iconmat_mine.opacityTexture  = new Texture(mcAsset('textures/mines.png'), scene)

  const iconmat_cross = m('iconmat_cross')
  iconmat_cross.emissiveTexture = new Texture(mcAsset('textures/cross.png'), scene)
  iconmat_cross.backFaceCulling = false
  iconmat_cross.opacityTexture  = new Texture(mcAsset('textures/cross.png'), scene)

  const iconmat_bolt = m('iconmat_bolt')
  iconmat_bolt.emissiveTexture = new Texture(mcAsset('textures/bolt.png'), scene)
  iconmat_bolt.backFaceCulling = false
  iconmat_bolt.opacityTexture  = new Texture(mcAsset('textures/bolt.png'), scene)

  const mineCoreMat = m('mineCoreMat')
  mineCoreMat.diffuseColor  = new Color3(1, 1, .6)
  mineCoreMat.emissiveColor = new Color3(.1, .1, .1)

  const mineRingMat = m('mineRingMat'); mineRingMat.diffuseColor = new Color3(.25, .25, .25)
  const mineRingLitMat = m('mineRingLitMat'); mineRingLitMat.diffuseColor = new Color3(1, .2, 1)

  const blastMat = m('blastMat')
  blastMat.diffuseColor = new Color3(1, .97, .67); blastMat.alpha = 0.3

  const mineBlastMat = m('mineBlastMat')
  mineBlastMat.diffuseColor = new Color3(1, .17, .97); mineBlastMat.alpha = 0.3

  const psPylonsMat = m('stationPylons_Lit')
  psPylonsMat.diffuseColor  = new Color3(1, 1, 1)
  psPylonsMat.emissiveColor = new Color3(.1, .2, .1)

  const psPylonsDarkMat = m('stationPylons_Dark'); psPylonsDarkMat.diffuseColor = new Color3(0, 0, 0)

  m('agentMat')

  const pedestalMat = m('pedestalMat'); pedestalMat.diffuseColor = new Color3(0.2, 0.3, .2)

  const powerCoreMat = m('powerCoreMat')
  powerCoreMat.diffuseColor = new Color3(0.8, 1, 0.8); powerCoreMat.alpha = 0.7

  const powerCoreBrokenMat = m('powerCoreBrokenMat')
  powerCoreBrokenMat.diffuseColor  = new Color3(0.2, .4, 0.25)
  powerCoreBrokenMat.backFaceCulling = false

  const innerPowerCoreMat = m('innerPowerCoreMat')
  innerPowerCoreMat.diffuseColor  = new Color3(1, 1, 1)
  innerPowerCoreMat.emissiveColor = new Color3(0, 0, 0)

  const innerPowerCoreBrokenMat = m('innerPowerCoreBrokenMat')
  innerPowerCoreBrokenMat.diffuseColor = new Color3(.5, .5, .08)

  const artifactCoreMat = m('artifactCoreMat'); artifactCoreMat.diffuseColor = new Color3(.7, .7, .7)

  const artifactShellMat = m('artifactShellMat')
  artifactShellMat.emissiveColor = Color3.Gray(); artifactShellMat.alpha = 0.1; artifactShellMat.wireframe = true

  m('mortarMat')
  m('packageMat')

  const bulletMat = m('bulletMat'); bulletMat.emissiveColor = new Color3(1, 1, 1)

  const reticleMat = m('reticleMat')
  reticleMat.diffuseTexture = new Texture(mcAsset('textures/reticle_small.png'), scene)
  reticleMat.diffuseTexture.hasAlpha = true
  reticleMat.zOffset = -2

  const damageMinorMat    = m('damageMinorMat');    damageMinorMat.diffuseColor    = new Color3(1, 1, 0)
  const damageMajorMat    = m('damageMajorMat');    damageMajorMat.diffuseColor    = new Color3(1, .55, 0)
  const damageCriticalMat = m('damageCriticalMat'); damageCriticalMat.diffuseColor = new Color3(1, 0, 0)

  const healthColors = [
    new Color3(.76,.76,1), new Color3(.57,.57,1), new Color3(.37,.37,1),
    new Color3(.18,.18,1), new Color3(0,0,1),     new Color3(0,0,.86),
    new Color3(0,0,.75),   new Color3(0,0,.63),   new Color3(0,0,.51),
    new Color3(0,0,.39),   new Color3(0,0,.27),
  ]
  healthColors.forEach((c, i) => {
    const mat = m(`agentHealth${i}`); mat.diffuseColor = c
  })
}

export function getAgentMat(scene: MCScene, health: number): StandardMaterial {
  const idx = Math.floor(health / 10)
  return scene.getMaterialByName(`agentHealth${idx}`) as StandardMaterial
}
