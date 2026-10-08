import { describe, expect, it } from 'vitest';
import { heroItems } from '../../items/catalog';
import { hasKey } from '../../items/flags';
import { CARD_GUARD_FRAMES } from '../room';
import { lessonsFor, promptActions, touchNames } from '../lessons';
import { SAMUS_TRAINING } from './samus';
import { grab, playTraining, tbPolicies, trainingRoom } from '../../../../tests/sim/training-tb';

/* Samus's training (0.4.34): from the Power Beam and the Morph Ball, the Energy Tank, Missiles, then the beams. */

const ids = () => lessonsFor('samus').map((l) => l.id);

describe("Samus's lessons", () => {
  it('chapters in the order her kit builds up: basics with the Energy Tank, missiles, beams', () => {
    expect(SAMUS_TRAINING.chapters.map((c) => [c.id, c.room, c.lessons.map((l) => l.id)])).toEqual([
      ['basics', 'gear', ['shoot', 'energy-tank', 'aim-up', 'morph-ball', 'bomb', 'bomb-jump']],
      ['missiles', 'practice', ['missile', 'missile-switch']],
      ['beams', 'gear', ['long-beam', 'ice-beam', 'varia-suit', 'wave-beam']],
    ]);
  });

  it('starts from the basic kit: no whole-kit room, no (PREVIEW) checks', () => {
    expect('fullKit' in SAMUS_TRAINING).toBe(false);
    for (const l of lessonsFor('samus')) expect('unlocked' in l, l.id).toBe(false);
  });

  it('one lesson per item: the Energy Tank, Missiles, then the beams (docs/POWERUPS.md)', () => {
    const items = lessonsFor('samus').flatMap((l) => (l.item ? [l.item] : []));
    expect(items).toEqual(heroItems('samus')?.items.map((i) => i.id));
    expect(items.slice(0, 2)).toEqual(['energy-tank', 'missiles']);
  });

  it('touch prompts name the button as it reads: SHOOT (MISSILE once switched), BOMB, MISSILE, WEAPON', () => {
    for (const l of lessonsFor('samus')) {
      const p = l.touchPrompt ?? l.prompt;
      const names = touchNames(p);
      promptActions(p).forEach((a, i) => {
        const name = names[i];
        if (a === 'select') expect(name, l.id).toBe('WEAPON');
        if (a === 'special') expect(name, l.id).toBe('MISSILE');
        if (a === 'attack')
          expect(name, l.id).toBe(
            l.id === 'missile-switch' ? 'MISSILE' : /bomb/.test(l.id) ? 'BOMB' : 'SHOOT',
          );
      });
    }
  });

  it('Ice and Wave are both kept: each lesson switches to its beam with WEAPON', () => {
    for (const id of ['ice-beam', 'wave-beam'])
      expect(promptActions(lessonsFor('samus').find((l) => l.id === id)?.prompt ?? ''), id).toContain(
        'select',
      );
  });
});

function at(id: string) {
  const r = trainingRoom('samus');
  r.h.step();
  r.h.idle(CARD_GUARD_FRAMES + 1);
  r.h.tap('jump');
  r.scene.startLesson(ids().indexOf(id));
  return r;
}

describe("Samus's item lessons measure the real thing", () => {
  it('no missiles before the grab; the launcher fires once it is taken', () => {
    const r = at('missile');
    const s = r.scene;
    for (let f = 0; f < 40; f++) r.h.step(f % 10 < 2 ? ['special'] : []);
    expect(s.tracker.shotKinds.has('missile')).toBe(false);
    const go = tbPolicies()['samus:missile'];
    for (let f = 0; f < 300 && !s.ticked.includes('missile'); f++) r.h.step(go?.(s.player, f, s) ?? []);
    expect(s.ticked).toContain('missile');
  });

  it('the Varia Suit: a hit taken before the grab does not count; one after does', () => {
    const r = at('varia-suit');
    const s = r.scene;
    expect(s.dummyShoots).toBe(true);
    // Standing at the start, the dummy's shots hit her: nothing ticks without the suit.
    r.h.until(() => s.player.invuln > 0, 400);
    expect(s.player.invuln).toBeGreaterThan(0);
    expect(s.ticked).not.toContain('varia-suit');
    const go = grab(() => []);
    for (let f = 0; f < 200 && s.tracker.taken.size === 0; f++) r.h.step(go(s.player, f, s));
    expect(s.player.scratch.varia).toBe(1);
    r.h.until(() => s.ticked.includes('varia-suit'), 400);
    expect(s.ticked).toContain('varia-suit');
  });

  it('the Wave Beam lesson needs the wave beam itself: the plain beam does not count', () => {
    const r = at('wave-beam');
    const s = r.scene;
    const go = grab(() => []);
    for (let f = 0; f < 200 && s.tracker.taken.size === 0; f++) r.h.step(go(s.player, f, s));
    // Facing the dummy with the beam selected: hits, but not the wave.
    for (let f = 0; f < 30 && s.player.facing < 0; f++) r.h.step(['right']);
    for (let f = 0; f < 120; f++) r.h.step(f % 12 < 2 ? ['attack'] : []);
    expect(s.ticked).not.toContain('wave-beam');
    const wave = tbPolicies()['samus:wave-beam'];
    for (let f = 0; f < 400 && !s.ticked.includes('wave-beam'); f++) r.h.step(wave?.(s.player, f, s) ?? []);
    expect(s.ticked).toContain('wave-beam');
  });
});

describe("Samus's whole training", () => {
  it('a scripted player grabs each item and finishes every lesson', () => {
    const r = playTraining('samus', tbPolicies());
    expect(r.ticked).toEqual(ids());
    expect(r.results).toEqual(['done']);
    expect(r.h.game.scenes.top).toBe(r.below);
    expect(r.kit.tanks).toBe(1);
    expect(r.kit.varia).toBe(1);
    for (const id of ['missiles', 'long-beam', 'ice-beam', 'wave-beam'])
      expect(r.kit[hasKey(id)], id).toBe(1);
  });
});
