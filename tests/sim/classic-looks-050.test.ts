import { describe, expect, it } from 'vitest';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import type { Action } from '@engine/input/actions';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import type { CharacterDef } from '@game/characters/character';
import { CLASSIC_EXTRAS, CHARACTERS, skinHost, skinsOf } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { RYU } from '@game/characters/ryu';
import { MARIO_CLASSIC } from '@game/characters/mario/classic';
import { LINK_CLASSIC, SWORD_DAMAGE } from '@game/characters/link/classic';
import {
  ZELDA_GB_CLASSIC,
  ZELDA_NES_CLASSIC,
  ZELDA_SNES_CLASSIC,
  ZELDA_SWORD,
} from '@game/characters/link/classic-zelda';
import { LINK_ARROW, LinkShot, ZELDA_ARROW } from '@game/characters/link/classic-weapons';
import { BASS_CLASSIC, BASS_CLASSIC_PROFILE } from '@game/characters/bass/classic';
import { QUICKMAN_CLASSIC, QUICKMAN_CLASSIC_PROFILE } from '@game/characters/bass/classic-quickman';
import { MEGAMAN_CLASSIC_PROFILE } from '@game/characters/megaman/classic';
import { HAGGLEMAN_CLASSIC } from '@game/characters/ryu/classic-haggleman';
import { CLASSIC_SLASH_FRAMES, RYU_CLASSIC, slashLive } from '@game/characters/ryu/classic';
import { LUIGI3_CLASSIC, MARIO3_CLASSIC } from '@game/characters/mario/classic-looks';
import { CLASSIC_SKIN_GAMES } from '@game/characters/classic/skins';
import { PALETTES, SPRITES } from '@content/sprites';
import { drawnFace } from '@game/scenes/select-grid';
import { parseTextMap } from '@game/level/textmap';
import { ScriptedInput } from '@game/sim/headless';
import { World } from '@game/world/world';
import { Bowser } from '@game/entities/enemies/bowser';
import { classicMaxHp } from '@game/rules/classic-enemies';

// G-050..G-053: Classic mode's new looks, skins on their heroes' slots with the original's rules
// (SkinDescriptions.as), in our own art.

const LOOKS = [
  ZELDA_NES_CLASSIC,
  ZELDA_SNES_CLASSIC,
  ZELDA_GB_CLASSIC,
  QUICKMAN_CLASSIC,
  HAGGLEMAN_CLASSIC,
  MARIO3_CLASSIC,
  LUIGI3_CLASSIC,
];

const level = () =>
  parseTextMap(
    [
      'id: t',
      'time: 300',
      'start: 4,12',
      '',
      '[tiles]',
      ...Array(13).fill('.'.repeat(32)),
      '#'.repeat(32),
      '#'.repeat(32),
    ].join('\n'),
  );

function world(def: CharacterDef): World {
  return new World(
    level(),
    {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
      rules: 'classic',
    },
    newGameState(def, null, 'classic'),
  );
}

function run(w: World, n: number, hold: (f: number) => Action[] = () => []): void {
  const input = new ScriptedInput({ steps: [] });
  for (let f = 0; f < n; f++) {
    input.setHeld(hold(f));
    input.next();
    w.update([input]);
  }
}

describe('G-050..G-053 the looks are skins on their slots', () => {
  it('each sits on its hero, in the original skin order, as a Classic-only def', () => {
    expect(skinsOf(LINK)).toEqual([LINK, ZELDA_NES_CLASSIC, ZELDA_SNES_CLASSIC, ZELDA_GB_CLASSIC]);
    expect(skinsOf(BASS_CLASSIC)).toContain(QUICKMAN_CLASSIC);
    expect(skinsOf(RYU)).toEqual([RYU, HAGGLEMAN_CLASSIC]);
    expect(skinsOf(MARIO)).toEqual([MARIO, MARIO3_CLASSIC]);
    expect(skinsOf(LUIGI)).toContain(LUIGI3_CLASSIC);
    for (const d of LOOKS) {
      expect(d.rules, d.id).toBe('classic');
      expect(CLASSIC_EXTRAS, d.id).toContain(d);
      expect(CHARACTERS, d.id).not.toContain(d);
      expect(skinHost(d).id, d.id).toBe(d.lookOf);
      expect(CLASSIC_SKIN_GAMES[d.id], d.id).toBeTruthy();
    }
  });

  it('every look draws from art and palettes that exist, and has its own drawn face', () => {
    for (const d of LOOKS) {
      const w = world(d);
      run(w, 2);
      const s = d.sprite(w.player, 0, false);
      expect(SPRITES[s.sheet]?.frames[s.frame], `${d.id} ${s.sheet}/${s.frame}`).toBeDefined();
      expect(PALETTES.default[s.palette ?? ''], `${d.id} ${s.palette}`).toBeDefined();
      expect(drawnFace(d.id)?.frame, d.id).toBe(d.id);
      expect(SPRITES['select-faces']?.frames[d.id], d.id).toHaveLength(24);
    }
    // Every power state's palette too.
    for (const look of ['zelda-nes', 'zelda-snes', 'zelda-gb'])
      for (const t of ['', '-blue', '-red']) expect(PALETTES.default[`${look}${t}`], look + t).toBeDefined();
    for (const p of [
      'quickman',
      'quickman-water',
      'haggleman',
      'mario3',
      'mario3-fire',
      'luigi3',
      'luigi3-fire',
    ])
      expect(PALETTES.default[p], p).toBeDefined();
    for (let i = 0; i < 4; i++) expect(PALETTES.default[`quickman-star-${i}`]).toBeDefined();
  });
});

describe('G-050 Princess Zelda', () => {
  it('her sword is 150 / 225 / 350, Link keeps his', () => {
    const w = world(ZELDA_NES_CLASSIC);
    const p = w.player;
    const melee = ZELDA_NES_CLASSIC.behaviour.meleeDamage as NonNullable<
      CharacterDef['behaviour']['meleeDamage']
    >;
    for (const state of ['small', 'big', 'fire'] as const) {
      p.powerState = state;
      expect(melee(p, null as never).amount).toBe(ZELDA_SWORD[state]);
    }
    expect(ZELDA_SWORD).toEqual({ small: 150, big: 225, fire: 350 });
    expect(SWORD_DAMAGE).toEqual({ small: 200, big: 275, fire: 400 });
    expect(LINK_CLASSIC.behaviour.meleeDamage?.(world(LINK_CLASSIC).player, null as never).amount).toBe(200);
  });

  it('her arrows are 400 and go on through what they defeat', () => {
    expect(ZELDA_ARROW).toMatchObject({ amount: 400, pierceDefeat: true });
    const z = LinkShot.fire(world(ZELDA_SNES_CLASSIC).player, 'forward', true);
    expect(z.spec.amount).toBe(400);
    expect(z.spec.pierceDefeat).toBe(true);
    const l = LinkShot.fire(world(LINK_CLASSIC).player, 'forward', true);
    expect(l.spec).toBe(LINK_ARROW);
  });
});

describe('G-051 Quick Man', () => {
  it('walks 1.3 times as fast, the high jump, no double jump and no dash', () => {
    expect(QUICKMAN_CLASSIC_PROFILE.maxWalk).toBe(Math.round(BASS_CLASSIC_PROFILE.maxWalk * 1.3));
    expect(QUICKMAN_CLASSIC_PROFILE.jump).toEqual(MEGAMAN_CLASSIC_PROFILE.jump);
    expect(QUICKMAN_CLASSIC_PROFILE.airJumps).toBe(0);
    expect(QUICKMAN_CLASSIC_PROFILE.slide).toBeUndefined();
    expect(QUICKMAN_CLASSIC.movement).toBe(QUICKMAN_CLASSIC_PROFILE);
  });

  it('in play: no second jump in the air', () => {
    const w = world(QUICKMAN_CLASSIC);
    run(w, 4);
    run(w, 14, (f) => (f < 3 || (f > 8 && f < 11) ? ['jump'] : []));
    expect(w.player.airJumpsLeft).toBe(0);
    const vy = w.player.body.vy;
    expect(vy).toBeGreaterThan(-0x05355);
  });
});

describe('G-052 Haggle Man', () => {
  it('his sword is live one 45 ms step sooner', () => {
    const r = world(RYU_CLASSIC).player;
    const h = world(HAGGLEMAN_CLASSIC).player;
    expect(slashLive(r)).toEqual([CLASSIC_SLASH_FRAMES - 2, CLASSIC_SLASH_FRAMES - 7]);
    expect(slashLive(h)).toEqual([CLASSIC_SLASH_FRAMES, CLASSIC_SLASH_FRAMES - 4]);
  });

  it('in play: the sword box is out on the press frame', () => {
    const liveAt = (def: CharacterDef) => {
      const w = world(def);
      run(w, 4);
      for (let f = 1; f <= 14; f++) {
        run(w, 1, () => (f === 1 ? ['attack'] : []));
        if (w.player.activeMelee) return f;
      }
      return -1;
    };
    expect(liveAt(HAGGLEMAN_CLASSIC)).toBe(1);
    expect(liveAt(RYU_CLASSIC)).toBe(3);
  });
});

describe('G-053 the small-crouch looks', () => {
  it('small Mario in his SMB3 look ducks; in his own look he does not', () => {
    const duck = (def: CharacterDef) => {
      const w = world(def);
      run(w, 4);
      run(w, 6, () => ['down']);
      return w.player.crouching;
    };
    expect(world(MARIO3_CLASSIC).player.powerState).toBe('small');
    expect(duck(MARIO3_CLASSIC)).toBe(true);
    expect(duck(LUIGI3_CLASSIC)).toBe(true);
    expect(duck(MARIO_CLASSIC)).toBe(false);
  });

  it('a look plays as its hero where a rule names him (Bowser fights Mario)', () => {
    const hp = (def: CharacterDef) => {
      const w = world(def);
      const b = new Bowser(0, 0);
      return classicMaxHp(b, w);
    };
    expect(hp(MARIO3_CLASSIC)).toBe(hp(MARIO_CLASSIC));
  });

  it("the older looks count as their heroes too: Peach as Luigi for Bowser's hit points", async () => {
    const { PEACH_CLASSIC } = await import('@game/characters/peach/classic');
    const { LUIGI_CLASSIC } = await import('@game/characters/luigi/classic');
    const { PIT_CLASSIC, DARKPIT_CLASSIC } = await import('@game/characters/pit/classic');
    const v = await import('@game/characters/megaman/classic-variants');
    const pm = await import('@game/characters/protoman/classic');
    expect(PEACH_CLASSIC.lookOf).toBe('luigi');
    expect(PIT_CLASSIC.lookOf).toBe('samus');
    expect(DARKPIT_CLASSIC.lookOf).toBe('samus');
    for (const d of [
      v.ROCK_CLASSIC,
      v.ROKKO_CLASSIC,
      v.CUTMAN_CLASSIC,
      pm.PROTOMAN_CLASSIC,
      pm.BREAKMAN_CLASSIC,
    ])
      expect(d.lookOf, d.id).toBe('megaman');
    const hp = (def: CharacterDef) => classicMaxHp(new Bowser(0, 0), world(def));
    expect(hp(PEACH_CLASSIC)).toBe(hp(LUIGI_CLASSIC));
  });
});

describe('#179: looks ride Yoshi as their heroes', () => {
  it("a look's mount Special is its hero's: Bass's looks fire his buster, Fire SMB3 Mario and Luigi throw fireballs", async () => {
    const { mountSpecial } = await import('@game/characters/classic/yoshi-mount');
    const { WILY_CLASSIC, SKULLMAN_CLASSIC } = await import('@game/characters/bass/classic-looks');
    const at = (def: CharacterDef, power: string) => {
      const p = world(def).player;
      p.powerState = power;
      return mountSpecial(def, p);
    };
    for (const d of [WILY_CLASSIC, SKULLMAN_CLASSIC, QUICKMAN_CLASSIC]) {
      expect(at(d, 'small'), d.id).toBe(at(BASS_CLASSIC, 'small'));
      expect(at(d, 'small'), d.id).toBe('attack');
      expect(at(d, 'fire'), d.id).toBe('own');
    }
    for (const d of [MARIO3_CLASSIC, LUIGI3_CLASSIC]) {
      expect(at(d, 'fire'), d.id).toBe('attack');
      expect(at(d, 'small'), d.id).toBe('none');
    }
  });
});
