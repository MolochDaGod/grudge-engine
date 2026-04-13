#!/usr/bin/env node
/**
 * scripts/verify-r2-assets.mjs
 *
 * Verifies that all assets referenced in the canonical asset manifest
 * actually exist on the R2 CDN (assets.grudge-studio.com).
 *
 * Usage:
 *   node scripts/verify-r2-assets.mjs
 *   node scripts/verify-r2-assets.mjs --verbose
 *   node scripts/verify-r2-assets.mjs --fix    # attempt to upload missing
 */

const CDN = 'https://assets.grudge-studio.com'
const VERBOSE = process.argv.includes('--verbose')

// ── Asset manifest (duplicated here to avoid TS import) ──────────────────────

const RACE_MODEL_CDN = `${CDN}/models/characters/rts`
const ANIM_CDN = `${CDN}/models/races/animations`
const MODULAR_CDN = `${CDN}/models/races`

const RACE_MODELS = {
  human:     'Knight_Male.glb',
  barbarian: 'BarbarianGlad.glb',
  undead:    'berserker.glb',
  orc:       'King.glb',
  elf:       'Wizard.glb',
  dwarf:     'Viking_Male.glb',
}

const ANIM_MANIFEST = {
  idle:                        'idle',
  walk:                        'swagger_walk',
  run:                         'dancing_running_man',
  crouch_idle:                 'crouch_idle',
  crouch_enter:                'standing_to_crouch',
  crouch_exit:                 'cover_to_stand',
  climb:                       'climbing_ladder',
  sit:                         'male_sitting_pose',
  sword_attack_1:              'sword_and_shield_attack',
  sword_attack_2:              'sword_and_shield_attack_1',
  sword_attack_3:              'sword_and_shield_attack_2',
  sword_slash_1:               'sword_and_shield_slash',
  sword_slash_2:               'sword_and_shield_slash_1',
  sword_powerup:               'sword_and_shield_power_up',
  sword_cast:                  'sword_and_shield_casting',
  club_combo:                  'one_hand_club_combo',
  sword_combo:                 'one_hand_sword_combo',
  greatsword_slash_1:          'great_sword_slash',
  greatsword_slash_2:          'great_sword_slash_1',
  two_hand_club_combo:         'two_hand_club_combo',
  two_hand_sword_combo:        'two_hand_sword_combo',
  dual_weapon_combo:           'dual_weapon_combo',
  spell_cast:                  'spell_casting',
  cast_1h:                     'standing_1h_cast_spell_01',
  cast_2h:                     'standing_2h_cast_spell_01',
  magic_area_1:                'standing_2h_magic_area_attack_01',
  magic_area_2:                'standing_2h_magic_area_attack_02',
  magic_attack_1:              'standing_2h_magic_attack_01',
  magic_attack_2:              'standing_2h_magic_attack_03',
  magic_attack_3:              'standing_2h_magic_attack_04',
  kick:                        'kick',
  throw:                       'throw_object',
  disarmed:                    'disarmed',
  battlecry:                   'standing_taunt_battlecry',
  dance_bboy:                  'bboy_hip_hop_move',
  dance_hiphop:                'hip_hop_dancing',
  dance_silly:                 'silly_dancing',
  dance_spin:                  'northern_soul_spin_combo',
  react:                       'reacting',
  pat:                         'patting',
  look_around:                 'look_over_shoulder',
}

const MODULAR_BODIES = {
  BaseMale:   'BaseMale.glb',
  BaseFemale: 'BaseFemale.glb',
  Bambi:      'Bambi.glb',
  VillHelm:   'VillHelm.glb',
  Enchanter:  'Enchanter.glb',
}

// ── Build URL list ───────────────────────────────────────────────────────────

function buildAssetUrls() {
  const urls = []

  for (const [race, file] of Object.entries(RACE_MODELS)) {
    urls.push({ category: 'race-model', key: race, url: `${RACE_MODEL_CDN}/${file}` })
  }

  for (const [key, filename] of Object.entries(ANIM_MANIFEST)) {
    urls.push({ category: 'animation', key, url: `${ANIM_CDN}/${filename}.glb` })
  }

  for (const [id, file] of Object.entries(MODULAR_BODIES)) {
    urls.push({ category: 'modular-body', key: id, url: `${MODULAR_CDN}/${file}` })
  }

  return urls
}

// ── Verify ───────────────────────────────────────────────────────────────────

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return {
      ok: res.ok,
      status: res.status,
      size: parseInt(res.headers.get('content-length') || '0', 10),
      type: res.headers.get('content-type') || 'unknown',
    }
  } catch (err) {
    return { ok: false, status: 0, size: 0, type: 'error', error: err.message }
  }
}

async function main() {
  const assets = buildAssetUrls()
  console.log(`\n🔍  Verifying ${assets.length} assets on R2 CDN...\n`)

  const results = { ok: [], missing: [], error: [] }
  const CONCURRENCY = 10
  let totalSize = 0

  // Process in batches
  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    const batch = assets.slice(i, i + CONCURRENCY)
    const checks = await Promise.all(
      batch.map(async (asset) => {
        const result = await checkUrl(asset.url)
        return { ...asset, ...result }
      })
    )

    for (const r of checks) {
      if (r.ok) {
        results.ok.push(r)
        totalSize += r.size
        if (VERBOSE) console.log(`  ✅  ${r.category}/${r.key}  (${(r.size / 1024).toFixed(0)} KB)`)
      } else if (r.status === 404) {
        results.missing.push(r)
        console.log(`  ❌  MISSING  ${r.category}/${r.key}`)
        console.log(`              ${r.url}`)
      } else {
        results.error.push(r)
        console.log(`  ⚠️   ERROR ${r.status}  ${r.category}/${r.key}`)
        console.log(`              ${r.url}`)
      }
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ✅ Found:   ${results.ok.length}`)
  console.log(`  ❌ Missing: ${results.missing.length}`)
  console.log(`  ⚠️  Errors:  ${results.error.length}`)
  console.log(`  📦 Total:   ${(totalSize / 1024 / 1024).toFixed(1)} MB on CDN`)
  console.log(`${'═'.repeat(60)}`)

  if (results.missing.length > 0) {
    console.log(`\n📋  Missing assets to upload:`)
    for (const m of results.missing) {
      const r2Key = m.url.replace(`${CDN}/`, '')
      console.log(`    npx wrangler r2 object put grudge-assets/${r2Key} --file=<local-path> --content-type="model/gltf-binary" --remote`)
    }
    console.log(`\n  Or use: node scripts/upload-to-r2.mjs <local-dir> <r2-prefix>`)
  }

  if (results.missing.length === 0 && results.error.length === 0) {
    console.log(`\n🎉  All ${results.ok.length} assets verified on R2!\n`)
  }

  process.exit(results.missing.length > 0 ? 1 : 0)
}

main()
