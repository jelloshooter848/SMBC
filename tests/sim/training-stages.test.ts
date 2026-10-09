import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { defaultSettings } from '@engine/save/settings';
import { DEFAULT_ASSIST } from '@game/context';
import { Game, type ControlScheme } from '@game/scenes/game';
import { CHARACTERS } from '@game/characters/registry';
import { HeroStageScene } from '@game/tutorial/hero-stage';
import { HERO_STAGES } from '@game/tutorial/heroes';
import { itemInfo, heroItems } from '@game/items/catalog';
import { tokenCaptions } from '@game/tutorial/stage-prompts';
import { levelTouchLabels } from '@game/touch-labels';
import { useStorage } from './heroes-harness';

// Every hero stage's words (0.4.37): one prompt fits the box (3 lines) with keys, with a pad and on
// touch, item name and all; touch names a tool by its button and never says USE TOOL, USE WEAPON,
// THROW or CAST; the power-ups come in their hero's order (docs/POWERUPS.md), the grow item first.

useStorage();

const SCHEMES: readonly ControlScheme[] = ['keyboard', 'gamepad', 'touch'];
/** What touch never shows: the belt's generic verbs (the buttons read the tool's own name). */
const TOUCH_NEVER = /\b(USE TOOL|USE WEAPON|THROW|CAST)\b/;

function stageIn(heroId: string, scheme: ControlScheme): HeroStageScene {
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const game = new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    settings: defaultSettings(),
    applySettings: () => undefined,
    controlScheme: () => scheme,
  });
  const hero = CHARACTERS.find((c) => c.id === heroId);
  const stage = HERO_STAGES[heroId];
  if (!hero || !stage) throw new Error(heroId);
  return new HeroStageScene(game, hero, stage, { onEnd: () => undefined });
}

describe('the hero stages', () => {
  for (const [id, stage] of Object.entries(HERO_STAGES)) {
    it(`${id}: every prompt fits 3 lines in every scheme; touch names the buttons`, () => {
      const long: string[] = [];
      for (const scheme of SCHEMES) {
        const s = stageIn(id, scheme);
        const labels = levelTouchLabels(s.world.players[0], s.world);
        const texts: string[] = [];
        for (const l of stage.tutorial.lessons) {
          for (const taken of l.item ? [false, true] : [true]) {
            const lines = s.director.linesFor(l, taken, labels);
            texts.push(lines.join(' '));
            if (lines.length > 3) long.push(`${l.id} ${scheme} ${taken}: ${lines.join(' / ')}`);
            for (const line of lines) expect(line.length).toBeLessThanOrEqual(s.director.cols);
            expect(lines.join(' ')).not.toMatch(/[[\]]/);
          }
          if (scheme === 'touch') {
            for (const t of [l.text, l.touchText, l.get, l.touchGet])
              for (const tok of tokenCaptions(t ?? ''))
                if (TOUCH_NEVER.test(tok.ability))
                  expect(
                    tok.caption,
                    `${id} ${l.id}: ${tok.ability} names its button on touch`,
                  ).toBeDefined();
          }
        }
        // Toad's gate cards too.
        for (const l of stage.tutorial.lessons)
          if (l.retry)
            texts.push(
              s.director
                .linesFor({ id: l.id, at: l.at, done: l.done, text: l.retry }, true, labels)
                .join(' '),
            );
        if (scheme === 'touch') for (const t of texts) expect(t, `${id} on touch`).not.toMatch(TOUCH_NEVER);
        else for (const t of texts) expect(t).toMatch(/./);
      }
      expect(long).toEqual([]);
    });

    it(`${id}: the power-ups come in the hero's own order, the grow item first`, () => {
      const items = stage.tutorial.lessons.flatMap((l) => (l.item ? [l.item] : []));
      const all = heroItems(id)?.items.map((i) => i.id) ?? [];
      for (const it of items) expect(itemInfo(id, it), it).not.toBeNull();
      expect([...items].sort((a, b) => all.indexOf(a) - all.indexOf(b))).toEqual(items);
      if (items.length) expect(items[0]).toBe(heroItems(id)?.grow);
      // Each item is in the stage's map as a real power block, with its hero's entry.
      const s = stageIn(id, 'keyboard');
      const entries = (s.level.heroItems ?? []).map((e) => e.items[id]);
      for (const it of items.slice(1)) expect(entries, it).toContain(it);
    });
  }
});
