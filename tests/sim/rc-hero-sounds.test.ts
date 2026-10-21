import { afterEach, describe, expect, it, vi } from 'vitest';
import { sfx } from '@content/sfx/sfx';
import { defaultSettings } from '@engine/save/settings';
import type { AudioSink } from '@engine/audio/audio-manager';
import { CHARACTERS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { CLASSIC_HERO_SOUNDS, heroSound } from '@game/characters/classic/sounds';
import { LevelScene } from '@game/scenes/level';
import { makeGame, useStorage, type H } from './heroes-harness';

// G-072 and G-074 (docs/classic/RC_AUDIT_0.5.0.md, gap re-check): Bill's own hit and kill
// sounds, and the last weapons that borrowed another hero's sound get their own.

useStorage();
afterEach(() => vi.restoreAllMocks());

const SFX_IDS = new Set(sfx.map((s) => s.id));
const hero = (id: string) => CHARACTERS.find((c) => c.id === id) as CharacterDef;

function audioGame(): H & { sounds: string[] } {
  const h = makeGame({ deps: { settings: defaultSettings(), applySettings: () => {} } });
  const sounds: string[] = [];
  (h.audio as unknown as AudioSink).sfx = vi.fn((id: string) => void sounds.push(id));
  return { ...h, sounds };
}

describe("G-072: Bill's own hit and kill sounds", () => {
  it('Bill has a hit and a kill sound of his own, both ours', () => {
    expect(heroSound({ id: 'bill' }, 'hit', 'hurt-enemy')).toBe('bill-hit');
    expect(heroSound({ id: 'bill' }, 'kill')).toBe('bill-kill');
    for (const id of ['bill-hit', 'bill-kill']) expect(SFX_IDS.has(id), id).toBe(true);
    for (const [h, s] of Object.entries(CLASSIC_HERO_SOUNDS))
      for (const id of [s.hit, s.kill]) if (id) expect(SFX_IDS.has(id), `${h}: ${id}`).toBe(true);
  });

  it("a Classic run's Bill hit sounds as his; the campaign keeps the shared one", () => {
    const h = audioGame();
    h.game.devClassicGame(hero('bill'), '1-1', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    expect(w.hitSound({ kind: 'bomb', amount: 1, owner: w.player, dirX: 1 })).toBe('bill-hit');
    const c = audioGame();
    c.game.newGame(hero('bill'), '1-1');
    c.until(() => c.top() instanceof LevelScene, 600);
    const cw = (c.top() as LevelScene).world;
    expect(cw.hitSound({ kind: 'bomb', amount: 1, owner: cw.player, dirX: 1 })).toBe('hurt-enemy');
  });
});
