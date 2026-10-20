import { describe, expect, it } from 'vitest';
import { BASS_CLASSIC } from '@game/characters/bass/classic';
import { QUICKMAN_CLASSIC } from '@game/characters/bass/classic-quickman';
import {
  COSSACK_CLASSIC,
  GEMINI_CLASSIC,
  MRX_CLASSIC,
  SKULLMAN_CLASSIC,
  WILY_CLASSIC,
} from '@game/characters/bass/classic-looks';
import { CLASSIC_EXTRAS, skinHost, skinsOf } from '@game/characters/registry';
import { CLASSIC_SKIN_GAMES } from '@game/characters/classic/skins';
import { BASS_LOOKS } from '@content/sprites/hero-looks';
import { PALETTES, SPRITES } from '@content/sprites';
import { drawnFace } from '@game/scenes/select-grid';

// Owner addition to batch 6: the original's other Bass looks (BmdInfo.as Bass003..Bass015), cosmetic
// skins on Bass's slot in our own art.

const LOOKS = [WILY_CLASSIC, MRX_CLASSIC, COSSACK_CLASSIC, GEMINI_CLASSIC, SKULLMAN_CLASSIC];

describe("Bass's looks", () => {
  // #179: Bass.SKIN_ORDER (Bass.as 48-64; CharacterSkinMenu.as 103).
  it('sit on his slot in Bass.SKIN_ORDER, Quick Man after Dr. Cossack', () => {
    expect(skinsOf(BASS_CLASSIC)).toEqual([
      BASS_CLASSIC,
      WILY_CLASSIC,
      MRX_CLASSIC,
      COSSACK_CLASSIC,
      QUICKMAN_CLASSIC,
      GEMINI_CLASSIC,
      SKULLMAN_CLASSIC,
    ]);
    for (const d of LOOKS) {
      expect(skinHost(d)).toBe(BASS_CLASSIC);
      expect(CLASSIC_EXTRAS).toContain(d);
      expect(CLASSIC_SKIN_GAMES[d.id]).toMatch(/^Mega Man/);
    }
  });

  it('are cosmetic: Bass in every rule', () => {
    for (const d of LOOKS) {
      expect(d.movement, d.id).toEqual(BASS_CLASSIC.movement);
      expect(d.lookOf).toBe('bass');
      expect(d.damage).toEqual(BASS_CLASSIC.damage);
    }
  });

  it('each has its own head on a 16 x 13 plan, its sheet, palettes and drawn face', () => {
    for (const [id, l] of Object.entries(BASS_LOOKS)) {
      expect(l.head, id).toHaveLength(13);
      for (const r of l.head) expect(r.length, id).toBe(16);
      for (const f of Object.keys(SPRITES.bass?.frames ?? {}))
        expect(SPRITES[id]?.frames[f], `${id}/${f}`).toBeDefined();
      for (const p of [id, `${id}-water`, `${id}-charge-0`, `${id}-star-0`])
        expect(PALETTES.default[p], p).toBeDefined();
      expect(drawnFace(id)?.frame).toBe(id);
    }
  });
});
