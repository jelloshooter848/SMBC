import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { MAP_HEADER_H, MAP_HINT_Y, WorldMapScene } from '@game/scenes/world-map';
import { CreditsScene } from '@game/scenes/credits';
import { CHARACTERS } from '@game/characters/registry';
import { loadSave, type SaveFile } from '@game/save/save-files';
import { beat } from '@game/story/beats';
import { gateScript, RIFT_SEALED_PAGES, riftPages, WELCOMES, type Page } from '@game/story/script';
import { draw, file, makeGame, useStorage, type H } from './heroes-harness';
import { aboveLook } from '@content/worldmap/above-render';
import { overheadSheet } from '@game/town/hero';
import { SPRITES } from '@content/sprites';
import { ALL_STORY } from './story-seen';

// The world gates and the welcomes (0.4.23, docs/STORY.md 2.3b, 2.7, 2.12; map/world-gate.ts,
// map/gate-scene.ts): World N's road on waits for N-4 AND World N's hero; the seal, the reminder,
// Bowser's cutaway, the shatter, Toad; the locals on the start nodes; the rift waiting for Sophia
// III; the crystal ball's shadows from the first arrival.

useStorage();

const W1 = ['1-0', '1-1', '1-2', '1-3', '1-4'];
const map = (h: H) => h.top() as WorldMapScene;
const ALL = CHARACTERS.map((c) => c.id);
/** Every beat seen but these. */
const seenBut = (...ids: string[]) => ALL_STORY.filter((id) => !ids.includes(id));
const G1 = gateScript(1, 'MARIO');

function open(over: Partial<SaveFile>): H {
  const h = makeGame();
  h.game.deps.settings = { dev: false } as Settings;
  file(over);
  h.game.openFile(1);
  h.step();
  return h;
}

/** The lines in the map's box (Toad's, a local's or Bowser's in the cutaway), or null. */
const box = (h: H): Page | null => map(h).toad?.lines ?? map(h).gate?.lines ?? null;

/** Reads every page that shows until the map is idle, pressing OK on each. */
function readAll(h: H): Page[] {
  const out: Page[] = [];
  for (let i = 0; i < 40 && map(h).mode !== 'idle'; i++) {
    h.until(() => box(h) != null || map(h).mode === 'idle', 900);
    const lines = box(h);
    if (!lines) break;
    out.push(lines);
    h.idle(31);
    h.tap('jump');
  }
  h.until(() => map(h).mode === 'idle', 900);
  return out;
}

describe('the world gates (0.4.23)', () => {
  it('1-4 cleared, Luigi captive: the seal, the reminder once, the hint line; no road', () => {
    const h = open({
      cleared: W1,
      position: { page: 'smb-1', node: '1-4' },
      story: seenBut(beat.sealed('smb-1')),
    });
    expect(map(h).story).toBe(true);
    expect(readAll(h)).toEqual(G1?.reminder);
    expect(h.game.seen(beat.sealed('smb-1'))).toBe(true);
    expect(map(h).hintLine).toBe('SEALED - FREE LUIGI FIRST');
    expect(h.game.mapProgress.pages).toEqual(['smb-1']);
    // Right on 1-4 bumps: the road is not there.
    h.tap('right');
    expect(map(h).mode).toBe('idle');
    // Shown again: no reminder.
    h.game.showMap();
    h.step();
    expect(map(h).story).toBe(false);
  });

  it("Luigi freed later: Bowser's cutaway, the seal shatters, the road draws in, then Toad", () => {
    const h = open({
      cleared: W1,
      position: { page: 'smb-1', node: '1-4' },
      story: [...ALL_STORY.filter((id) => id !== beat.gate('smb-1'))],
    });
    expect(map(h).mode).toBe('idle');
    h.game.freeHero('luigi');
    h.game.returnToMap();
    h.step();
    expect(h.game.mapProgress.pages).toContain('smb-2');
    expect(map(h).mode).toBe('gate');
    expect(map(h).revealing).toBe(true);
    expect(h.said.some((t) => t.includes("Bowser's throne room"))).toBe(true);
    const pages = readAll(h);
    expect(pages).toEqual([...(G1?.bowser ?? []), ...(G1?.toad ?? [])]);
    expect(h.said.some((t) => t.startsWith('The seal shatters'))).toBe(true);
    expect(h.game.seen(beat.gate('smb-1'))).toBe(true);
    expect(h.game.pendingReveal).not.toContain('smb-1:1-4>smb-2');
    expect(loadSave(1)?.story).toContain(beat.gate('smb-1'));
    // The road is walkable now.
    h.until(() => map(h).toad === null, 600);
    h.tap('right');
    expect(map(h).mode).toBe('walk');
  });

  it('BACK skips the rest of the cutaway; the gate still breaks', () => {
    const h = open({
      cleared: W1,
      position: { page: 'smb-1', node: '1-4' },
      story: seenBut(beat.gate('smb-1')),
    });
    h.game.freeHero('luigi');
    h.game.returnToMap();
    h.step();
    h.until(() => map(h).gate?.lines != null, 300);
    h.idle(31);
    h.tap('attack');
    h.until(() => map(h).toad?.lines != null, 600);
    expect(map(h).toad?.lines).toEqual(G1?.toad[0]);
  });

  it('a file that already reached World 2 keeps its road: no seal, no reminder, no gate scene', () => {
    const h = open({
      cleared: W1,
      pages: ['smb-1', 'smb-2'],
      position: { page: 'smb-1', node: '1-4' },
      story: [...ALL_STORY.filter((id) => !id.startsWith('sealed:') && !id.startsWith('gate:'))],
    });
    expect(map(h).story).toBe(false);
    expect(map(h).mode).toBe('idle');
    expect(map(h).hintLine).toBe('');
    h.idle(10);
    h.tap('right');
    expect(map(h).mode).toBe('walk');
  });
});

describe('the welcomes (0.4.23)', () => {
  const w2 = WELCOMES['smb-2'];

  it("World 2's healer: on the first arrival, then again with TALK; the hint line", () => {
    const h = open({
      cleared: W1,
      pages: ['smb-1', 'smb-2'],
      freed: ['mario', 'luigi'],
      position: { page: 'smb-2', node: 'start' },
      story: seenBut(beat.welcome('smb-2')),
    });
    const local = draw(map(h)).sprites.find((s) => s.key === 'locals');
    expect(local?.frame).toMatch(/^healer-/);
    expect(readAll(h)).toEqual(w2?.pages);
    expect(h.game.seen(beat.welcome('smb-2'))).toBe(true);
    expect(map(h).hintLine).toBe('TALK TO THE HEALER');
    h.idle(10);
    h.tap('jump');
    expect(map(h).story).toBe(true);
    expect(readAll(h)).toEqual(w2?.pages);
    // Shown again: no welcome by itself.
    h.game.showMap();
    h.step();
    expect(map(h).story).toBe(false);
  });

  it('once Link is freed, TALK plays the after-freed page instead of the welcome', () => {
    const h = open({
      cleared: [...W1, '2-1'],
      pages: ['smb-1', 'smb-2'],
      freed: ['mario', 'luigi', 'link'],
      position: { page: 'smb-2', node: 'start' },
      story: [...ALL_STORY],
    });
    h.idle(10);
    expect(map(h).hintLine).toBe('TALK TO THE HEALER');
    h.tap('jump');
    expect(map(h).story).toBe(true);
    const after = w2?.after ?? [];
    expect(after).toHaveLength(1);
    expect(readAll(h)).toEqual(after);
    expect(h.said.some((s) => s.startsWith('HEALER: LINK IS HIMSELF AGAIN!'))).toBe(true);
  });

  it.each([
    [2, 'link'],
    [3, 'megaman'],
    [4, 'samus'],
    [5, 'simon'],
    [6, 'ryu'],
    [7, 'bill'],
    [8, 'sophia'],
  ])("World %i: TALK as the world's own hero (%s) plays the local's own page (0.4.47)", (n, hero) => {
    const page = `smb-${n}`;
    const w = WELCOMES[page]!;
    const h = open({
      character: hero,
      cleared: ['1-0'],
      freed: ALL,
      pages: [1, 2, 3, 4, 5, 6, 7, 8].map((k) => `smb-${k}`),
      position: { page, node: 'start' },
      story: [...ALL_STORY],
    });
    h.idle(10);
    h.tap('jump');
    expect(map(h).story).toBe(true);
    expect(readAll(h)).toEqual(w.own);
    // Another hero hears the after-freed page.
    const h2 = open({
      character: 'mario',
      cleared: ['1-0'],
      freed: ALL,
      pages: [1, 2, 3, 4, 5, 6, 7, 8].map((k) => `smb-${k}`),
      position: { page, node: 'start' },
      story: [...ALL_STORY],
    });
    h2.idle(10);
    h2.tap('jump');
    expect(readAll(h2)).toEqual(w.after);
  });

  it('World 1 has no local', () => {
    const h = open({ cleared: ['1-0'], story: [...ALL_STORY] });
    expect(draw(map(h)).sprites.some((s) => s.key === 'locals')).toBe(false);
  });

  // Every world's local stands fully in view beside any hero on its start node: clear of the
  // hero, the roads, the nodes and anything else on the map, off the header and the hint line,
  // and on open ground (no tree, rock or palm behind it). Worlds 2 and 3 are drawn from above in
  // campaign play (0.4.50): their ground is their look's sheet, and the hero is drawn from above.
  const OPEN_GROUND = /^map-[a-z]+:(ground|tuft|flowers-\d|drift|shore-[ns]-\d)$/;
  // Worlds 4 and 5 from above (0.4.52) paint their regions whole: a land tile is '<prefix>-g<n>'.
  // Worlds 6 and 7 (0.4.53): Galesburg's paving (a drain cover now and then), Galuga's jungle floor.
  // World 8 (0.4.54): the Underworld's cave dirt by the lake, the rim of the ledge above it here and there.
  const OPEN_GROUND_ABOVE =
    /^((grass|pavement|pave|floor)-\d|pave-drain|(z4|tv5)-g\d+|dirt-\d(-drop-[nesw-]{4})?)$/;
  it.each([2, 3, 4, 5, 6, 7, 8])('World %i: the local is clear of every hero on the start node', (n) => {
    for (const c of CHARACTERS) {
      const h = open({
        character: c.id,
        cleared: ['1-0'],
        freed: ALL,
        pages: [1, 2, 3, 4, 5, 6, 7, 8].map((k) => `smb-${k}`),
        position: { page: `smb-${n}`, node: 'start' },
        story: [...ALL_STORY],
      });
      h.idle(5);
      const assets = h.game.ctx.assets;
      const boxes = draw(map(h)).sprites.map((s) => {
        const f = assets.sheet(s.key).frames.get(s.frame);
        return { ...s, w: f?.w ?? 0, h: f?.h ?? 0 };
      });
      const local = boxes.find((s) => s.key === 'locals');
      if (!local) throw new Error(`World ${n}: no local drawn`);
      // From above, a ground tile is its look's ground frame at its tile.
      const look = aboveLook(map(h).page);
      const ground0 = look?.ground(map(h).page).frames[0];
      const isGround = (s: (typeof boxes)[0]) =>
        s.key.startsWith('map@') ||
        (!!look &&
          s.key === look.sheet &&
          s.x % 16 === 0 &&
          s.y % 16 === 0 &&
          /^(grass|pavement|flowers|rock|sand|woods|cliff|ledge|band|accent|water|sea|magma|z4-|tv5-|pave|lawn|snow|gravel|floor|canal|river|falls|stairs|dirt|lake)/.test(
            s.frame,
          ) &&
          ground0?.[(s.y / 16) * 16 + s.x / 16] !== undefined);
      const boxHits = (b: (typeof boxes)[0]) =>
        local.x < b.x + b.w && b.x < local.x + local.w && local.y < b.y + b.h && b.y < local.y + local.h;
      // A road or marker from above is see-through round it: only its drawn pixels count.
      const drawn = (b: (typeof boxes)[0], x: number, y: number) =>
        (SPRITES[b.key]?.frames[b.frame]?.[y - b.y]?.[x - b.x] ?? '.') !== '.';
      const hits = (b: (typeof boxes)[0]) => {
        if (!boxHits(b)) return false;
        if (!look || b.key !== look.sheet) return true;
        for (let y = Math.max(local.y, b.y); y < Math.min(local.y + local.h, b.y + b.h); y++)
          for (let x = Math.max(local.x, b.x); x < Math.min(local.x + local.w, b.x + b.w); x++)
            if (drawn(local, x, y) && drawn(b, x, y)) return true;
        return false;
      };
      const where = `World ${n} with ${c.id}`;
      expect(local.y, where).toBeGreaterThanOrEqual(MAP_HEADER_H);
      expect(local.y + local.h, where).toBeLessThanOrEqual(MAP_HINT_Y);
      // The hero marker (its portrait), the roads' dots, the nodes, the hero marks, the seal.
      const others = boxes.filter((s) => s !== local && !isGround(s) && !/^(enemies|decor)/.test(s.key));
      expect(
        others.some((s) => s.key.startsWith(look ? overheadSheet(c) : c.portrait.sheet)),
        where,
      ).toBe(true);
      expect(
        others.filter(hits).map((s) => `${s.key}:${s.frame}`),
        where,
      ).toEqual([]);
      const ground = boxes.filter((s) => isGround(s) && hits(s));
      for (const t of ground)
        if (look) expect(t.frame, where).toMatch(OPEN_GROUND_ABOVE);
        else expect(`${t.key.slice(4)}:${t.frame}`, where).toMatch(OPEN_GROUND);
    }
  });
});

describe('the rift waits for Sophia III (0.4.23)', () => {
  const cleared = ['1-0', ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`))];
  const pages = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => `smb-${w}`);

  it('after the credits with her captive: the reminder, the hint line, no road; freed: the crack tears, Toad, the road', () => {
    const h = open({
      cleared: cleared.filter((id) => id !== '8-4'),
      pages,
      freed: ALL.filter((id) => id !== 'sophia'),
      position: { page: 'smb-8', node: '8-4' },
      story: seenBut(beat.rift, beat.bowser84, beat.sealed('smb-8'), beat.gate('smb-8')),
    });
    h.game.showEnding('8-4');
    expect(h.top()).toBeInstanceOf(CreditsScene);
    h.idle(60);
    h.tap('start');
    h.until(() => h.top() instanceof CreditsScene && (h.top() as CreditsScene).waiting, 8000);
    h.tap('jump');
    h.until(() => h.top() instanceof WorldMapScene, 3000);
    expect(h.game.mapProgress.pages).not.toContain('ll-1');
    expect(readAll(h)).toEqual(RIFT_SEALED_PAGES);
    expect(h.game.seen(beat.rift)).toBe(false);
    expect(map(h).hintLine).toBe('SEALED - FREE SOPHIA III FIRST');
    // Freed (her mini game won in 8-4's garage), back on the map.
    h.game.freeHero('sophia');
    h.game.returnToMap();
    h.step();
    expect(map(h).mode).toBe('gate');
    expect(h.said.some((t) => t.startsWith('The crack over 8-4 tears'))).toBe(true);
    expect(readAll(h)).toEqual(riftPages('MARIO'));
    expect(h.game.mapProgress.pages).toContain('ll-1');
    expect(h.game.pendingReveal).not.toContain('smb-8:8-4>ll-1');
  });
});

describe("the crystal ball's new job (0.4.23, docs/STORY.md 2.7)", () => {
  it("shows a world's hider from the first arrival, before its level is reached", () => {
    const cleared = ['1-0', ...[1, 2, 3, 4].flatMap((w) => [1, 2, 3, 4].map((s) => `${w}-${s}`))];
    const h = open({
      cleared,
      pages: ['smb-1', 'smb-2', 'smb-3', 'smb-4', 'smb-5'],
      secrets: ['larry'],
      freed: ['mario', 'luigi', 'link', 'megaman', 'samus'],
      position: { page: 'smb-5', node: 'start' },
      story: [...ALL_STORY],
    });
    // Simon hides in 5-4, far from the start: his shadow shows already.
    const simon = CHARACTERS.find((c) => c.id === 'simon');
    expect(
      draw(map(h)).sprites.some(
        (s) => s.frame === simon?.portrait.frame && s.key.startsWith(`${simon?.portrait.sheet}@`),
      ),
    ).toBe(true);
  });
});

describe("a world's local: the TALK prompt as a button (0.4.35)", () => {
  const onW2 = (scheme: 'keyboard' | 'touch') => {
    const h = open({
      cleared: W1,
      pages: ['smb-1', 'smb-2'],
      freed: ['mario', 'luigi'],
      position: { page: 'smb-2', node: 'start' },
      story: [...ALL_STORY],
    });
    h.game.deps.settings = defaultSettings();
    h.game.deps.controlScheme = () => scheme;
    h.idle(10);
    return h;
  };

  it("with keys the hint line names the TALK button's key: TALK (C) TO THE HEALER; up no longer talks", () => {
    const h = onW2('keyboard');
    expect(map(h).hintLine).toBe('TALK (C) TO THE HEALER');
    expect(draw(map(h)).texts.map((t) => t.str)).toContain('TALK (C) TO THE HEALER');
    // Up (no road goes up from the start) only bumps now (0.4.43, owner).
    h.tap('up');
    expect(map(h).story).toBe(false);
    // TALK (special), as in a level and in Kakariko (0.4.43 review: the same button everywhere).
    h.tap('special');
    expect(map(h).story).toBe(true);
    expect(readAll(h)).toEqual(WELCOMES['smb-2']?.pages);
    h.idle(10);
    expect(map(h).story).toBe(false);
    // JUMP still talks there too.
    h.tap('jump');
    expect(map(h).story).toBe(true);
  });

  it('a remapped TALK key is the one the hint line and the announcer name', () => {
    const h = onW2('keyboard');
    const b = h.game.deps.settings?.input?.bindings?.[0];
    if (!b) throw new Error('no bindings');
    b.keyboard.special = ['KeyV'];
    expect(map(h).hintLine).toBe('TALK (V) TO THE HEALER');
    h.game.showMap();
    h.idle(10);
    expect(h.said.some((t) => t.includes('Press TALK (V) to talk'))).toBe(true);
  });

  it('TALK talks to the local even once the item box is open on the file (it opens elsewhere)', () => {
    const h = onW2('keyboard');
    h.game.inventoryUnlocked = true;
    h.tap('special');
    expect(map(h).story).toBe(true);
  });

  it('on touch the C button is the TALK button there, as in a level, and talks', () => {
    const h = onW2('touch');
    expect(map(h).hintLine).toBe('TALK TO THE HEALER');
    expect(map(h).touchLabels().special).toBe('TALK');
    h.tap('special');
    expect(map(h).story).toBe(true);
    expect(readAll(h)).toEqual(WELCOMES['smb-2']?.pages);
  });
});
