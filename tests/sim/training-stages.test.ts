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
import { lessonBlocks, lessonItems, tokenCaptions } from '@game/tutorial/stage-prompts';
import { levelTouchLabels } from '@game/touch-labels';
import { T } from '@game/level/tiles';
import { TrainingTarget } from '@game/tutorial/targets';
import { ownsItem } from '@game/tutorial/kit';
import { useStorage } from './heroes-harness';

// Every hero stage's words (0.4.37): one prompt fits the box (3 lines) with keys, with a pad and on
// touch, item name and all; touch names a tool by its button and never says USE TOOL, USE WEAPON,
// THROW or CAST; the power-ups come in their hero's order (docs/POWERUPS.md), the grow item first.

useStorage();

const SCHEMES: readonly ControlScheme[] = ['keyboard', 'gamepad', 'touch'];
/** What touch never shows: the belt's generic verbs (the buttons read the tool's own name). */
const TOUCH_NEVER = /\b(USE TOOL|USE WEAPON|THROW|CAST)\b/;

/**
 * Each hero's items in the order their kit builds up in the campaign (docs/POWERUPS.md 6.2: world
 * by world, the grow item first): the stages give them in this order.
 */
const KIT_ORDER: Readonly<Record<string, readonly string[]>> = {
  luigi: ['mushroom'],
  link: [
    'heart-container',
    'bomb-bag',
    'shield-spell',
    'jump-spell',
    'blue-ring',
    'fire-spell',
    'magical-sword',
  ],
  megaman: ['helmet', 'saw-disc', 'leaf-guard', 'rush-coil', 'flame-wave', 'homing-knuckle', 'bolt'],
  samus: ['energy-tank', 'long-beam', 'missiles', 'ice-beam', 'varia-suit', 'wave-beam'],
  // The Double and Triple Shot are one lesson (owner, 0.4.38), after the Cross: the Stopwatch,
  // with its fire bar, ends the stage.
  simon: [
    'pot-roast',
    'chain-whip',
    'dagger',
    'holy-water',
    'axe',
    'morning-star',
    'cross',
    'double-shot',
    'triple-shot',
    'stopwatch',
  ],
  ryu: ['medicine', 'throwing-star', 'ninpo-scroll', 'windmill', 'fire-wheel', 'jump-slash'],
  bill: ['medal', 'machine-gun', 'laser', 'flame-gun', 'spread-gun'],
  sophia: ['power-capsule', 'crusher', 'triple-missile', 'wall-climb', 'ceiling-climb', 'homing-missile'],
};

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

    it(`${id}: a stretch rebuilt past a lesson shows its block used and its targets gone`, () => {
      const s = stageIn(id, 'keyboard');
      const lessons = stage.tutorial.lessons;
      const last = lessons.length - 1;
      s.director.startAt(last);
      for (const l of lessons.slice(0, last)) {
        for (const b of lessonBlocks(l)) expect(s.world.map.get(b.x, b.y), l.id).toBe(T.USED);
        expect(
          s.world.entities.some((e) => e instanceof TrainingTarget && e.lesson === l.id),
          `${l.id}'s targets`,
        ).toBe(false);
      }
      // ...and the kit floor gives every earlier item.
      for (const l of lessons.slice(0, last))
        for (const it of lessonItems(l)) expect(ownsItem(s.world.player, it), it).toBe(true);
    });

    it(`${id}: the power-ups come in the order the hero's kit builds up, the grow item first`, () => {
      const items = stage.tutorial.lessons.flatMap(lessonItems);
      for (const it of items) expect(itemInfo(id, it), it).not.toBeNull();
      expect(items).toEqual(KIT_ORDER[id]);
      if (items.length) expect(items[0]).toBe(heroItems(id)?.grow);
      // Each item is in the stage's map as a real power block, with its hero's entry.
      const s = stageIn(id, 'keyboard');
      const entries = (s.level.heroItems ?? []).map((e) => e.items[id]);
      for (const it of items.slice(1)) expect(entries, it).toContain(it);
    });
  }
});
