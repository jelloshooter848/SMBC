import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import type { Dir } from '@game/map/rules';
import { FileSelectScene } from '@game/scenes/file-select';
import { WorldMapScene } from '@game/scenes/world-map';
import { LevelScene } from '@game/scenes/level';
import { PauseScene } from '@game/scenes/pause';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { CardScene, CARD_GUARD_FRAMES, MessageScene } from '@game/scenes/message';
import { MirrorRaceScene } from '@game/minigames/luigi/race';
import type { MiniGameResult } from '@game/minigames';
import { Partner } from '@game/entities/objects/partner';
import { Captive } from '@game/entities/objects/captive';
import { Bowser } from '@game/entities/enemies/bowser';
import { OpeningScene } from '@game/story/opening';
import { BowserSpellScene } from '@game/story/bowser-spell';
import { LuigiRunsScene } from '@game/story/luigi-runs';
import { beat, STORY_REV } from '@game/story/beats';
import {
  BOWSER_SPELL_LAST,
  BOWSER_SPELL_PAGES,
  CASTLE_PAGES,
  castleRemark,
  freedTalk,
  gateScript,
  LUIGI_RUNS_PAGE,
  OPENING_BURST,
  OPENING_TOAD_PAGES,
  PARTNERS,
  STORY_TOAD_PAGES,
  WELCOMES,
  WORLD1_PAGES,
  type Page,
} from '@game/story/script';
import { loadSave } from '@game/save/save-files';
import { draw, makeGame, useStorage } from './heroes-harness';
import { ALL_STORY } from './story-seen';

// A new file's Chapter 1 start, end to end (0.4.23, docs/STORY.md 2.1-2.4): the real Game,
// driven with button presses and a few shortcuts (Pause → Skip tutorial for 1-0, a level's exit
// event for its flagpole, the hero set down by the villager, the pipe and the axe, Luigi's race
// reported won). Every story scene shows once, in the script's order, and no text moves on
// without a press.

useStorage();

/** What a story text on screen is, by the script's own pages (null: not a story text). */
function classify(lines: readonly string[] | null | undefined): string | null {
  if (!lines) return null;
  const is = (pages: readonly Page[]) => pages.some((p) => JSON.stringify(p) === JSON.stringify(lines));
  if (is([OPENING_BURST, ...OPENING_TOAD_PAGES])) return 'opening';
  if (is(STORY_TOAD_PAGES)) return 'greeting';
  if (is([...BOWSER_SPELL_PAGES, BOWSER_SPELL_LAST])) return 'spell';
  if (is(WORLD1_PAGES)) return 'toad-world-1';
  if (is([LUIGI_RUNS_PAGE])) return 'luigi-runs';
  if (is(PARTNERS.villager?.pages ?? [])) return 'villager';
  if (is(freedTalk('luigi', 'MARIO'))) return 'freed-talk';
  if (lines.includes('LUIGI IS FREE!')) return 'freed-card';
  if (is([castleRemark('1-4', 'MARIO') ?? []])) return 'remark';
  const g1 = gateScript(1, 'MARIO');
  if (is(g1?.bowser ?? [])) return 'gate-cutaway';
  if (is(g1?.toad ?? [])) return 'gate-toad';
  if (is(g1?.reminder ?? [])) return 'gate-reminder';
  if (is(WELCOMES['smb-2']?.pages ?? [])) return 'welcome-2';
  // Captive Luigi's own talk before his race (free-hero.ts captiveDialogue).
  if (lines[0] === 'LUIGI:') return 'captive';
  return `text: ${lines.filter(Boolean).join(' / ')}`;
}

/** The game, a log of the story scenes as they show, and presses that keep the log. */
function flow() {
  const h = makeGame();
  const log: string[] = [];
  const now = (): string | null => {
    const top = h.game.scenes.top;
    if (top instanceof OpeningScene) return 'opening';
    if (top instanceof BowserSpellScene) return 'spell';
    if (top instanceof LuigiRunsScene) return 'luigi-runs';
    if (top instanceof MirrorRaceScene) return 'race';
    if (top instanceof CardScene) return classify(top.lines) ?? 'card';
    // The round's rules (free-hero.ts), before the race.
    if (top instanceof MessageScene) return 'rules';
    if (top instanceof WorldMapScene) {
      if (top.mode === 'gate') return 'gate-cutaway';
      return classify(top.toad?.lines);
    }
    if (top instanceof LevelScene && top.world.castleText.length > 1) {
      const p = CASTLE_PAGES['1-4'];
      const text = top.world.castleText;
      if (p && (text.includes(p.reveal[0] as string) || text.includes(p.news[0] as string)))
        return 'castle-pages';
    }
    return null;
  };
  const observe = () => {
    const s = now();
    if (s && s !== log.at(-1)) log.push(s);
  };
  const step = (a: Action[] = []) => {
    h.step(a);
    observe();
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  const tap = (a: Action) => {
    step([a]);
    step();
  };
  const until = (pred: () => boolean, max = 2000) => {
    for (let i = 0; i < max && !pred(); i++) step();
    expect(pred()).toBe(true);
  };
  return { h, log, step, idle, tap, until };
}
type F = ReturnType<typeof flow>;

const top = (f: F) => f.h.game.scenes.top;
const map = (f: F) => top(f) as WorldMapScene;
const level = (f: F) => f.h.game.scenes.find((s) => s instanceof LevelScene) as LevelScene;
/** The text in front now: a card's, the map box's (Toad, a local, Bowser's cutaway), the castle's. */
function textNow(f: F): readonly string[] | null {
  const t = top(f);
  if (t instanceof CardScene) return t.lines;
  if (t instanceof OpeningScene || t instanceof BowserSpellScene) return t.lines;
  if (t instanceof WorldMapScene) return t.toad?.lines ?? t.gate?.lines ?? null;
  if (t instanceof LevelScene && t.world.castleWaiting) return t.world.castleText;
  return null;
}

/** OK once the card's guard is over. */
const ok = (f: F) => {
  f.idle(CARD_GUARD_FRAMES + 1);
  f.tap('jump');
};

/** A long wait shows the same text (nothing moves on by itself), then OK. */
function holdsThenOk(f: F) {
  const before = textNow(f);
  expect(before).not.toBeNull();
  f.idle(600);
  expect(textNow(f)).toEqual(before);
  ok(f);
}

/** Every page of the map's box read with OK (the first held a long while), until the map is idle. */
function readMapBox(f: F, max = 20): number {
  let n = 0;
  for (let i = 0; i < max && map(f).mode !== 'idle'; i++) {
    f.until(() => textNow(f) != null || map(f).mode === 'idle', 900);
    if (map(f).mode === 'idle') break;
    if (n === 0) holdsThenOk(f);
    else ok(f);
    n++;
  }
  f.until(() => map(f).mode === 'idle', 900);
  return n;
}

/** Story cards over a level read with OK until the level is back on top. */
function readCards(f: F, max = 12): number {
  let n = 0;
  for (; n < max && top(f) instanceof CardScene; n++) {
    if (n === 0) holdsThenOk(f);
    else ok(f);
  }
  return n;
}

/** Direction of a map road's first step from `from`. */
function dirTo(m: WorldMapScene, to: string): Dir {
  const p = m.page.paths.find((x) => x.from === m.node && x.to === to);
  const q = m.page.paths.find((x) => x.to === m.node && x.from === to);
  const pts = p ? p.points : [...(q as { points: [number, number][] }).points].reverse();
  const [a, b] = pts as [[number, number], [number, number]];
  if (b[0] > a[0]) return 'right';
  if (b[0] < a[0]) return 'left';
  return b[1] > a[1] ? 'down' : 'up';
}

/** Walks the map hero to node `to` and enters its level (keeping Mario at a character select). */
function enterFromMap(f: F, to: string) {
  const m = map(f);
  if (m.node !== to) {
    f.tap(dirTo(m, to));
    f.until(() => m.mode === 'idle', 600);
    expect(m.node).toBe(to);
  }
  f.idle(8);
  f.tap('jump');
  if (top(f) instanceof CharacterSelectScene) {
    f.idle(12);
    f.tap('jump');
  }
  f.until(() => !(top(f) instanceof WorldMapScene) && !(top(f) instanceof CharacterSelectScene), 900);
}

/** The level's exit (its flagpole or castle), as reaching it reports. */
function exitLevel(f: F) {
  const l = top(f) as LevelScene;
  expect(l).toBeInstanceOf(LevelScene);
  l.world.events.push({ type: 'exit', next: 'next' });
  f.step();
  f.until(() => top(f) instanceof WorldMapScene, 60);
}

/** Puts player 1 on the ground at tile column `col` (feet on row `row`'s top). */
function setDown(l: LevelScene, col: number, row: number) {
  const p = l.world.player.body;
  p.x = px(col * 16 + 2);
  p.y = px(row * 16) - p.h - px(1);
  p.vx = 0;
  p.vy = 0;
  l.world.camera.snapTo(p.x);
}

describe("Chapter 1's start on a new file (0.4.23, end to end)", () => {
  it('opening → 1-0 → Toad → 1-1 → Luigi freed → 1-2..1-4 → the gate → World 2: each scene once, in order', () => {
    const f = flow();
    const { h } = f;
    h.game.ctx.assist.invulnerable = true;

    // Title → Start game → slot 1: a new file opens on Peach's note.
    h.game.showTitle();
    f.idle(8);
    f.tap('start');
    expect(top(f)).toBeInstanceOf(FileSelectScene);
    f.idle(8);
    f.tap('jump');
    expect(top(f)).toBeInstanceOf(OpeningScene);
    const opening = top(f) as OpeningScene;
    f.until(() => opening.lines !== null, 600);
    holdsThenOk(f); // the caption
    expect(opening.stage).toBe('note');
    f.idle(600); // the note writes itself out a line at a time (an animation), then waits
    expect(opening.stage).toBe('note');
    if (!opening.noteDone) ok(f); // the rest of it at once
    expect(opening.noteDone).toBe(true);
    f.idle(600);
    expect(opening.stage).toBe('note'); // it stays until OK
    ok(f); // the note closes
    for (let i = 0; i < OPENING_TOAD_PAGES.length; i++) {
      expect(opening.lines).toEqual(OPENING_TOAD_PAGES[i]);
      if (i === 0) holdsThenOk(f);
      else ok(f);
    }
    f.until(() => top(f) instanceof WorldMapScene, 300);

    // The map before 1-0: no Toad yet; 1-0 is the start spot.
    expect(map(f).page.id).toBe('smb-1');
    expect(map(f).node).toBe('start');
    f.until(() => map(f).mode === 'idle', 600);
    expect(map(f).toad).toBeNull();
    enterFromMap(f, 'start');
    f.until(() => top(f) instanceof CardScene, 600);
    expect(level(f).level.id).toBe('1-0');
    expect(readCards(f)).toBe(STORY_TOAD_PAGES.length); // the greeting

    // Pause → Skip tutorial: Bowser's spell first (never seen on this file), then the map.
    h.game.scenes.push(new PauseScene(h.game));
    f.step();
    h.game.skipTutorial();
    f.step();
    const spell = top(f) as BowserSpellScene;
    expect(spell).toBeInstanceOf(BowserSpellScene);
    f.until(() => spell.lines !== null, 600);
    for (let i = 0; i < BOWSER_SPELL_PAGES.length; i++) {
      expect(spell.lines).toEqual(BOWSER_SPELL_PAGES[i]);
      if (i === 0) holdsThenOk(f);
      else ok(f);
    }
    f.until(() => spell.lines !== null, 900); // the eight windows, then his last page
    expect(spell.lines).toEqual(BOWSER_SPELL_LAST);
    holdsThenOk(f);
    f.until(() => top(f) instanceof WorldMapScene, 900);

    // Back on the map: Toad's World 1 scene (he walks in), then the road to 1-1.
    expect(map(f).story).toBe(true);
    expect(readMapBox(f)).toBe(WORLD1_PAGES.length);
    expect(h.game.mapProgress.cleared).toContain('1-0');

    // 1-1: Luigi runs off, Mario's line.
    enterFromMap(f, '1-1');
    f.until(() => top(f) instanceof CardScene, 900);
    expect(readCards(f)).toBe(1);
    expect(top(f)).toBeInstanceOf(LevelScene);
    expect(level(f).level.id).toBe('1-1');

    // The villager by the bonus pipe (col 55): every page.
    const l11 = level(f);
    setDown(l11, 52, 13);
    const villager = () => l11.world.entities.find((e): e is Partner => e instanceof Partner && e.alive);
    f.until(() => villager() !== undefined && l11.world.player.body.onGround, 120);
    for (let i = 0; i < 200 && !(villager() as Partner).inReach(l11.world.player); i++) f.step(['right']);
    expect((villager() as Partner).inReach(l11.world.player)).toBe(true);
    f.idle(4);
    f.tap('up');
    expect(readCards(f)).toBe(PARTNERS.villager?.pages.length);
    expect(top(f)).toBe(l11);

    // Down the bonus pipe (col 57) to Luigi's ledge room.
    setDown(l11, 57, 9);
    f.until(() => l11.world.player.body.onGround, 60);
    const inBonus = () => top(f) instanceof LevelScene && (top(f) as LevelScene).level.id === '1-1-bonus';
    for (let i = 0; i < 300 && !inBonus(); i++) f.step(['down']);
    expect(inBonus()).toBe(true);
    const bonus = top(f) as LevelScene;
    f.idle(30);
    const luigi = bonus.world.entities.find((e): e is Captive => e instanceof Captive && e.alive) as Captive;
    expect(luigi).toBeDefined();
    const p = bonus.world.player.body;
    p.x = luigi.body.x - px(18);
    p.y = luigi.body.y + luigi.body.h - p.h - px(2);
    p.vx = 0;
    p.vy = 0;
    f.until(() => p.onGround, 60);
    f.idle(10);
    // Luigi's talk and the race's rules, then the race (reported won: race.test.ts plays one).
    f.tap('up');
    for (let i = 0; i < 8 && (top(f) instanceof CardScene || top(f) instanceof MessageScene); i++) ok(f);
    const race = top(f);
    expect(race).toBeInstanceOf(MirrorRaceScene);
    f.idle(30);
    (race as unknown as { finish(r: MiniGameResult): void }).finish('pass');
    f.step();
    // Luigi's freeing talk (every page), then LUIGI IS FREE!, then the room.
    expect(classify((top(f) as CardScene).lines)).toBe('freed-talk');
    expect(readCards(f)).toBe(freedTalk('luigi', 'MARIO').length + 1);
    expect(top(f)).toBe(bonus);
    expect(h.game.freed).toContain('luigi');
    // On through 1-1 to its flagpole: the map, with nothing for Toad to say.
    exitLevel(f);
    expect(map(f).story).toBe(false);
    f.until(() => map(f).mode === 'idle', 900);

    // 1-2 and 1-3: nothing new.
    for (const id of ['1-2', '1-3']) {
      enterFromMap(f, id);
      f.until(() => top(f) instanceof LevelScene, 600);
      exitLevel(f);
      f.until(() => map(f).mode === 'idle', 900);
    }

    // 1-4: at the axe the fake bursts, Mario looks and says the remark; then Toad's castle pages.
    enterFromMap(f, '1-4');
    f.until(() => top(f) instanceof LevelScene, 600);
    const castle = level(f);
    const axe = castle.level.entities.find((e) => e.type === 'axe') as { x: number };
    setDown(castle, axe.x - 6, 9);
    const fake = () => castle.world.entities.find((e): e is Bowser => e instanceof Bowser && !e.fake);
    f.until(() => fake() !== undefined, 120);
    setDown(castle, axe.x, 9);
    f.until(() => top(f) instanceof CardScene, 300);
    expect(readCards(f)).toBe(1); // the remark
    f.until(() => castle.world.castleWaiting, 900);
    holdsThenOk(f); // the fake's true form
    f.until(() => castle.world.castleWaiting || top(f) instanceof WorldMapScene, 900);
    holdsThenOk(f); // the news
    f.until(() => top(f) instanceof WorldMapScene, 300);

    // The gate (Luigi is free): Bowser's cutaway, the seal shatters, the road draws in, Toad.
    const m1 = map(f);
    expect(m1.mode).toBe('gate');
    const g1 = gateScript(1, 'MARIO');
    // Bowser holds the star wand of his spell (the story sheet), not the old orb wand.
    f.until(() => m1.gate?.lines != null, 300);
    const wand = draw(m1).sprites.filter((s) => s.key.startsWith('story') && s.frame.startsWith('star-wand'));
    expect(wand.length).toBe(1);
    expect(draw(m1).sprites.some((s) => s.key.startsWith('wand'))).toBe(false);
    expect(readMapBox(f)).toBe((g1?.bowser.length ?? 0) + (g1?.toad.length ?? 0));
    expect(h.said.some((t) => t.startsWith('The seal shatters'))).toBe(true);
    expect(h.game.mapProgress.pages).toContain('smb-2');

    // On to World 2: its local's welcome on the first arrival.
    f.until(() => m1.toad === null, 600);
    const road = m1.page.exits.find((e) => e.to === 'smb-2' && e.from === m1.node);
    const [a, b] = road?.points as [[number, number], [number, number]];
    f.tap(b[0] > a[0] ? 'right' : b[0] < a[0] ? 'left' : b[1] > a[1] ? 'down' : 'up');
    f.until(() => map(f).page.id === 'smb-2' && map(f).mode !== 'slide' && map(f).mode !== 'walk', 900);
    expect(readMapBox(f)).toBe(WELCOMES['smb-2']?.pages.length);

    expect(f.log).toEqual([
      'opening',
      'greeting',
      'spell',
      'toad-world-1',
      'luigi-runs',
      'villager',
      'captive',
      'rules',
      'race',
      'freed-talk',
      'freed-card',
      'remark',
      'castle-pages',
      'gate-cutaway',
      'gate-toad',
      'welcome-2',
    ]);
    const story = loadSave(1)?.story ?? [];
    for (const id of [
      STORY_REV,
      beat.opening,
      beat.spell,
      beat.enter('smb-1'),
      beat.luigiRuns,
      beat.remark('1-4'),
      beat.gate('smb-1'),
      beat.welcome('smb-2'),
    ])
      expect(story, id).toContain(id);
    // The seal never stood on this file (Luigi was freed first): no reminder was due.
    expect(story).not.toContain(beat.sealed('smb-1'));
  });
});

describe('tests/sim/story-seen.ts', () => {
  it('ALL_STORY has every Chapter 1 beat', () => {
    const ids = Object.values(beat).flatMap((b) => {
      if (typeof b === 'string') return [b];
      return ['smb-1', 'smb-2', 'smb-8', '1-4', '7-4'].map((x) => b(x));
    });
    const known = (id: string) =>
      ALL_STORY.includes(id) ||
      // Function beats are per page or per castle: only the real ones are in the list.
      !/^(enter:smb-\d|gate:smb-\d|sealed:smb-\d|welcome:smb-[2-8]|remark:[1-7]-4)$/.test(id);
    for (const id of ids) expect(known(id), id).toBe(true);
    for (const id of Object.values(beat)) if (typeof id === 'string') expect(ALL_STORY, id).toContain(id);
    expect(ALL_STORY).toContain(STORY_REV);
  });
});
