import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { CHARACTERS } from '@game/characters/registry';
import { LUIGI } from '@game/characters/luigi';
import { MEGAMAN } from '@game/characters/megaman';
import { LevelScene } from '@game/scenes/level';
import { CardScene, CARD_GUARD_FRAMES } from '@game/scenes/message';
import { AnchorDrop, ANCHOR_SAID } from '@game/entities/objects/anchor-drop';
import { ANCHOR_SCENE, ANCHOR_SCENE_SAID, LarryOnChain } from '@game/world/anchor-scene';
import { ANCHOR_HEROES, ANCHOR_LARRY_PAGES, ANCHOR_LARRY_SAID, anchorHeroPage } from '@game/story/script';
import { beat } from '@game/story/beats';
import { fontText } from '@game/hud/text';
import { px, toPx } from '@engine/math/units';
import type { World } from '@game/world/world';
import { ANCHOR_COL, draw, file, makeGame, ROOM_GAP, useStorage, type H } from './heroes-harness';

// 4-2's anchor scene (0.4.39, owner's v0.4.34 play-test notes; world/anchor-scene.ts): in the
// campaign's story, once per file, the hidden zone's anchor drop becomes a scene. The ground
// shakes (gently, never with reduce flashing), the hero stops and looks up, the anchor slams down
// and knocks the hero back, Larry yells down the chain (a card), climbs down, panics and scurries
// back up, the hero says "LET'S GET HIM!" (each hero their own line) and play goes on up the chain
// into the airship. Every card waits for a press, BACK skips the whole scene, every line is read
// out.

useStorage();

const drop = (w: World) => w.entities.find((e): e is AnchorDrop => e instanceof AnchorDrop);

/** Campaign 4-2 on the ceiling over the hidden zone, as hero `c` (story on). */
function in42(h: H, c = 'mario', story: string[] = []): LevelScene {
  file(
    { story, cleared: ['1-0', '4-1'], pages: ['smb-1', 'smb-4'], position: { page: 'smb-4', node: '4-2' } },
    c,
  );
  h.game.openFile(1);
  h.idle(8);
  h.game.startLevel(getLevel('4-2'), { mode: 'stand', x: 200, y: 1, time: 300 });
  h.step();
  const main = h.top() as LevelScene;
  expect(main.level.id).toBe('4-2');
  return main;
}

/** Walk off the ceiling into the gap and drop to the zone's floor; returns once the scene starts. */
function dropIn(h: H, main: LevelScene): void {
  const p = main.world.player;
  p.body.x = px(ROOM_GAP * 16 - 14);
  p.body.y = px(2 * 16) - p.body.h;
  for (let f = 0; f < 200 && !main.world.anchorScene; f++) h.step(f < 20 ? ['right'] : []);
  expect(main.world.anchorScene).not.toBeNull();
}

/** Steps (no input) until a card is on top; returns its lines. */
function untilCard(h: H, max = 900): readonly string[] {
  h.until(() => h.top() instanceof CardScene, max);
  return (h.top() as CardScene).lines;
}

const ok = (h: H) => {
  h.idle(CARD_GUARD_FRAMES + 1);
  h.tap('jump');
};

describe('the anchor scene (campaign story, once per file)', () => {
  it('plays in order: shake, look up, the crash and knockback, Larry, his climb, the hero, the airship', () => {
    const h = makeGame();
    (h.game.deps.ctx as { reduceFlashing: boolean }).reduceFlashing = false;
    const main = in42(h);
    dropIn(h, main);
    const w = main.world;
    const p = w.player;
    const startX = p.body.x;
    const scene = w.anchorScene!;
    expect(scene.phase).toBe('rumble');
    // Seen at once: a TRY AGAIN or a later visit does not play it again.
    expect(h.game.seen(beat.anchor42)).toBe(true);
    // Its first line also says how to skip it, as the SKIP hint on screen shows (new text is said).
    expect(h.said).toContain(`${ANCHOR_SCENE_SAID.rumble} SKIP skips the scene.`);
    // 1. The ground shakes gently: never more than a pixel.
    let shook = 0;
    let lookedUp = false;
    for (let f = 0; f < ANCHOR_SCENE.rumble && scene.phase === 'rumble'; f++) {
      h.step(['right', 'jump']);
      if (w.shakeY !== 0) shook++;
      expect(Math.abs(w.shakeY)).toBeLessThanOrEqual(1);
      // 2. The hero stands still (input ignored) and looks up: a `!` over the head.
      expect(p.body.x).toBe(startX);
      if (w.entities.some((e) => e.kind === 'exclaim' && e.alive)) lookedUp = true;
    }
    expect(shook).toBeGreaterThan(10);
    expect(lookedUp).toBe(true);
    // The hero faces the anchor's column (he dropped in to its right).
    expect(p.facing).toBe(-1);
    // 3. The anchor slams down: the pipe is gone, the hero is knocked back, unhurt (he landed
    // against the room's far wall, so the throw goes toward the open floor).
    h.until(() => drop(w)?.phase === 'rest', 200);
    h.until(() => toPx(p.body.x) !== toPx(startX), 40);
    const knocked = p.body.x;
    expect(knocked).toBeLessThan(startX);
    expect(h.said).toContain(ANCHOR_SCENE_SAID.crash);
    expect(h.said.some((t) => t.startsWith(ANCHOR_SAID))).toBe(false);
    // 4. Larry yells down: his card, read out, waiting for OK (never by itself).
    expect(untilCard(h)).toEqual(ANCHOR_LARRY_PAGES[0]);
    expect(h.said.some((t) => t.startsWith('LARRY: AFTER MY WAND'))).toBe(true);
    h.idle(1500);
    expect(h.top()).toBeInstanceOf(CardScene);
    expect(p.dead).toBe(false);
    expect(p.powerState).toBe('small');
    ok(h);
    // 5. Larry climbs down the chain, panics and scurries back up.
    let larry: LarryOnChain | undefined;
    h.until(
      () => (larry = w.entities.find((e): e is LarryOnChain => e instanceof LarryOnChain)) !== undefined,
      60,
    );
    expect(h.said).toContain(ANCHOR_LARRY_SAID);
    expect(toPx(larry!.body.y)).toBeLessThan(0);
    const frames = new Set<string>();
    for (let f = 0; f < 400 && larry!.alive; f++) {
      h.step();
      frames.add(draw(main).sprites.find((s) => s.frame.startsWith('larry-'))?.frame ?? '');
    }
    expect(frames).toContain('larry-climb-0');
    expect(frames).toContain('larry-climb-1');
    expect(frames).toContain('larry-hurt');
    // 6. The hero's line.
    expect(untilCard(h)).toEqual(['MARIO:', '', "LET'S GET HIM!"]);
    expect(h.said).toContain("MARIO: LET'S GET HIM! OK to continue.");
    ok(h);
    // 7. The hero runs to the chain and climbs it into the airship.
    let climbed = false;
    for (let f = 0; f < 400 && h.top() === main; f++) {
      h.step();
      if (p.anim === 'climb' && Math.abs(toPx(p.centerX) - (ANCHOR_COL * 16 + 8)) <= 2) climbed = true;
    }
    expect(climbed).toBe(true);
    h.until(() => h.top() instanceof LevelScene && (h.top() as LevelScene).level.id === '4-2-airship', 120);
    const ship = h.top() as LevelScene;
    expect(ship.world.arriving).toBe(true);
    expect(h.game.airship?.retryAt.start).toEqual({ x: 2, y: 3, mode: 'climb', chain: true });
  });

  it('with reduce flashing the screen never shakes', () => {
    const h = makeGame();
    const main = in42(h);
    dropIn(h, main);
    const w = main.world;
    for (let f = 0; f < 200 && !(h.top() instanceof CardScene); f++) {
      h.step();
      expect(w.shakeY).toBe(0);
    }
    expect(h.top()).toBeInstanceOf(CardScene);
  });

  it.each([
    ['JUMP during the rumble', 'rumble'],
    ['BACK on Larry’s card', 'card'],
    ['MENU while Larry climbs', 'climb'],
  ])('%s skips the whole scene, straight up into the airship', (_name, when) => {
    const h = makeGame();
    const main = in42(h);
    dropIn(h, main);
    const w = main.world;
    if (when === 'rumble') {
      h.idle(ANCHOR_SCENE.guard + 1);
      h.tap('jump');
    } else {
      untilCard(h);
      h.idle(CARD_GUARD_FRAMES + 1);
      if (when === 'card') h.tap('attack');
      else {
        h.tap('jump');
        h.until(() => w.entities.some((e) => e instanceof LarryOnChain), 60);
        h.idle(ANCHOR_SCENE.guard + 1);
        h.tap('start');
      }
    }
    h.until(() => h.top() instanceof LevelScene && (h.top() as LevelScene).level.id === '4-2-airship', 120);
    // No more cards and no pause menu came up on the way; the pipe was smashed all the same.
    expect(h.said.some((t) => t.startsWith('MARIO:'))).toBe(false);
    expect(drop(w)?.phase).toBe('rest');
  });

  it('dropped in against the room’s wall, the hero is thrown back toward open floor, not into it', () => {
    const h = makeGame();
    const main = in42(h);
    dropIn(h, main);
    const w = main.world;
    const p = w.player;
    // Flush against the wall on the far side from the anchor (where a player falling straight
    // through the ceiling's gap lands).
    const row = Math.floor((toPx(p.body.y + p.body.h) - 1) / 16);
    let col = Math.floor(toPx(p.body.x + p.body.w) / 16);
    while (!w.map.isSolid(col, row)) col++;
    p.body.x = px(col * 16) - p.body.w;
    const startX = p.body.x;
    h.until(() => drop(w)?.phase === 'rest', 300);
    h.until(() => w.anchorScene?.phase !== 'fall' && p.body.onGround, 60);
    // A real throw: well clear of the wall, landing on its feet, unhurt.
    expect(toPx(startX) - toPx(p.body.x)).toBeGreaterThanOrEqual(16);
    expect(p.dead).toBe(false);
    expect(p.powerState).toBe('small');
  });

  it('a press held from before the scene does not skip it', () => {
    const h = makeGame();
    const main = in42(h);
    dropIn(h, main);
    for (let f = 0; f < ANCHOR_SCENE.guard; f++) h.step(['jump']);
    expect(main.world.anchorScene?.phase).toBe('rumble');
  });

  it('fire (BACK) between the cards never skips it: a hero tapping his buster sees it all', () => {
    const h = makeGame();
    const main = in42(h, 'megaman');
    dropIn(h, main);
    for (let f = 0; f < 80; f++) h.step(f % 2 ? ['attack'] : []);
    expect(main.world.anchorScene).not.toBeNull();
    // The skip control is JUMP everywhere: the hint, its touch button and the line said.
    expect(main.touchLabels().jump).toBe('SKIP');
    expect(main.touchLabels().attack).toBeNull();
  });

  it('closing Larry’s card with a double press of OK does not skip what follows', () => {
    const h = makeGame();
    const main = in42(h);
    dropIn(h, main);
    untilCard(h);
    ok(h);
    // The second press of a quick double tap lands on the scene a few frames later.
    h.idle(3);
    h.tap('jump');
    h.idle(2);
    expect(main.world.anchorScene?.phase).toBe('down');
  });

  it('as Luigi and Mega Man: their own name and line', () => {
    for (const c of [LUIGI, MEGAMAN]) {
      const h = makeGame();
      const main = in42(h, c.id);
      dropIn(h, main);
      untilCard(h);
      ok(h);
      h.until(() => h.top() instanceof CardScene, 900);
      const lines = (h.top() as CardScene).lines;
      expect(lines).toEqual(anchorHeroPage(c.id, fontText(c.name)));
      expect(lines[0]).toBe(`${fontText(c.name)}:`);
      expect(lines.join(' ')).not.toContain('MARIO');
    }
  });

  it('every hero has a line of their own, and it fits the card', () => {
    expect([...ANCHOR_HEROES].sort()).toEqual(CHARACTERS.map((c) => c.id).sort());
    for (const c of CHARACTERS) {
      const page = anchorHeroPage(c.id, fontText(c.name));
      expect(page[0]).toBe(`${fontText(c.name)}:`);
      expect(page.length).toBeLessThanOrEqual(6);
      for (const l of page) expect(l.length, l).toBeLessThanOrEqual(28);
    }
  });

  it('once seen on the file, the anchor just crashes as before and the chain is climbed', () => {
    const h = makeGame();
    const main = in42(h, 'mario', [beat.anchor42]);
    const w = main.world;
    w.player.body.x = px(ROOM_GAP * 16 - 14);
    w.player.body.y = px(32) - w.player.body.h;
    for (let f = 0; f < 300 && drop(w)?.phase !== 'rest'; f++) h.step(f < 20 ? ['right'] : []);
    expect(w.anchorScene).toBeNull();
    expect(drop(w)?.phase).toBe('rest');
    expect(h.said).toContain(`${ANCHOR_SAID} Climb its chain: UP.`);
    expect(h.top()).toBe(main);
    expect(Math.floor(toPx(drop(w)!.body.x + px(8)) / 16)).toBe(ANCHOR_COL);
  });
});
