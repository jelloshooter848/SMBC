import { describe, expect, it } from 'vitest';
import { LevelScene } from '@game/scenes/level';
import { SOPHIA } from '@game/characters/sophia';
import { SOPHIA_CLASSIC } from '@game/characters/sophia/classic';
import { MARIO } from '@game/characters/mario';
import { sophiaState } from '@game/characters/sophia/state';
import type { CharacterDef } from '@game/characters/character';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { makeGame, useStorage } from './heroes-harness';

// The touch d-pad's zones follow player 1's hero (CharacterDef.touchDpad, Scene.touchDpad):
// Sophia III never crouches, so her pad is an even eight-way pad and Down + a direction (Wall
// Climb down a cliff or into a gap) is as easy as Up + a direction. Everyone else keeps the
// default pad, whose down-diagonals need a firmer push so running never crouches by accident.

useStorage();

function level(def: CharacterDef, rules: 'classic' | 'campaign') {
  const settings: Settings = { ...defaultSettings(), dev: true };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  h.game.devStart('1-1', def, 'fire', false, undefined, { rules, classic: rules === 'classic' });
  h.until(() => h.top() instanceof LevelScene, 600);
  return { h, scene: h.top() as LevelScene };
}

describe('touch d-pad zones by hero', () => {
  it('Classic Sophia III gets the eight-way pad in a level', () => {
    const { scene } = level(SOPHIA, 'classic');
    expect(scene.world.player.def).toBe(SOPHIA_CLASSIC);
    expect(scene.touchDpad()).toBe('eight-way');
  });

  it('the campaign tank gets it too; Jason on foot keeps the default pad', () => {
    const { scene } = level(SOPHIA, 'campaign');
    const p = scene.world.player;
    expect(scene.touchDpad()).toBe('eight-way');
    const st = sophiaState(p);
    const was = st.jason;
    st.jason = {} as unknown as NonNullable<typeof st.jason>;
    expect(SOPHIA.touchDpad?.(p)).toBe('default');
    st.jason = was;
  });

  it('Mario keeps the default pad', () => {
    const { scene } = level(MARIO, 'classic');
    expect(scene.touchDpad()).toBe('default');
  });
});
