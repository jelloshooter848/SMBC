import { FixedLoop } from '@engine/loop';
import { Viewport } from '@engine/viewport';
import { CanvasRenderer } from '@engine/gfx/renderer';
import { InputManager } from '@engine/input/input-manager';
import { KeyboardSource } from '@engine/input/keyboard';
import { GamepadSource } from '@engine/input/gamepad';
import { TouchSource } from '@engine/input/touch';
import { KeyHintsOverlay, keyHintItems, keyHintMap } from '@engine/input/key-hints';
import { layoutScreen } from '@engine/input/touch-layout';
import { AssetRegistry } from '@engine/assets/registry';
import { AudioManager } from '@engine/audio/audio-manager';
import { Announcer } from '@engine/a11y/announcer';
import { loadSettings, saveSettings, type Settings } from '@engine/save/settings';
import { importDevPacks, loadEnabledPacks } from '@engine/assets/pack-loader';
import { getLevel as getBuiltinLevel, levelIds, specialLevelIds } from '@content/levels';
import { customLevelId, getCustomLevel, loadLibrary } from '@game/level/library';
import { decodeShare } from '@engine/share';
import { linkCode } from '@game/save/save-code';
import { parseTextMap } from '@game/level/textmap';
import { PALETTES, SPRITES } from '@content/sprites';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import { Game } from '@game/scenes/game';
import { CHARACTERS, heroFor } from '@game/characters/registry';
import { urlLevelStart, urlRules, urlYoshi } from '@game/dev-url';
import { devLockFor, enforceDevLock, urlDevAllowed } from '@game/dev-lock';
import { DEFAULT_ASSIST } from '@game/context';
import { MENU_TOUCH_LABELS } from '@game/touch-labels';
import { miniGameFor } from '@game/minigames';
import { isBonusKind, openBonusGame } from '@game/bonus';
import {
  captureInstallPrompt,
  currentEnv,
  installVariant,
  isIOS,
  isPhone,
  isStandalone,
} from '@engine/platform';
import { stopPageZoom, watchServiceWorker } from '@engine/pwa';
import { bindGestureKeys, CONFIRM_ACTIONS } from '@engine/input/gesture';

function boot(): void {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('#screen canvas missing');
  const overlay = document.getElementById('overlay') as HTMLElement;
  const settings: Settings = loadSettings();
  // The dev-mode lock (0.5.0, game/dev-lock.ts): open on local builds; on a release, only the
  // passphrase (its salted hash in __DEV_LOCK_HASH__) opens it, and a dev flag it didn't open is off.
  const devLock = devLockFor(__RELEASE_BUILD__, __DEV_LOCK_HASH__);
  if (enforceDevLock(devLock, settings)) saveSettings(settings);

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
  // Back from the background (the Home Screen app reopened, a call ended): sound comes back at
  // once if iOS allows, else on the next tap (AudioManager.wake).
  const wake = () => {
    if (document.visibilityState === 'visible') audio.wake();
  };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('pageshow', wake);
  window.addEventListener('focus', wake);
  console.info(`SMBC REMIX ${__APP_VERSION__}`);

  // Home Screen support (0.4.44): the browser's install prompt is saved for Options → ADD TO
  // HOME SCREEN, and production builds register the offline service worker (never `pnpm dev`).
  // The download (0.4.49, `pnpm build:offline`) opened from the disk is a file:// page: no
  // worker (that build has none, and file:// can't register one), no Home Screen row, and a
  // one-time note that it keeps its own saves (game/pwa/home-screen.ts).
  const platform = currentEnv();
  const fileCopy = location.protocol === 'file:';
  const worker =
    import.meta.env.PROD && import.meta.env.MODE !== 'offline' && !fileCopy && 'serviceWorker' in navigator;
  const install = captureInstallPrompt(window);
  const updates = watchServiceWorker(
    import.meta.env.BASE_URL,
    worker ? navigator.serviceWorker : undefined,
    () => location.reload(),
  );
  stopPageZoom(document);
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
      ...specialLevelIds(),
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
    devLock,
    freshSeeds: true,
    homeScreen: {
      ios: isIOS(platform),
      phone: isPhone(platform),
      standalone: isStandalone(platform),
      fileCopy,
      variant: () => installVariant(platform, install.available),
      prompt: () => install.prompt(),
      updateReady: () => updates.ready,
      applyUpdate: () => updates.apply(),
    },
    applySettings: () => applySettings(),
    // A resume link (#save=<code>) answered: off the address, so a reload doesn't ask again.
    clearSaveLink: () => history.replaceState(history.state, '', location.pathname + location.search),
    lastInput: () => touch.lastInput,
    controlScheme: () =>
      touch.shown
        ? 'touch'
        : GamepadSource.available() && [...navigator.getGamepads()].some((g) => g?.connected)
          ? 'gamepad'
          : 'keyboard',
  });
  // Classic mode's cheat counts are saved in batches (Game.flushCheatStats): keep the latest ones
  // when the page goes to the background or is closed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') game.flushCheatStats();
  });
  window.addEventListener('pagehide', () => game.flushCheatStats());

  // Sharing and the clipboard run inside the confirm key's or touch button's own event (iOS
  // allows them only there; engine/input/gesture.ts): a key on its way down, a touch button as it
  // lifts.
  const isConfirmKey = (code: string) =>
    settings.input.bindings.some((b) => CONFIRM_ACTIONS.some((a) => b?.keyboard[a]?.includes(code)));
  bindGestureKeys(game.gestures, window, isConfirmKey);
  touch.onButton = (action, down) => {
    if (!(CONFIRM_ACTIONS as readonly string[]).includes(action)) return;
    if (down) game.gestures.touchDown();
    else game.gestures.touchUp();
  };

  // The screen layout (0.4.45, engine/input/touch-layout.ts): the game and the touch controls in
  // one box, no control over the game; on a phone held upright the game sits at the top.
  // --app-h is the height the page really shows: innerHeight (above a browser's toolbar), but the
  // whole screen when opened from the Home Screen, where iOS can report innerHeight short by the
  // status bar while 100vh is the screen.
  const vhProbe = document.createElement('div');
  vhProbe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:100vh;visibility:hidden;pointer-events:none';
  document.body.appendChild(vhProbe);
  const fullScreen = isStandalone(platform);
  let layoutKey = '';
  function relayout(): void {
    const appH = fullScreen ? Math.max(innerHeight, vhProbe.offsetHeight) : innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const { touchScale } = settings.input;
    const { integerScale } = settings.video;
    const key = [innerWidth, appH, dpr, touch.shown, touchScale, integerScale].join();
    if (key === layoutKey) return;
    layoutKey = key;
    document.documentElement.style.setProperty('--app-h', `${appH}px`);
    const r = viewport.display.getBoundingClientRect();
    const layout = layoutScreen({
      width: innerWidth,
      height: appH,
      insets: { top: r.top, left: r.left, right: innerWidth - r.right, bottom: appH - r.bottom },
      dpr,
      integerScale,
      touch: touch.shown,
      touchScale,
    });
    viewport.fit = layout.fit;
    viewport.resize();
    touch.applyLayout(layout);
  }

  const loop = new FixedLoop({
    step() {
      input.beginFrame();
      game.scenes.update([input.player(0), input.player(1)]);
      game.gestures.endFrame();
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
      relayout(); // cheap unless the window, the pad or a setting changed
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
    relayout();
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
  // A release build ignores `?dev=` entirely (0.5.0, game/dev-lock.ts): the passphrase is the only way in.
  if (dev !== null && urlDevAllowed(devLock)) {
    settings.dev = dev !== '0' && dev !== 'false';
    applySettings();
  }
  const shared = /^#level=([A-Za-z0-9_-]+)/.exec(location.hash)?.[1];
  // A save code's resume link: the title asks which file to load it into (Game.offerSaveLink).
  game.saveLink = linkCode(location.hash);
  // A resume link pasted into the address bar of the open game changes only the hash.
  window.addEventListener('hashchange', () => {
    const code = linkCode(location.hash);
    if (code !== null) game.saveLink = code;
  });
  const level = params.get('level');
  // Outside dev mode a link opens no campaign content (0.5.0, dev-url.ts urlLevelStart): custom
  // levels as before, SMB and Lost Levels levels as a Classic run, anything else the title.
  const start = urlLevelStart(params, settings.dev);
  if (level && start) {
    // `&rules=classic|current` (dev mode only, dev-url.ts): the run's rules; `char` reads the
    // roster for them (the Classic extras too). `&mode=classic` (dev mode only): a Classic mode
    // run, as the dev Level select's Mode row (its rules: `rules=`, else Options' Classic rules).
    const classic = start === 'classic';
    const rules = urlRules(params, settings.dev) ?? (classic ? settings.classicRules : 'current');
    // `&yoshi=1|ride` (dev mode only): the Classic Yoshi mount for this session (YM-1).
    game.yoshiUrl = urlYoshi(params, settings.dev);
    const roster = game.rosterFor(rules);
    const c1 = roster.find((c) => c.id === params.get('char')) ?? (roster[0] as (typeof roster)[0]);
    const c2 = roster.find((c) => c.id === params.get('char2')) ?? null;
    // Classic mode is one player: `char2` is for free play only.
    if (classic) game.devClassicGame(c1, level, rules);
    else game.newGame(c1, level, c2, { rules });
    // The full kit of the def played under the run's rules (TG-8).
    const hero = heroFor(c1, game.liveRules);
    if (settings.dev && params.get('kit') === 'full' && hero.devKit) {
      game.state.kit = hero.devKit();
      if (game.liveRules === 'classic') {
        // Classic: the top power state too (TG-8, TG-21).
        if (hero.damage.kind === 'powerup') game.state.powerState = hero.damage.states.at(-1) ?? 'small';
      } else if (game.state.kit.maxHp) game.state.hp = game.state.kit.maxHp;
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
