import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { LevelScene } from '@game/scenes/level';
import { Pickup, type PickupKind } from '@game/entities/objects/pickup';
import { HeroItem } from '@game/entities/objects/hero-item';
import { MEGAMAN } from '@game/characters/megaman';
import { SOPHIA } from '@game/characters/sophia';
import { CHARACTERS } from '@game/characters/registry';
import { heroStart } from '@game/items/heroes';
import { has } from '@game/items/flags';
import { decodeSaveCode, encodeSaveCode } from '@game/save/save-code';
import { loadSave, migrateSave, newSave, type SaveFile } from '@game/save/save-files';
import { wrapPrompt } from '@game/tutorial/stage-prompts';
import { TIP_LOCK_FRAMES } from '@game/tutorial/tips';
import { EXPLAINER_IDS, explainerText, EXPLAINER_COLS } from '@game/tutorial/explainers';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { file, makeGame, useStorage, type H } from './heroes-harness';
import { skipGreeting, startStage } from './stage-bot';

// One-time pickup explainers (0.4.46, roadmap #20 and #24): the first time a hero touches each kind
// of pickup (Mega Man's health, weapon energy and E-tank; Samus's energy and missile packs; the
// other heroes' own drops) a short tip holds the game until OK, in training and in the campaign,
// once per save file. The file keeps them (SaveFile.explained), and so does a save code. Mega Man's
// weapons come only once he wears the Helmet: a weapon out of its block touched bare-headed is
// the Helmet instead, and the Helmet's own explainer says so.

useStorage();

/** File 1 with `hero` freed and played, open, then straight into 1-1. */
function campaign(hero: string, over: Partial<SaveFile> = {}): { h: H; level: () => LevelScene } {
  const h = makeGame();
  const def = CHARACTERS.find((c) => c.id === hero);
  if (!def) throw new Error(hero);
  const start = heroStart(def);
  file({
    character: hero,
    freed: ['mario', hero],
    tutorials: ['mario', hero],
    powerState: start.powerState,
    hp: start.hp,
    kit: start.kit,
    ...over,
  });
  h.game.openFile(1);
  // 1-2 (1-1 first plays Luigi's run).
  h.game.startLevel(getLevel('1-2'), { mode: 'stand' });
  h.step();
  expect(h.top()).toBeInstanceOf(LevelScene);
  return { h, level: () => h.top() as LevelScene };
}

/** A pickup of `kind` laid at the hero's feet in `scene`'s world. */
function touch(scene: { world: LevelScene['world'] }, kind: PickupKind): void {
  const p = scene.world.player;
  scene.world.spawn(new Pickup(p.body.x + (p.body.w >> 1), p.body.y + p.body.h, kind, true));
}

/** OK once the hold's lock is over. */
function ok(h: H): void {
  h.idle(TIP_LOCK_FRAMES + 2);
  h.tap('jump');
}

describe('pickup explainers', () => {
  it('every explainer is one or two lines, at the narrowest box', () => {
    expect(EXPLAINER_IDS.length).toBeGreaterThanOrEqual(20);
    for (const id of EXPLAINER_IDS) {
      const [hero, what] = id.split(':') as [string, string];
      const text = explainerText(hero, what);
      expect(text, id).toBeTruthy();
      const lines = wrapPrompt(text as string, EXPLAINER_COLS);
      expect(lines.length, `${id}: ${lines.join(' / ')}`).toBeLessThanOrEqual(2);
      expect(text, 'no level numbers').not.toMatch(/\b\d-\d\b/);
    }
    // Mega Man's and Samus's pickups, and the other heroes' own drops.
    for (const id of [
      'megaman:health-small',
      'megaman:health-large',
      'megaman:weapon-small',
      'megaman:weapon-large',
      'megaman:e-tank',
      'megaman:helmet',
      'samus:energy-small',
      'samus:energy-large',
      'samus:missile-pack',
      'link:magic-small',
      'link:heart-small',
      'simon:heart-small',
      'simon:heart-large',
      'ryu:ninpo-small',
      'bill:capsule',
      'sophia:triple-ammo',
    ])
      expect(EXPLAINER_IDS).toContain(id);
  });

  it('campaign: the first E-tank holds the game until OK, read out; the next one does not', () => {
    const { h, level } = campaign('megaman');
    const l = level();
    touch(l, 'e-tank');
    h.until(() => l.explainers.frozen, 200);
    expect(l.explainers.current?.id).toBe('megaman:e-tank');
    expect(h.said.at(-1)).toMatch(/E-TANK!.*OK to continue\./);
    // The world stands still while it holds (the clock too).
    const frame = l.world.frame;
    const time = l.world.time;
    h.idle(60);
    expect(l.world.frame).toBe(frame);
    expect(l.world.time).toBe(time);
    expect(h.game.tips.current?.said).toMatch(/E-TANK!/);
    ok(h);
    expect(l.explainers.frozen).toBe(false);
    h.step();
    expect(l.world.frame).toBeGreaterThan(frame);
    expect(l.world.player.scratch.etanks).toBe(1);
    // Saved on the file at once.
    expect(loadSave(1)?.explained).toEqual(['megaman:e-tank']);
    // A second one: no hold.
    touch(l, 'e-tank');
    h.idle(5);
    expect(l.explainers.frozen).toBe(false);
    expect(l.world.player.scratch.etanks).toBe(2);
    // Another kind: its own explainer.
    l.world.player.hp = 10;
    touch(l, 'health-small');
    h.until(() => l.explainers.frozen, 200);
    expect(l.explainers.current?.id).toBe('megaman:health-small');
    ok(h);
    expect(loadSave(1)?.explained).toEqual(['megaman:e-tank', 'megaman:health-small']);
  });

  it('shows once per file: it survives a reload, and another file still gets it', () => {
    campaign('samus');
    {
      const { h, level } = campaign('samus');
      touch(level(), 'energy-small');
      h.until(() => level().explainers.frozen, 200);
      ok(h);
    }
    // The game reloaded (a new Game over the same storage).
    const { h, level } = campaign('samus', { explained: loadSave(1)?.explained ?? [] });
    expect(h.game.explained).toEqual(['samus:energy-small']);
    touch(level(), 'energy-small');
    h.idle(5);
    expect(level().explainers.frozen).toBe(false);
    // Missile packs are still new.
    touch(level(), 'missile-pack');
    h.until(() => level().explainers.frozen, 200);
    expect(level().explainers.current?.id).toBe('samus:missile-pack');
  });

  it('round-trips through a save code; a code from before them loads with none', () => {
    const s = migrateSave(
      { ...newSave(1, 'samus'), explained: ['samus:energy-small', 'megaman:e-tank', 'someday:new-thing'] },
      1,
    ) as SaveFile;
    const back = decodeSaveCode(encodeSaveCode(s), 2);
    expect(back.ok).toBe(true);
    if (back.ok) expect([...(back.save.explained ?? [])].sort()).toEqual([...(s.explained ?? [])].sort());
    // A version-1 code (0.4.44's), written before explainers: it still loads, with none seen.
    const old = decodeSaveCode('JJC1Y-G3SXD-HGQ5J-F25AA-DC5MQ-M2FFX-09PZ', 3);
    expect(old.ok).toBe(true);
    if (old.ok) {
      expect(old.version).toBe(1);
      expect(old.save.character).toBe('megaman');
      expect(old.save.explained ?? []).toEqual([]);
      expect(old.save.cleared).toContain('2-1');
    }
    // An old file without the field loads with none, and keeps only strings.
    expect(migrateSave({ ...newSave(1, 'mario'), explained: undefined }, 1)?.explained ?? []).toEqual([]);
    expect(migrateSave({ ...newSave(1, 'mario'), explained: ['a:b', 3] }, 1)?.explained).toEqual(['a:b']);
  });

  it('training: the first health pellet in Mega Man’s stage is explained, and it counts for the file', () => {
    const { h, stage } = startStage('megaman');
    const s: HeroStageScene = stage();
    skipGreeting(h);
    // Let the first tip go.
    h.until(() => s.director.frozen, 60);
    ok(h);
    s.world.player.hp = 10;
    touch(s, 'health-small');
    h.until(() => s.explainers.frozen, 200);
    // The training's box stays out of the way while it holds.
    expect(s.director.box()).toBeNull();
    expect(s.touchLabels()).toMatchObject({ jump: 'OK', start: 'MENU' });
    ok(h);
    expect(s.explainers.frozen).toBe(false);
    expect(h.game.explained).toContain('megaman:health-small');
    expect(loadSave(1)?.explained).toContain('megaman:health-small');
  });

  it('classic play (no campaign file) shows none', () => {
    const h = makeGame();
    h.game.state.character = MEGAMAN;
    h.game.startLevel(getLevel('1-1'), { mode: 'stand' });
    h.step();
    const l = h.top() as LevelScene;
    touch(l, 'e-tank');
    h.idle(5);
    expect(l.explainers.frozen).toBe(false);
    expect(h.game.explained).toEqual([]);
  });
});

describe("Mega Man's weapons come only with the Helmet (campaign)", () => {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(24));
  // A power block over the start (column 4, row 9) holding the Saw Disc for him.
  rows[9] = '....M' + '.'.repeat(19);
  const level = parseTextMap(
    [
      'id: t',
      'time: 300',
      'start: 4,12',
      '',
      '[tiles]',
      ...rows,
      '#'.repeat(24),
      '#'.repeat(24),
      '',
      '[hero-items]',
      '4 9 megaman=saw-disc',
    ].join('\n'),
  );
  const kit = (helmet: boolean) => ({ ...heroStart(MEGAMAN).kit, ...(helmet ? { helmet: 1 } : {}) });

  it('a bare-headed Mega Man gets the Helmet from a weapon block', () => {
    const items: string[] = [];
    runSim({
      level,
      character: MEGAMAN,
      script: { steps: [] },
      maxFrames: 40,
      state: { kit: kit(false), hp: 28, powerState: 'full' },
      controller: (w, f) => {
        if (f === 0) {
          w.useHeroItems(level.heroItems ?? []);
          w.strikeBlock(4, 9, w.player, true);
        }
        if (f === 30) for (const e of w.entities) if (e instanceof HeroItem) items.push(e.item);
        return [];
      },
    });
    expect(items).toEqual(['helmet']);
  });

  it('a weapon already out, touched after a hit knocked the Helmet off, is the Helmet instead', () => {
    const r = runSim({
      level,
      character: MEGAMAN,
      script: { steps: [] },
      maxFrames: 400,
      state: { kit: kit(true), hp: 28, powerState: 'full' },
      controller: (w, f) => {
        if (f === 0) {
          w.useHeroItems(level.heroItems ?? []);
          w.strikeBlock(4, 9, w.player, true);
        }
        // The Saw Disc is out; a hit takes the Helmet before he reaches it.
        if (f === 30) {
          expect(w.entities.some((e) => e instanceof HeroItem && e.item === 'saw-disc')).toBe(true);
          w.player.invuln = 0;
          w.hurtPlayer(w.player, 1);
          expect(w.player.scratch.helmet).toBe(0);
        }
        // Then he touches it (as World's collision would).
        if (f === 31) {
          const it = w.entities.find((e): e is HeroItem => e instanceof HeroItem && e.alive);
          if (it) {
            it.destroy();
            w.takeHeroItem(w.player, it);
          }
        }
        return [];
      },
      until: (w) => !w.entities.some((e) => e instanceof HeroItem && e.alive) && w.frame > 40,
    });
    const p = r.world.player;
    expect(p.scratch.helmet).toBe(1);
    expect(has(p, 'saw-disc')).toBe(false);
  });

  it("the Helmet's rule is his alone: Sophia III's Crusher, out before a hit to Normal, stays the Crusher", () => {
    const sophiaLevel = parseTextMap(
      [
        'id: t',
        'time: 300',
        'start: 4,12',
        '',
        '[tiles]',
        ...rows,
        '#'.repeat(24),
        '#'.repeat(24),
        '',
        '[hero-items]',
        '4 9 sophia=crusher',
      ].join('\n'),
    );
    const r = runSim({
      level: sophiaLevel,
      character: SOPHIA,
      script: { steps: [] },
      maxFrames: 400,
      state: { kit: heroStart(SOPHIA).kit, hp: 1, powerState: 'big' },
      controller: (w, f) => {
        if (f === 0) {
          w.useHeroItems(sophiaLevel.heroItems ?? []);
          w.strikeBlock(4, 9, w.player, true);
        }
        if (f === 30) {
          expect(w.entities.some((e) => e instanceof HeroItem && e.item === 'crusher')).toBe(true);
          w.player.invuln = 0;
          w.hurtPlayer(w.player, 1);
          expect(w.player.powerState).toBe('small');
        }
        if (f === 31) {
          const it = w.entities.find((e): e is HeroItem => e instanceof HeroItem && e.alive);
          if (it) {
            it.destroy();
            w.takeHeroItem(w.player, it);
          }
        }
        return [];
      },
      until: (w) => !w.entities.some((e) => e instanceof HeroItem && e.alive) && w.frame > 40,
    });
    expect(r.world.player.powerState).toBe('fire');
  });

  it('the Helmet explains the rule the first time (campaign)', () => {
    const { h, level: l } = campaign('megaman');
    const world = l().world;
    world.useHeroItems([{ x: 20, y: 9, items: { megaman: 'grow' } }]);
    world.takeHeroItem(world.player, new HeroItem(20, 9, 'helmet', 'megaman'));
    h.until(() => l().explainers.frozen, 200);
    expect(l().explainers.current?.id).toBe('megaman:helmet');
    expect(l().explainers.current?.lines.join(' ')).toMatch(/WEAPON/);
  });
});
