import { beforeEach, describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST } from '@game/context';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { defaultSettings } from '@engine/save/settings';
import type { TouchLabels } from '@engine/input/touch';
import type { Action } from '@engine/input/actions';
import { ScriptedInput } from '@game/sim/headless';
import { Game, type ControlScheme } from '@game/scenes/game';
import { LevelScene } from '@game/scenes/level';
import { PauseScene } from '@game/scenes/pause';
import { GuideScene } from '@game/scenes/guide';
import { AssistOptionsScene, OptionsScene } from '@game/scenes/options';
import { IntroScene } from '@game/scenes/intro';
import { TitleScene } from '@game/scenes/title';
import { InputManager } from '@engine/input/input-manager';
import type { Code } from '@engine/input/bindings';
import { DEV_CODE } from '@game/scenes/cheat';
import { GameOverScene } from '@game/scenes/game-over';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { FileSelectScene } from '@game/scenes/file-select';
import { CardScene, MessageScene } from '@game/scenes/message';
import { CreditsScene } from '@game/scenes/credits';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { SAMUS } from '@game/characters/samus';
import { MENU_TOUCH_LABELS } from '@game/touch-labels';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const assets = {
  sheet: (name: string) => ({ name, frames: new Map() }),
} as unknown as AssetRegistry;

function makeGame(scheme: ControlScheme = 'keyboard') {
  const game = new Game({
    ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    getLevel,
    characters: CHARACTERS,
    settings: defaultSettings(),
    controlScheme: () => scheme,
  });
  const p1 = new ScriptedInput({ steps: [] });
  const p2 = new ScriptedInput({ steps: [] });
  const step = (a: Action[] = []) => {
    p1.setHeld(a);
    p2.setHeld([]);
    p1.next();
    p2.next();
    game.scenes.update([p1, p2]);
  };
  const idle = (n: number) => {
    for (let i = 0; i < n; i++) step();
  };
  return { game, step, idle };
}

/** What main.ts hands the touch pad: the top scene's labels over the menu defaults. */
function shown(game: Game): string {
  const l: TouchLabels = { ...MENU_TOUCH_LABELS, ...game.scenes.top?.touchLabels?.() };
  return [l.jump, l.attack, l.special, l.start, l.select].map((x) => x ?? '-').join(' ');
}

function toLevel(h: ReturnType<typeof makeGame>): LevelScene {
  for (let i = 0; i < 400 && !(h.game.scenes.top instanceof LevelScene); i++) h.step();
  const top = h.game.scenes.top;
  expect(top).toBeInstanceOf(LevelScene);
  return top as LevelScene;
}

describe('touch labels per scene', () => {
  it('menus: A is OK, B is BACK only where there is a way back', () => {
    const h = makeGame();
    h.game.showTitle();
    expect(shown(h.game)).toBe('OK B - - -'); // B only for the developer code
    h.game.scenes.push(new OptionsScene(h.game, () => h.game.scenes.pop()));
    expect(shown(h.game)).toBe('OK BACK - - -');
    // The pause menu's Assists entry (campaign, dev mode) opens a menu with a way back.
    // Its first row is a toggle, so A says CHANGE (it flips the setting).
    h.game.scenes.replace(new AssistOptionsScene(h.game, () => h.game.scenes.pop()));
    expect(shown(h.game)).toBe('CHANGE BACK - - -');
    h.game.scenes.replace(new FileSelectScene(h.game));
    expect(shown(h.game)).toBe('OK BACK - - -');
    h.game.scenes.replace(new CharacterSelectScene(h.game));
    expect(shown(h.game)).toBe('OK BACK - - -');
    // A mid-run pick without a way back, and player 2's pick (touch drives player 1 only).
    const pick = { current: MARIO, onPick: () => undefined };
    h.game.scenes.replace(new CharacterSelectScene(h.game, { ...pick, player: 0 }));
    expect(shown(h.game)).toBe('OK - - - -');
    h.game.scenes.replace(new CharacterSelectScene(h.game, { ...pick, player: 1 }));
    expect(shown(h.game)).toBe('- - - - -');
  });

  it('cards and cut-scenes show only the button that moves on', () => {
    const h = makeGame();
    const next = () => undefined;
    h.game.scenes.push(new IntroScene(h.game, next));
    expect(shown(h.game)).toBe('- - - - -');
    h.game.scenes.replace(new MessageScene(h.game, ['HI'], next));
    expect(shown(h.game)).toBe('OK - - - -');
    h.game.scenes.replace(new MessageScene(h.game, ['HI'], next, 60, ['start']));
    expect(shown(h.game)).toBe('- - - OK -');
    h.game.scenes.replace(new CardScene(h.game, ['THANK YOU'], next));
    expect(shown(h.game)).toBe('- OK - - -');
    h.game.scenes.replace(new CreditsScene(h.game, [], next));
    expect(shown(h.game)).toBe('- - - FASTER -');
    const over = new GameOverScene(h.game, next);
    h.game.scenes.replace(over);
    expect(shown(h.game)).toBe('- - - - -');
    h.idle(300);
    expect(over.prompting).toBe(true);
    expect(shown(h.game)).toBe('OK - - - -');
  });

  it('in a level: player 1’s hero, PAUSE on Start; the pause menu offers RESUME', () => {
    const h = makeGame();
    h.game.newGame(LINK, '1-1', MARIO);
    const level = toLevel(h);
    expect(shown(h.game)).toBe('JUMP SWORD RANG PAUSE TOOLS');
    level.world.players[0]?.def.behaviour.onPowerUp(level.world.players[0], 'mushroom', level.world);
    h.game.scenes.push(new PauseScene(h.game, level.world));
    expect(shown(h.game)).toBe('OK - - RESUME -');
    h.idle(8);
    h.step(['down']);
    expect(shown(h.game)).toBe('OK - - - -');
  });

  it('co-op: player 2’s hero never decides the buttons', () => {
    const h = makeGame();
    h.game.newGame(MARIO, '1-1', SAMUS);
    toLevel(h);
    expect(shown(h.game)).toBe('JUMP RUN - PAUSE -');
  });

  it('the guide turns pages with NEXT and leaves with BACK', () => {
    const h = makeGame();
    h.game.scenes.push(new GuideScene(h.game, MARIO, () => h.game.scenes.pop()));
    expect(shown(h.game)).toBe('NEXT BACK - - -');
  });
});

describe('guides show one control scheme', () => {
  const guide = (scheme: ControlScheme, def = MARIO) => new GuideScene(makeGame(scheme).game, def, () => {});

  it('keyboard: the keys only', () => {
    const g = guide('keyboard');
    const text = g.text.join('\n');
    expect(g.text).toContain('Z - JUMP. HOLD FOR HIGHER, LET');
    expect(text).toContain('HOLD X - RUN.');
    expect(text).toContain('LEFT/RIGHT - WALK.');
    expect(text).not.toMatch(/\bTOUCH\b|D-PAD|\(A\)/);
    expect(g.backHint).toBe('X: BACK');
  });

  it('gamepad: the pad buttons only', () => {
    const g = guide('gamepad');
    const text = g.text.join('\n');
    expect(text).toContain('A - JUMP.');
    expect(text).toContain('HOLD X - RUN.');
    expect(text).toContain('D-PAD - WALK.');
    expect(text).toContain('D-DOWN - CROUCH');
    expect(text).not.toMatch(/\bTOUCH\b|LEFT\/RIGHT/);
  });

  it('touch: each control by its button caption', () => {
    const g = guide('touch');
    const text = g.text.join('\n');
    expect(text).toContain('JUMP - JUMP. HOLD FOR HIGHER');
    expect(text).toContain('HOLD RUN - RUN.');
    expect(text).toContain('D-PAD - WALK. PUSH FAR TO RUN.');
    expect(text).toContain('FIRE - WITH THE FLOWER');
    expect(text).not.toMatch(/LEFT\/RIGHT|HOLD X|\bZ -/);
    expect(g.backHint).toBe('TAP BACK');
    const link = guide('touch', LINK).text.join('\n');
    expect(link).toContain('SWORD - SLASH.');
    expect(link).toContain('TOOLS - PICK THE NEXT TOOL.');
    expect(link).toContain('TOOL BUTTON - SHOWS THE');
    const samus = guide('touch', SAMUS).text.join('\n');
    expect(samus).toContain('BOMB - IN THE BALL: DROP A');
    expect(samus).toContain('MISSILE - FIRE A MISSILE.');
  });

  it('every row fits the page and starts with its key', () => {
    for (const scheme of ['keyboard', 'gamepad', 'touch'] as const)
      for (const c of CHARACTERS)
        for (const l of guide(scheme, c).text)
          expect(l.length, `${c.name} ${scheme}: ${l}`).toBeLessThanOrEqual(30);
  });
});

describe('the developer code by touch', () => {
  it('up up down down left right left right B A on the touch pad unlocks dev mode on the title', () => {
    const settings = defaultSettings();
    const held = new Set<Code>();
    const input = new InputManager(2, settings.input.bindings);
    input.addSource('touch', { poll: () => held });
    const game = new Game({
      ctx: { assets, audio: NULL_AUDIO, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
      getLevel,
      characters: CHARACTERS,
      settings,
      applySettings: () => undefined,
      controlScheme: () => 'touch',
    });
    const frame = () => {
      input.beginFrame();
      game.scenes.update([input.player(0), input.player(1)]);
    };
    game.showTitle();
    for (let i = 0; i < 10; i++) frame();
    const title = game.scenes.top as TitleScene;
    expect(title).toBeInstanceOf(TitleScene);
    // B is on screen (just "B") and does nothing else here.
    expect(title.touchLabels().attack).toBe('B');
    held.add('touch:attack');
    frame();
    held.clear();
    frame();
    expect(game.scenes.top).toBe(title);
    expect(settings.dev).toBe(false);
    for (const a of DEV_CODE) {
      held.add(`touch:${a}`);
      frame();
      held.clear();
      frame();
    }
    expect(settings.dev).toBe(true);
    expect(game.scenes.top).toBe(title);
  });
});
