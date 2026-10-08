import { describe, expect, it } from 'vitest';
import { heroItems } from '../../items/catalog';
import { hasKey } from '../../items/flags';
import { LINK_TOOL_LABELS, MAX_HEARTS } from '../../characters/link';
import { CARD_GUARD_FRAMES } from '../room';
import { lessonsFor, promptActions, touchNames } from '../lessons';
import { LINK_TRAINING } from './link';
import { grab, playTraining, tbPolicies, trainingRoom } from '../../../../tests/sim/training-tb';

/* Link's training (0.4.34): from his basic kit (sword, shield, thrusts, the Boomerang), each power-up grabbed, then used. */

const ids = () => lessonsFor('link').map((l) => l.id);

describe("Link's lessons", () => {
  it('chapters in the order his kit builds up: the sword, tools, magic, water', () => {
    expect(LINK_TRAINING.chapters.map((c) => [c.id, c.room, c.lessons.map((l) => l.id)])).toEqual([
      ['sword', 'practice', ['sword', 'down-thrust', 'up-thrust', 'shield']],
      ['tools', 'gear', ['boomerang', 'heart-container', 'bomb']],
      ['magic', 'practice', ['shield-spell', 'jump-spell', 'blue-ring', 'fire-spell', 'magical-sword']],
      ['water', 'water', ['swim']],
    ]);
  });

  it('starts from the basic kit: no whole-kit room, no (PREVIEW) checks', () => {
    expect(LINK_TRAINING.fullKit).toBeUndefined();
    for (const l of lessonsFor('link')) expect(l.unlocked, l.id).toBeUndefined();
  });

  it('one lesson per item, grow item first, in the order the kit builds up (docs/POWERUPS.md)', () => {
    const items = lessonsFor('link').flatMap((l) => (l.item ? [l.item] : []));
    expect(items).toEqual(heroItems('link')?.items.map((i) => i.id));
    // The Boomerang is his from the start: its lesson places nothing.
    expect(lessonsFor('link').find((l) => l.id === 'boomerang')?.item).toBeUndefined();
  });

  it("touch prompts name the button as it reads: SWORD, TOOLS, and the tool's own caption", () => {
    const tools = Object.values(LINK_TOOL_LABELS);
    for (const l of lessonsFor('link')) {
      const p = l.touchPrompt ?? l.prompt;
      const names = touchNames(p);
      promptActions(p).forEach((a, i) => {
        const name = names[i];
        if (a === 'attack') expect(name, l.id).toBe('SWORD');
        if (a === 'select') expect(name, l.id).toBe('TOOLS');
        if (a === 'special') expect(tools, l.id).toContain(name);
      });
    }
    const special = (id: string) =>
      touchNames(lessonsFor('link').find((l) => l.id === id)?.prompt ?? '').filter((n) => tools.includes(n));
    expect(special('boomerang')).toEqual(['BOOMERANG']);
    expect(special('bomb')).toEqual(['BOMB']);
    expect(special('shield-spell')).toEqual(['SHIELD']);
    expect(special('jump-spell')).toEqual(['HI-JUMP']);
    expect(special('fire-spell')).toEqual(['FIRE']);
  });
});

/** The room at lesson `id`, past the first chapter's card. */
function at(id: string) {
  const r = trainingRoom('link');
  r.h.step();
  r.h.idle(CARD_GUARD_FRAMES + 1);
  r.h.tap('jump');
  r.scene.startLesson(ids().indexOf(id));
  return r;
}

describe("Link's item lessons measure the real thing", () => {
  it('the heart container: one more heart once grabbed', () => {
    const r = at('heart-container');
    expect(r.scene.player.scratch.maxHp ?? 6).toBe(6);
    const go = grab(() => []);
    for (let f = 0; f < 200 && !r.scene.ticked.includes('heart-container'); f++)
      r.h.step(go(r.scene.player, f, r.scene));
    expect(r.scene.ticked).toContain('heart-container');
    expect(r.scene.player.scratch.maxHp).toBe(8);
    expect(r.scene.player.scratch.maxHp).toBeLessThanOrEqual(MAX_HEARTS * 2);
  });

  it('the Blue Ring: a shot on the shield does not count; one that glances off his back does', () => {
    const r = at('blue-ring');
    const s = r.scene;
    expect(s.dummyShoots).toBe(true);
    const go = grab(() => []);
    for (let f = 0; f < 200 && s.tracker.taken.size === 0; f++) r.h.step(go(s.player, f, s));
    expect(s.player.scratch.tunic).toBe(1);
    // Facing the dummy, standing still: the shield takes the shots.
    for (let f = 0; f < 60 && s.player.facing < 0; f++) r.h.step(['right']);
    for (let f = 0; f < 400 && s.tracker.blocked < 1; f++) r.h.step();
    expect(s.tracker.blocked).toBeGreaterThan(0);
    expect(s.ticked).not.toContain('blue-ring');
    // His back to it: the next shot glances off.
    r.h.step(['left']);
    r.h.until(() => s.ticked.includes('blue-ring'), 400);
    expect(s.ticked).toContain('blue-ring');
  });

  it('the Magical Sword: the beam comes only once it is grabbed', () => {
    const r = at('magical-sword');
    const s = r.scene;
    // Swinging from afar before the grab: no beam reaches the dummy.
    for (let f = 0; f < 60; f++) r.h.step(f % 16 < 2 ? ['attack'] : []);
    expect(s.tracker.dummyHits.has('sword-beam')).toBe(false);
    const go = tbPolicies()['link:magical-sword'];
    for (let f = 0; f < 600 && !s.ticked.includes('magical-sword'); f++) r.h.step(go?.(s.player, f, s) ?? []);
    expect(s.ticked).toContain('magical-sword');
  });
});

describe("Link's whole training", () => {
  it('a scripted player grabs each item and finishes every lesson', () => {
    const r = playTraining('link', tbPolicies());
    expect(r.ticked).toEqual(ids());
    expect(r.results).toEqual(['done']);
    expect(r.h.game.scenes.top).toBe(r.below);
    // Every item of his was grabbed on the way.
    for (const id of ['bomb-bag', 'shield-spell', 'jump-spell', 'fire-spell'])
      expect(r.kit[hasKey(id)], id).toBe(1);
    expect(r.kit.maxHp).toBe(8);
    expect(r.kit.tunic).toBe(1);
    expect(r.kit.beam).toBe(1);
  });
});
