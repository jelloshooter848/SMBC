import { FixedLoop } from '@engine/loop';
import { Viewport } from '@engine/viewport';
import { CanvasRenderer } from '@engine/gfx/renderer';
import { InputManager } from '@engine/input/input-manager';
import { KeyboardSource } from '@engine/input/keyboard';
import { GamepadSource } from '@engine/input/gamepad';
import { TouchSource } from '@engine/input/touch';
import { KeyHintsOverlay, keyHintItems, keyHintMap } from '@engine/input/key-hints';
import { AssetRegistry } from '@engine/assets/registry';
import { AudioManager } from '@engine/audio/audio-manager';
import { Announcer } from '@engine/a11y/announcer';
import { loadSettings, saveSettings, type Settings } from '@engine/save/settings';
import { importDevPacks, loadEnabledPacks } from '@engine/assets/pack-loader';
import { getLevel as getBuiltinLevel, levelIds } from '@content/levels';
import { customLevelId, getCustomLevel, loadLibrary } from '@game/level/library';
import { decodeShare } from '@engine/share';
import { parseTextMap } from '@game/level/textmap';
import { PALETTES, SPRITES } from '@content/sprites';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import { Game } from '@game/scenes/game';
import { CHARACTERS } from '@game/characters/registry';
import { DEFAULT_ASSIST } from '@game/context';
import { MENU_TOUCH_LABELS } from '@game/touch-labels';
import { miniGameFor } from '@game/minigames';
import { isBonusKind, openBonusGame } from '@game/bonus';

function boot(): void {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('#screen canvas missing');
  const overlay = document.getElementById('overlay') as HTMLElement;
  const settings: Settings = loadSettings();

  const viewport = new Viewport(canvas, { integerScale: settings.video.integerScale });
  const renderer = new CanvasRenderer(viewport.ctx);
  const input = new InputManager(2, settings.input.bindings);
  const keyboard = new KeyboardSource();
  input.addSource('keyboard', keyboard);
  const touch = new TouchSource(overlay, settings.input.touchScale);
  const keyHints = new KeyHintsOverlay(overlay);
  input.addSource('touch', touch);
  if (GamepadSource.available()) {
    const pad = new GamepadSource();
    // Auto touch mode hides the on-screen pad once a gamepad button is used (keys: see TouchSource).
    pad.onAnyPress = () => touch.noteInput('keys');
    input.addSource('gamepad', pad);
  }

  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const audio = new AudioManager();
  audio.registerSongs(songs);
  audio.registerSfx(sfx);
  // Browsers only start audio inside a user gesture; iOS Safari is strict about which events count,
  // so listen to several and keep listening so an interrupted context (phone call) recovers.
  const unlock = () => audio.unlock();
  for (const ev of ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click', 'gamepadconnected']) {
    window.addEventListener(ev, unlock, { passive: true });
  }
  console.info(`SMBC REMIX ${__APP_VERSION__}`);
  const announcer = new Announcer(document.getElementById('announcer'));

  let fps = 0;
  let frames = 0;
  let fpsAt = performance.now();
  const ctx = { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: false };
  const getLevel = (id: string) =>
    (id.startsWith('custom-') ? getCustomLevel(loadLibrary(), id) : null) ?? getBuiltinLevel(id);
  const game = new Game({
    ctx,
    getLevel,
    listLevels: () => [
      ...levelIds(),
      ...Object.keys(loadLibrary().levels)
        .sort()
        .map((n) => customLevelId(n)),
    ],
    canvas,
    overlay,
    viewport,
    characters: CHARACTERS,
    debugKeys: keyboard.down,
    fps: () => fps,
    settings,
    input,
    announcer,
    titleIntro: true,
    freshSeeds: true,
    applySettings: () => applySettings(),
    lastInput: () => touch.lastInput,
    controlScheme: () =>
      touch.shown
        ? 'touch'
        : GamepadSource.available() && [...navigator.getGamepads()].some((g) => g?.connected)
          ? 'gamepad'
          : 'keyboard',
  });

  const loop = new FixedLoop({
    step() {
      input.beginFrame();
      game.scenes.update([input.player(0), input.player(1)]);
      // The buttons say what they do in the scene now on top: its labels over the menu defaults
      // (setLabels only touches buttons whose label changed).
      const labels = { ...MENU_TOUCH_LABELS, ...game.scenes.top?.touchLabels?.() };
      // Key hints (Options > Controls): the bound keyboard key with each ability, on the touch
      // buttons when the pad is up, else as a small reference beside the game.
      const keys = settings.input.keyHints ? keyHintMap(settings.input.bindings[0]?.keyboard) : null;
      if (touch.shown) {
        touch.setLabels(labels);
        touch.setKeyHints(keys);
      }
      keyHints.update(keys && !touch.shown ? keyHintItems(labels, keys) : null);
    },
    render() {
      game.scenes.render(renderer);
      if (settings.video.showFps) renderer.debugText(`${fps.toFixed(0)} FPS`, 200, 236, '#fff');
      viewport.present();
      frames++;
      const now = performance.now();
      if (now - fpsAt >= 1000) {
        fps = (frames * 1000) / (now - fpsAt);
        frames = 0;
        fpsAt = now;
      }
    },
  });

  let packToken = 0;
  function applySettings(): void {
    saveSettings(settings);
    viewport.opts.integerScale = settings.video.integerScale;
    viewport.resize();
    assets.setMode(settings.video.palette);
    ctx.reduceFlashing = settings.video.reduceFlashing;
    audio.setVolumes(settings.audio);
    input.bindings = settings.input.bindings;
    touch.setMode(settings.input.touch);
    touch.setDpadStyle(settings.input.dpad);
    touch.setScale(settings.input.touchScale);
    // Assists are developer tools: they only take effect while dev mode is on (values are kept).
    const { slowMotion, ...assist } = settings.assist;
    Object.assign(ctx.assist, settings.dev ? assist : DEFAULT_ASSIST);
    loop.stepDivider = settings.dev ? slowMotion : 1;
    announcer.enabled = settings.announce;
    const token = ++packToken;
    void loadEnabledPacks(settings.packs, assets).then((packs) => {
      if (token !== packToken) return;
      const files = new Map<string, Blob>();
      for (const p of packs) for (const [id, blob] of p.audio) files.set(id, blob);
      audio.setOverrides(files);
      for (const p of packs) for (const w of p.warnings) console.warn(`[pack ${p.name}] ${w}`);
    });
  }

  applySettings();
  // In dev, folders listed in user-packs/index.json are imported automatically (and gitignored).
  if (import.meta.env.DEV) {
    void importDevPacks().then((names) => {
      let changed = false;
      for (const n of names) {
        if (!settings.packs.includes(n)) {
          settings.packs.push(n);
          changed = true;
        }
      }
      if (changed) applySettings();
    });
  }

  const params = new URLSearchParams(location.search);
  const dev = params.get('dev');
  if (dev !== null) {
    settings.dev = dev !== '0' && dev !== 'false';
    applySettings();
  }
  const shared = /^#level=([A-Za-z0-9_-]+)/.exec(location.hash)?.[1];
  const level = params.get('level');
  if (level) {
    const c1 =
      CHARACTERS.find((c) => c.id === params.get('char')) ?? (CHARACTERS[0] as (typeof CHARACTERS)[0]);
    const c2 = CHARACTERS.find((c) => c.id === params.get('char2')) ?? null;
    game.newGame(c1, level, c2);
    if (params.get('kit') === 'full' && c1.devKit) {
      game.state.kit = c1.devKit();
      if (game.state.kit.maxHp) game.state.hp = game.state.kit.maxHp;
    }
  } else if (shared) {
    game.showTitle();
    void decodeShare(shared)
      .then((text) => game.playShared(parseTextMap(text, 'custom-shared')))
      .catch((e: Error) => console.warn(`shared level could not be loaded: ${e.message}`));
  } else game.showTitle();
  // Dev server only: `?minigame=luigi` plays that hero's mini game straight away, over the title
  // (for tuning and screenshots; the scene is window.__miniGame); the result is logged and the
  // title follows.
  const minigame = import.meta.env.DEV ? miniGameFor(params.get('minigame') ?? '') : null;
  if (minigame) {
    const scene = minigame.create(game, (result) => {
      console.info(`[dev] mini game ${minigame.hero}: ${result}`);
      game.showTitle();
    });
    (window as unknown as { __miniGame?: unknown }).__miniGame = scene;
    game.scenes.push(scene);
  }
  // Dev server only: `?bonus=toad-house|memory|slots` (optionally `&seed=N`) plays that bonus game
  // over the title (the scene is window.__bonusGame, the game window.__game); the title follows.
  const bonus = import.meta.env.DEV ? params.get('bonus') : null;
  if (isBonusKind(bonus)) {
    game.inventoryUnlocked = true;
    const seed = Number(params.get('seed'));
    const scene = openBonusGame(
      game,
      bonus,
      (result) => {
        console.info(`[dev] bonus ${bonus}: ${JSON.stringify(result.prizes)}`);
        game.showTitle();
      },
      Number.isFinite(seed) && params.has('seed') ? { seed } : {},
    );
    (window as unknown as { __bonusGame?: unknown }).__bonusGame = scene;
  }
  if (import.meta.env.DEV) (window as unknown as { __game?: unknown }).__game = game;
  loop.start();
  (window as unknown as { __bootDone?: () => void }).__bootDone?.();
}

boot(); // a throw here reaches the inline error reporter in index.html
