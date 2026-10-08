import { describe, expect, it } from 'vitest';
import { heroItems } from '../../items/catalog';
import { hasKey } from '../../items/flags';
import { MEGAMAN_TOOL_LABELS } from '../../characters/megaman';
import { WEAPONS } from '../../characters/megaman/weapons';
import { CARD_GUARD_FRAMES } from '../room';
import { lessonsFor, promptActions, touchNames } from '../lessons';
import { MEGAMAN_TRAINING } from './megaman';
import { grab, playTraining, tbPolicies, trainingRoom } from '../../../../tests/sim/training-tb';

/* Mega Man's training (0.4.34): from the buster and the slide, the Helmet, then each weapon and Rush as its own item. */

const ids = () => lessonsFor('megaman').map((l) => l.id);

describe("Mega Man's lessons", () => {
  it('chapters in the order his kit builds up: basics with the Helmet, weapons, water', () => {
    expect(MEGAMAN_TRAINING.chapters.map((c) => [c.id, c.room, c.lessons.map((l) => l.id)])).toEqual([
      ['basics', 'gear', ['shoot', 'charge', 'slide']],
      ['weapons', 'gear', ['saw', 'leaf', 'rush']],
      ['more-weapons', 'practice', ['flame', 'knuckle', 'bolt']],
      ['water', 'water', ['seabed-jump']],
    ]);
  });

  it('starts from the basic kit: no whole-kit room, no (PREVIEW) checks', () => {
    expect('fullKit' in MEGAMAN_TRAINING).toBe(false);
    for (const l of lessonsFor('megaman')) expect('unlocked' in l, l.id).toBe(false);
  });

  it('one lesson per item, the Helmet first, in the order the kit builds up (docs/POWERUPS.md)', () => {
    const items = lessonsFor('megaman').flatMap((l) => (l.item ? [l.item] : []));
    expect(items).toEqual(heroItems('megaman')?.items.map((i) => i.id));
    expect(lessonsFor('megaman').find((l) => l.id === 'charge')?.item).toBe('helmet');
    for (const w of WEAPONS) expect(lessonsFor('megaman').find((l) => l.id === w.id)?.item).toBe(w.item);
    expect(lessonsFor('megaman').find((l) => l.id === 'rush')?.item).toBe('rush-coil');
  });

  it("touch prompts name the button as it reads: SHOOT, WEAPON, and the weapon's own caption", () => {
    for (const l of lessonsFor('megaman')) {
      const p = l.touchPrompt ?? l.prompt;
      const names = touchNames(p);
      promptActions(p).forEach((a, i) => {
        const name = names[i];
        if (a === 'attack') expect(name, l.id).toBe('SHOOT');
        if (a === 'select') expect(name, l.id).toBe('WEAPON');
        if (a === 'special') expect(name, l.id).toBe(MEGAMAN_TOOL_LABELS[l.id]);
      });
    }
    for (const id of [...WEAPONS.map((w) => w.id), 'rush'])
      expect(touchNames(lessonsFor('megaman').find((l) => l.id === id)?.prompt ?? ''), id).toContain(
        MEGAMAN_TOOL_LABELS[id],
      );
  });
});

function at(id: string) {
  const r = trainingRoom('megaman');
  r.h.step();
  r.h.idle(CARD_GUARD_FRAMES + 1);
  r.h.tap('jump');
  r.scene.startLesson(ids().indexOf(id));
  return r;
}

describe("Mega Man's item lessons measure the real thing", () => {
  it('no charge shot without the Helmet; with it, the charge lesson ticks', () => {
    const r = at('charge');
    const s = r.scene;
    // Holding SHOOT before the grab (he stays put, away from the helmet): no charge.
    for (let f = 0; f < 140; f++) r.h.step(f % 70 < 55 ? ['attack'] : []);
    expect(s.tracker.shotKinds.has('buster-charged')).toBe(false);
    expect(s.player.scratch.helmet ?? 0).toBe(0);
    const go = tbPolicies()['megaman:charge'];
    for (let f = 0; f < 400 && !s.ticked.includes('charge'); f++) r.h.step(go?.(s.player, f, s) ?? []);
    expect(s.player.scratch.helmet).toBe(1);
    expect(s.ticked).toContain('charge');
  });

  it("a weapon is on the belt only once its item is grabbed: WEAPON can't reach it before", () => {
    const r = at('saw');
    const s = r.scene;
    for (let f = 0; f < 60; f++) r.h.step(f % 8 === 0 ? ['select'] : f % 20 < 2 ? ['special'] : []);
    expect(s.tracker.shotKinds.has('saw')).toBe(false);
    const go = grab(() => []);
    for (let f = 0; f < 200 && s.tracker.taken.size === 0; f++) r.h.step(go(s.player, f, s));
    expect(s.player.scratch[hasKey('saw-disc')]).toBe(1);
  });
});

describe("Mega Man's whole training", () => {
  it('a scripted player grabs each item and finishes every lesson', () => {
    const r = playTraining('megaman', tbPolicies());
    expect(r.ticked).toEqual(ids());
    expect(r.results).toEqual(['done']);
    expect(r.h.game.scenes.top).toBe(r.below);
    expect(r.kit.helmet).toBe(1);
    for (const w of WEAPONS) expect(r.kit[hasKey(w.item)], w.item).toBe(1);
    expect(r.kit[hasKey('rush-coil')]).toBe(1);
  });
});
