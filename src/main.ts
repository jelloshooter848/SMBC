import { FixedLoop } from '@engine/loop';
import { Viewport } from '@engine/viewport';
import { CanvasRenderer } from '@engine/gfx/renderer';
import { InputManager } from '@engine/input/input-manager';
import { KeyboardSource } from '@engine/input/keyboard';
import { GamepadSource } from '@engine/input/gamepad';
import { TouchSource } from '@engine/input/touch';
import { AssetRegistry } from '@engine/assets/registry';
import { AudioManager } from '@engine/audio/audio-manager';
import { Announcer } from '@engine/a11y/announcer';
import { loadSettings, saveSettings, type Settings } from '@engine/save/settings';
import { importDevPacks, loadEnabledPacks } from '@engine/assets/pack-loader';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import { Game } from '@game/scenes/game';
import { CHARACTERS } from '@game/characters/registry';
import { DEFAULT_ASSIST } from '@game/context';

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
  if (GamepadSource.available()) input.addSource('gamepad', new GamepadSource());
  const touch = new TouchSource(overlay, settings.input.touchScale);
  input.addSource('touch', touch);

  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const audio = new AudioManager();
  audio.registerSongs(songs);
  audio.registerSfx(sfx);
  const unlock = () => audio.unlock();
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('gamepadconnected', unlock);
  const announcer = new Announcer(document.getElementById('announcer'));

  let fps = 0;
  let frames = 0;
  let fpsAt = performance.now();
  const ctx = { assets, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: false };
  const game = new Game({
    ctx,
    getLevel,
    characters: CHARACTERS,
    debugKeys: keyboard.down,
    fps: () => fps,
    settings,
    input,
    announcer,
    applySettings: () => applySettings(),
  });

  const loop = new FixedLoop({
    step() {
      input.beginFrame();
      game.scenes.update(input.player(0));
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
    const touchOn =
      settings.input.touch === 'on' || (settings.input.touch === 'auto' && TouchSource.likelyTouchDevice());
    touch.show(touchOn);
    touch.setScale(settings.input.touchScale);
    const { slowMotion, ...assist } = settings.assist;
    Object.assign(ctx.assist, assist);
    loop.stepDivider = slowMotion;
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
  const level = params.get('level');
  if (level)
    game.newGame(
      CHARACTERS.find((c) => c.id === params.get('char')) ?? (CHARACTERS[0] as (typeof CHARACTERS)[0]),
      level,
    );
  else game.showTitle();
  loop.start();
}

boot();
