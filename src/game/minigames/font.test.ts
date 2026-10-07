import { beforeEach, describe, expect, it } from 'vitest';
import { fontDef } from '@content/sprites/font';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { MINIGAMES } from '.';
import { duelHarness, type DuelHarness } from './ryu/harness';
import { ArtScroll } from './ryu/creatures';
import { READY_FRAMES } from './ryu/scene';
import { jungleHarness, type JungleHarness } from './bill/harness';
import { CARD_ANIM } from './bill/card';
import { DEATH_FRAMES } from './bill/commando';
import { SOPHIA_MINIGAME } from './sophia';
import { MARIO } from '../characters/mario';
import { underworldHarness, type UnderworldHarness } from './sophia/harness';
import { CUTSCENE_FRAMES, JASON_AT, LEAP_AT, TOUCH_AT, cutLines } from './sophia/cutscene';
import type { Guardian } from './sophia/guardian';
import type { PlutoniumBoss } from './sophia/plutonium';
import type { World } from '../world/world';

// Mini games draw their rules cards and hint banners in the bitmap font, which silently drops
// any character it has no glyph for (QA 0.4.8: the Shadow Duel card's semicolon vanished, so it
// read "AIR TO CLING KEEP HOLDING"). Every such line uses only characters the font has.

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

/** The characters of `line` the font cannot draw (letters as the font draws them: upper case). */
function missing(line: string): string[] {
  return [...line.toUpperCase()].filter((ch) => ch !== ' ' && !fontDef.frames[ch]);
}

/** Every string the scene draws in one frame. */
function drawn(h: DuelHarness | JungleHarness | UnderworldHarness): string[] {
  const out: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text: (...args: Parameters<Renderer['text']>) => void out.push(args[1]),
  });
  h.game.scenes.render(r);
  return out;
}

describe('the bitmap font draws every mini game line', () => {
  it('has a semicolon in the style of its colon and comma', () => {
    const semi = fontDef.frames[';'] as string[];
    const colon = fontDef.frames[':'] as string[];
    const comma = fontDef.frames[','] as string[];
    expect(semi).toBeDefined();
    expect(semi.slice(0, 3)).toEqual(colon.slice(0, 3)); // the colon's upper dot
    expect(semi.slice(4)).toEqual(comma.slice(4)); // the comma below
  });

  for (const [hero, def] of Object.entries(MINIGAMES))
    it(`${hero}: the title and rules card`, () => {
      for (const line of [def.title, ...def.rules]) expect(missing(line), line).toEqual([]);
    });

  for (const scheme of ['keyboard', 'touch'] as const)
    it(`ryu (${scheme}): the cutscene, READY, the climb and art banners and the win banner`, () => {
      const h = duelHarness({ scheme, assets: STUB_ASSETS, keep: true });
      const lines: string[] = [];
      h.step([], 30);
      lines.push(...drawn(h));
      h.tap('jump'); // skip the cutscene
      lines.push(...drawn(h));
      h.step([], READY_FRAMES);
      h.scene.clingTaught = false;
      (h.scene as unknown as { teachClimb(): void }).teachClimb();
      lines.push(...(h.scene.banner?.lines ?? []), ...drawn(h));
      const p = h.scene.player;
      h.world.spawn(
        new ArtScroll(p.centerX, p.body.y + p.body.h, (q) =>
          (h.scene as unknown as { gotArt(q: unknown): void }).gotArt(q),
        ),
      );
      h.step([], 10);
      lines.push(...(h.scene.banner?.lines ?? []), ...drawn(h));
      (h.scene as unknown as { bossDown(): void }).bossDown();
      h.step();
      lines.push(...(h.scene.banner?.lines ?? []), ...drawn(h));
      expect(lines.length).toBeGreaterThan(10);
      const bad = lines.filter((l) => missing(l).length > 0);
      expect(bad).toEqual([]);
    });

  for (const scheme of ['keyboard', 'touch'] as const)
    it(`sophia (${scheme}): the title and rules, the cutscene, the cavern, the HUD, the guardian, the run back, the Plutonium Boss, the win banner and GAME OVER`, () => {
      const lines: string[] = [SOPHIA_MINIGAME.title, ...SOPHIA_MINIGAME.rules];
      for (const t of [0, TOUCH_AT, LEAP_AT, JASON_AT, CUTSCENE_FRAMES - 1]) lines.push(...cutLines(t));
      const h = underworldHarness({ scheme, assets: STUB_ASSETS, keep: true });
      h.step([], 5);
      lines.push(...drawn(h));
      h.tap('jump');
      h.step([], 5);
      lines.push(...drawn(h));
      // The dungeon, its guardian and the way out.
      const d = underworldHarness({ scheme, assets: STUB_ASSETS, keep: true, skipCutscene: true });
      d.step([], 5);
      lines.push(...drawn(d));
      d.td.warpTo('guardian', 16, 80);
      d.step(['right'], 20);
      lines.push(...drawn(d));
      const g = d.scene.guardian as Guardian;
      g.phase = 'core';
      g.hp = 1;
      g.hurt(d.td, 5, 'up');
      d.step([], 5);
      lines.push(...drawn(d));
      d.td.warpTo('exit', 120, 32);
      d.step(['up'], 40);
      lines.push(...drawn(d));
      // The Plutonium Boss's chamber.
      const b = underworldHarness({
        scheme,
        assets: STUB_ASSETS,
        keep: true,
        startInBoss: true,
        tankHero: MARIO,
      });
      b.step([], 70);
      lines.push(...(b.scene.banner?.lines ?? []), ...drawn(b));
      const boss = b.scene.plutonium as PlutoniumBoss;
      boss.phase = 'core';
      boss.hp = 1;
      boss.invuln = 0;
      boss.hit({ kind: 'buster', amount: 2, owner: null, dirX: 1 }, b.scene.area as World);
      b.step([], 100);
      lines.push(...drawn(b));
      const h2 = underworldHarness({ scheme, assets: STUB_ASSETS, keep: true, skipCutscene: true });
      h2.scene.lives = 1;
      h2.td.hero.hurt(h2.td, 99, 'down');
      h2.step([], 200);
      lines.push(...drawn(h2));
      expect(lines).toEqual(
        expect.arrayContaining([
          'GUN',
          'POW',
          'THE GUARDIAN',
          'THE GUARDIAN FALLS!',
          'JASON RUNS BACK',
          'PLUTONIUM BOSS',
          'THE PLUTONIUM BOSS FALLS!',
          'GAME OVER',
        ]),
      );
      const bad = lines.filter((l) => missing(l).length > 0);
      expect(bad).toEqual([]);
    });

  for (const scheme of ['keyboard', 'touch'] as const)
    it(`bill (${scheme}): the stage card (with the Konami code), play, the win banner and GAME OVER`, () => {
      const h = jungleHarness({ scheme, assets: STUB_ASSETS, keep: true });
      const lines: string[] = [];
      h.step([], 5);
      lines.push(...drawn(h));
      for (const a of [
        'up',
        'up',
        'down',
        'down',
        'left',
        'right',
        'left',
        'right',
        'attack',
        'jump',
      ] as const) {
        h.step([a]);
        h.step();
      }
      h.step([], CARD_ANIM);
      lines.push(...drawn(h));
      h.step(['jump']);
      h.step([], 60);
      lines.push(...drawn(h));
      const j = h.jungle;
      j.phase = 'lair';
      j.heartDown();
      h.step([], 200);
      lines.push(...(h.scene.banner ?? []), ...drawn(h));
      const h2 = jungleHarness({ scheme, assets: STUB_ASSETS, keep: true, skipCard: true });
      h2.step([], 60);
      h2.jungle.rest = 0;
      h2.jungle.bill.kill(h2.jungle);
      h2.step([], DEATH_FRAMES + 5);
      lines.push(...(h2.scene.banner ?? []), ...drawn(h2));
      expect(lines).toEqual(
        expect.arrayContaining(['REST 29', 'STAGE 1', 'GAME OVER', "RED FALCON'S HEART BURSTS!"]),
      );
      const bad = lines.filter((l) => missing(l).length > 0);
      expect(bad).toEqual([]);
    });
});
