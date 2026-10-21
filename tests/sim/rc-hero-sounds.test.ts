import { afterEach, describe, expect, it, vi } from 'vitest';
import { sfx } from '@content/sfx/sfx';
import { defaultSettings } from '@engine/save/settings';
import type { AudioSink } from '@engine/audio/audio-manager';
import { CHARACTERS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { CLASSIC_HERO_SOUNDS, heroSound } from '@game/characters/classic/sounds';
import { LevelScene } from '@game/scenes/level';
import type { InputFrame } from '@engine/input/input-manager';
import { fireWeapon, type MMFire, type MMWeaponId } from '@game/characters/megaman/classic-weapons';
import { ClassicBomb } from '@game/characters/samus/classic-bomb';
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

describe("G-074: no weapon borrows another hero's sound", () => {
  const level = (id: string) => {
    const h = audioGame();
    h.game.devClassicGame(hero(id), '1-1', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    return { h, w: (h.top() as LevelScene).world };
  };
  const idle = { held: () => false, pressed: () => false } as unknown as InputFrame;

  it("Mega Man's weapons each sound as their own", () => {
    const want: [MMWeaponId, string][] = [
      ['hard-knuckle', 'mm-knuckle'],
      ['pharaoh-shot', 'mm-pharaoh'],
      ['flame-blast', 'mm-flame'],
      ['magma-bazooka', 'mm-magma'],
      ['water-shield', 'mm-water'],
      ['screw-crusher', 'mm-screw'],
    ];
    for (const [id, sound] of want) {
      const { h, w } = level('megaman');
      const f: MMFire = {
        p: w.player,
        world: w,
        input: idle,
        energy: () => 28,
        spend: () => true,
        has: () => true,
      };
      h.sounds.length = 0;
      expect(fireWeapon(f, id), id).toBe(true);
      expect(h.sounds, id).toContain(sound);
      for (const old of ['kick', 'buster', 'fireball', 'swim']) expect(h.sounds, id).not.toContain(old);
      expect(SFX_IDS.has(sound), sound).toBe(true);
    }
    for (const id of ['mm-water-throw', 'mm-rush', 'mm-arm']) expect(SFX_IDS.has(id), id).toBe(true);
  });

  it("Samus's bomb blast is hers, not the shared bump", () => {
    const { h, w } = level('samus');
    const b = w.player.body;
    w.spawn(new ClassicBomb(b.x + (b.w >> 1), b.y + (b.h >> 1), w.player));
    h.sounds.length = 0;
    for (let i = 0; i < 80; i++) h.step();
    expect(h.sounds).toContain('samus-bomb');
    expect(h.sounds).not.toContain('bump');
  });

  it("Ryu's sword is his own swish", () => {
    const { h } = level('ryu');
    h.idle(10);
    h.sounds.length = 0;
    h.tap('attack');
    h.idle(4);
    expect(h.sounds).toContain('ng-sword');
    expect(h.sounds).not.toContain('sword');
    expect(SFX_IDS.has('ng-sword')).toBe(true);
  });
});
