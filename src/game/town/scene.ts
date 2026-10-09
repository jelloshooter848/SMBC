import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { DOORS, GATE, SCREEN_AT, SCREEN_NAMES, type IndoorId, type TownDoor } from '@content/town/kakariko';
import { townArt } from '@content/sprites/town';
import type { CharacterDef } from '../characters/character';
import { startHp } from '../characters/character';
import type { Game } from '../scenes/game';
import { abilityHint, controlScheme } from '../scenes/hints';
import { MenuScene } from '../scenes/menu';
import { miniGameDevItems } from '../minigames/menu';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { fontText } from '../hud/text';
import { playStoryCards } from '../story/cards';
import { DOOR_LOCKED, NO_ONE_ELSE, SHOP_SHUT } from '../story/kakariko';
import { TopDownWorld, type TdEvent } from '../topdown/world';
import { renderWorld } from '../topdown/render';
import { HUD_H, ROOM_H, TILE } from '../topdown/geometry';
import { fontOf, sheetLookup, type TdSheets, type TdView } from '../topdown/view';
import { talkTarget } from '../topdown/person';
import { TownHero } from './hero';
import { folkSpawner, Kid, Townsperson, type TalkContext } from './folk';
import { indoorName, isOutdoor, villageDungeon } from './village';

/*
 * Kakariko Village (0.4.41, docs/WORLD_MAP.md "Kakariko Village"): World 2's hidden map spot,
 * walked from above as in A Link to the Past. Six outdoor screens that slide into each other, the
 * rooms inside the buildings (a fade in and out), townsfolk to talk to, the healer, and SELECT
 * (TOOLS; HERO on the touch pad) to switch to the next freed hero. No enemies, no damage, no
 * clock. The south gate (or the menu's Quit to map) goes back to the map; the secret house's door
 * loads the side-view Top Secret Area (Game.enterSecretHouse), whose pipe comes back to its step.
 */

/** The village's own sheets for the kit: its tiles (and the back room's dim ones), the townsfolk. */
export const TOWN_SHEETS: TdSheets = {
  tiles: 'town',
  tilesDark: 'town-dark',
  hero: 'td-mario',
  enemies: 'town-folk',
};

/**
 * Pixels a frame the view slides from screen to screen: brisker than a dungeon's (the kit's 4), as
 * a walk round town crosses many edges (about 0.7 s across, 0.5 s up or down).
 */
export const TOWN_SLIDE_SPEED = 6;
/** Frames of each half of a fade (out, then in). */
export const FADE_FRAMES = 16;
/** Frames after a hero switch before the next one (accidental double presses). */
export const SWITCH_GAP = 20;
/** Frames the smoke puff of a switch shows. */
export const PUFF_FRAMES = 18;
/** Frames a notice (a shut door, nobody to switch to) stays on screen; it is said as it shows. */
export const NOTICE_FRAMES = 150;
/** Where the hero walks in to from the gate (pixels, the gate screen). */
export const GATE_IN = { x: GATE.col * TILE, y: (GATE.row - 2) * TILE };

type Fade = { t: number; out: boolean; then: () => void };

export interface TownOptions {
  /** The first visit: the guard says hello as the hero walks in. */
  first: boolean;
  /** The village's doors (tests lock one to try the hook). */
  doors?: readonly TownDoor[];
}

/** The village name, said and shown. */
export const VILLAGE_NAME = 'KAKARIKO VILLAGE';

const spoken = (text: string) =>
  text.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

export class TownScene implements Scene {
  readonly world: TopDownWorld;
  readonly first: boolean;
  /** Frames since the scene started. */
  t = 0;
  fade: Fade | null = null;
  /** A switch just happened: frames until another is allowed. */
  switchT = 0;
  /** The smoke puff of the last switch (room pixels) and its age. */
  puff: { x: number; y: number; t: number } | null = null;
  notice: { text: string; until: number } | null = null;
  /** Someone is being talked to (their cards are up). */
  talking: Townsperson | null = null;
  /** The guard's hello is still to come (first visit, after the walk in). */
  private greet: boolean;
  /** Who the prompt was last said for (each is said once as they come in reach). */
  private prompted: Townsperson | null = null;
  private music: string | null = null;
  private screen: string;
  readonly view: TdView;

  constructor(
    readonly game: Game,
    opts: TownOptions,
  ) {
    this.first = opts.first;
    this.greet = opts.first;
    const hero = (x: number, y: number) =>
      new TownHero(x, y, {
        character: () => game.state.character,
        power: () => game.state.powerState,
        kit: () => game.state.kit,
      });
    this.world = new TopDownWorld(villageDungeon(townArt, opts.doors), {
      hero,
      spawners: { folk: folkSpawner },
      has: (secret) => game.mapProgress.secrets.includes(secret),
      slideSpeed: TOWN_SLIDE_SPEED,
    });
    this.world.events.length = 0;
    // In through the south gate: from just past the edge, walking up a couple of tiles.
    this.world.hero.x = GATE.col * TILE;
    this.world.hero.y = GATE.row * TILE + 4; // (just short of the edge: past it is the way out)
    this.world.hero.facing = 'up';
    this.world.walkIn = { dir: 'up', ...GATE_IN };
    this.screen = this.world.room.id;
    const world = this.world;
    this.view = {
      get frame() {
        return world.frame;
      },
      reduceFlashing: game.ctx.reduceFlashing,
      sheets: { ...TOWN_SHEETS },
      sheet: sheetLookup(game.ctx.assets),
    };
  }

  get hero(): TownHero {
    return this.world.hero as TownHero;
  }

  enter(): void {
    this.music = null;
    this.updateMusic();
  }

  /** Back from the Top Secret Area: on the secret house's step, fading in. */
  backFromSecretHouse(): void {
    this.world.arriveAt('secret-house');
    this.world.events.length = 0;
    this.fade = { t: 0, out: false, then: () => undefined };
    this.music = null;
    this.say(`${spoken(VILLAGE_NAME)}. ${spoken(SCREEN_NAMES.gardens)}.`);
  }

  /** Announced on the first frame (the scene may be built before the announcer is listening). */
  private announced = false;

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  private sfx(id: string): void {
    this.game.ctx.audio.sfx(id);
  }

  /** The hero can act (walk, talk, switch): nothing is sliding, fading or walking him in. */
  get free(): boolean {
    const w = this.world;
    return !this.fade && !w.transition && !w.walkIn && !w.entering && !w.left && !this.talking;
  }

  /** The words' context: who walks the village now. */
  talkContext(): TalkContext {
    const hero = this.game.state.character;
    return {
      hero,
      heroName: fontText(hero.name.toUpperCase()),
      firstVisit: this.first,
      switchButton: controlScheme(this.game) === 'touch' ? 'HERO' : 'TOOLS',
    };
  }

  touchLabels(): TouchLabels {
    if (!this.free) return { ...NO_TOUCH_BUTTONS };
    const target = talkTarget(this.world);
    const talk = target instanceof Townsperson && target.pages(this.talkContext()).length > 0;
    return { ...NO_TOUCH_BUTTONS, jump: talk ? target.verb : null, start: 'MENU', select: 'HERO' };
  }

  update(input: InputFrame): void {
    this.t++;
    if (!this.announced) {
      this.announced = true;
      this.say(`${spoken(VILLAGE_NAME)}. ${this.helpSaid()}`);
    }
    if (this.puff && ++this.puff.t >= PUFF_FRAMES) this.puff = null;
    if (this.switchT > 0) this.switchT--;
    if (this.fade) {
      this.updateFade();
      return;
    }
    if (this.free) {
      if (input.pressed('start')) {
        this.game.scenes.push(new TownMenuScene(this.game, () => this.leave()));
        return;
      }
      if (input.pressed('select')) this.switchHero();
      else if (input.pressed('jump') || input.pressed('special')) {
        const p = talkTarget(this.world);
        if (p instanceof Townsperson && this.talk(p)) return;
      }
    }
    this.world.update(input);
    for (const e of this.world.events.splice(0)) this.onEvent(e);
    if (this.greet && !this.world.walkIn && !this.fade) {
      this.greet = false;
      const guard = this.world.entities.find((e) => e instanceof Townsperson && e.id === 'guard');
      if (guard instanceof Townsperson) this.talk(guard);
    }
    this.updatePrompt();
  }

  /** How to play here, said on arrival. */
  private helpSaid(): string {
    const g = this.game;
    return `Walk with the arrows. ${abilityHint(g, 'TALK', 'jump')} talks. ${
      controlScheme(g) === 'touch' ? 'HERO' : abilityHint(g, 'TOOLS', 'select')
    } switches heroes.`;
  }

  /** Says who is in reach to talk to, once as they come in reach. */
  private updatePrompt(): void {
    const p = this.free ? talkTarget(this.world) : null;
    const who = p instanceof Townsperson && p.pages(this.talkContext()).length > 0 ? p : null;
    if (who && who !== this.prompted) this.say(`${spoken(who.name)}. ${this.promptText(who)}.`);
    this.prompted = who;
  }

  /** The prompt over someone in reach: TALK (or READ, LOOK) and its key. */
  promptText(p: Townsperson): string {
    return abilityHint(this.game, p.verb, 'jump');
  }

  /** Talks to `p` (their cards over the village); false when they have nothing to say. */
  talk(p: Townsperson): boolean {
    const ctx = this.talkContext();
    const pages = p.pages(ctx);
    if (pages.length === 0) return false;
    p.faceToward(this.hero.feet());
    if (p instanceof Kid) p.talking = true;
    this.talking = p;
    // The box goes where it hides the hero least.
    const bottom = this.hero.y < ROOM_H / 2;
    playStoryCards(
      this.game,
      null,
      pages,
      () => {
        p.rest();
        if (p instanceof Kid) p.talking = false;
        this.talking = null;
        if (p.after(ctx) === 'heal') this.heal();
      },
      { bottom },
    );
    return true;
  }

  /** The healer: the hero's hit points back in full, for free. */
  heal(): void {
    const s = this.game.state;
    s.hp = fullHp(s.character, s.kit);
    this.sfx('powerup');
    this.say('Health restored.');
  }

  /** SELECT: the next freed hero, in character select's order. */
  switchHero(): void {
    if (this.switchT > 0) return;
    this.switchT = SWITCH_GAP;
    const next = nextHero(this.game);
    if (!next) {
      this.sfx('bump');
      this.notify(NO_ONE_ELSE);
      return;
    }
    this.game.setHero(0, next);
    this.puff = { x: this.hero.x, y: this.hero.y, t: 0 };
    this.sfx('hero-switch');
    this.say(spoken(next.name));
    this.prompted = null;
  }

  private notify(text: string): void {
    this.notice = { text, until: this.t + NOTICE_FRAMES };
    this.say(spoken(text));
  }

  private onEvent(e: TdEvent): void {
    switch (e.type) {
      case 'room': {
        this.updateMusic();
        if (e.id !== this.screen) {
          this.screen = String(e.id);
          this.notice = null;
          if (isOutdoor(this.screen)) this.say(`${spoken(SCREEN_NAMES[this.screen])}.`);
        }
        return;
      }
      case 'enter': {
        this.sfx('door-open');
        this.fadeOut(() => {
          if (e.to === '@tsa') {
            this.game.enterSecretHouse();
            return;
          }
          this.world.goThrough();
          this.world.events.length = 0;
          this.screen = this.world.room.id;
          this.updateMusic();
          const room = this.world.room.id;
          this.say(`${spoken(isOutdoor(room) ? SCREEN_NAMES[room] : indoorName(room as IndoorId))}.`);
        });
        return;
      }
      case 'door-shut': {
        this.sfx('bump');
        this.notify(e.id === 'shop' ? SHOP_SHUT : DOOR_LOCKED);
        return;
      }
      case 'leave':
        this.fadeOut(() => this.leave());
        return;
      case 'hen':
        this.sfx('hen');
        return;
    }
  }

  /** Back to the map, the file saved (Game.leaveTown). */
  leave(): void {
    this.game.ctx.audio.stopMusic();
    this.game.leaveTown();
  }

  private fadeOut(then: () => void): void {
    this.fade = {
      t: 0,
      out: true,
      then: () => {
        then();
        if (this.game.town?.scene === this && this.game.scenes.top === this)
          this.fade = { t: 0, out: false, then: () => undefined };
      },
    };
  }

  private updateFade(): void {
    const f = this.fade as Fade;
    if (++f.t < FADE_FRAMES) return;
    this.fade = null;
    f.then();
  }

  /** The room's music (the village theme outdoors, its quiet arrangement indoors). */
  private updateMusic(): void {
    const want = this.world.room.def.music ?? 'village';
    if (want === this.music) return;
    this.music = want;
    this.game.ctx.audio.playMusic(want);
  }

  /** How dark the fade is now (0 clear, 1 black). */
  fadeLevel(): number {
    const f = this.fade;
    if (!f) return 0;
    const k = Math.min(1, f.t / FADE_FRAMES);
    return f.out ? k : 1 - k;
  }

  render(r: Renderer): void {
    r.clear('#000000');
    renderWorld(r, this.view, this.world);
    this.drawPuff(r);
    this.drawPrompt(r);
    drawTownHud(r, this);
    const n = this.notice;
    if (n && this.t < n.until) drawNotice(r, fontOf(this.view), n.text);
    const k = this.fadeLevel();
    if (k > 0) r.rect(0, HUD_H, SCREEN_W, SCREEN_H - HUD_H, `rgba(0,0,0,${k.toFixed(3)})`);
  }

  /** A puff of smoke where the hero switched (two rings; one still cloud with reduce flashing). */
  private drawPuff(r: Renderer): void {
    const p = this.puff;
    if (!p || this.world.transition) return;
    const sheet = this.view.sheet('town-folk');
    const frame = this.view.reduceFlashing ? 'puff-calm' : `puff-${Math.min(2, Math.floor(p.t / 6))}`;
    const x = p.x;
    const y = HUD_H + p.y;
    if (sheet?.frames.has(frame)) r.sprite(sheet, frame, x, y);
    else r.rect(x + 2, y + 2, 12, 12, 'rgba(252,252,252,0.6)');
  }

  /** TALK (READ, LOOK) over whoever the hero can talk to. */
  private drawPrompt(r: Renderer): void {
    if (!this.free) return;
    const p = talkTarget(this.world);
    if (!(p instanceof Townsperson) || p.pages(this.talkContext()).length === 0) return;
    const text = fontText(this.promptText(p));
    const font = fontOf(this.view);
    const w = text.length * 8 + 4;
    const x = Math.max(2, Math.min(SCREEN_W - w - 2, p.x + 8 - (w >> 1)));
    const y = HUD_H + promptRow(p.y, this.hero.y);
    r.rect(x, y, w, 10, 'rgba(0,0,0,0.75)');
    r.text(font, text, x + 2, y + 1);
  }
}

/**
 * Where the TALK prompt's band goes (room pixels): over the townsperson, or under them when the hero
 * stands above (talking down), so it never hides the hero's head.
 */
export function promptRow(personY: number, heroY: number): number {
  if (heroY < personY - 4) return Math.min(ROOM_H - 11, personY + 18);
  return Math.max(1, personY - 12);
}

/** A hero's hit points in full (the healer's): their kit's maximum, else their starting count. */
export function fullHp(c: CharacterDef, kit: Readonly<Record<string, number>>): number {
  if (c.damage.kind !== 'hp') return 0;
  return kit.maxHp ?? startHp(c);
}

/** The next freed hero after the current one, in character select's order; null when none. */
export function nextHero(game: Game): CharacterDef | null {
  const chars = game.deps.characters;
  const at = chars.indexOf(game.state.character);
  for (let k = 1; k < chars.length; k++) {
    const c = chars[(at + k) % chars.length] as CharacterDef;
    if (!game.heroLocked(c)) return c;
  }
  return null;
}

/** A notice on a dark band over the village's lower part. */
function drawNotice(r: Renderer, font: ReturnType<typeof fontOf>, text: string): void {
  const t = fontText(text);
  const w = t.length * 8 + 16;
  const x = (SCREEN_W - w) >> 1;
  const y = SCREEN_H - 28;
  r.rect(x, y, w, 16, 'rgba(0,0,0,0.8)');
  r.text(font, t, x + 8, y + 4);
}

/** The power a hero has, as the HUD names it. */
export function powerName(game: Game): string {
  const s = game.state;
  const c = s.character;
  if (c.damage.kind === 'powerup')
    return s.powerState === 'fire' ? 'FIRE' : s.powerState === 'big' ? 'SUPER' : 'SMALL';
  return `HP ${s.hp}/${fullHp(c, s.kit)}`;
}

/**
 * The village HUD (64 px over the screen): the village and the screen (or the building) on the
 * left, the hero and their power, coins and lives, the switch button's name, and a little map of
 * the six screens with the hero's.
 */
function drawTownHud(r: Renderer, scene: TownScene): void {
  const game = scene.game;
  const view = scene.view;
  const font = fontOf(view);
  const s = game.state;
  r.rect(0, 0, SCREEN_W, HUD_H, '#000000');
  const room = scene.world.room.id;
  const place = isOutdoor(room) ? SCREEN_NAMES[room] : indoorName(room as IndoorId);
  r.text(font, VILLAGE_NAME, 8, 6);
  r.text(font, fontText(place), 8, 16);
  r.text(font, fontText(s.character.name.toUpperCase()), 8, 30);
  r.text(font, fontText(powerName(game)), 8, 40);
  r.text(font, `COINS×${String(s.coins).padStart(2, '0')}`, 120, 30);
  r.text(font, `LIVES×${String(s.lives).padStart(2, '0')}`, 120, 40);
  r.text(font, townHudHint(game), 8, 52);
  // The six screens, the hero's lit (indoors: the screen the building stands on).
  const here = isOutdoor(room) ? SCREEN_AT[room] : screenOfIndoor(room);
  const mx = 200;
  const my = 6;
  for (const [, at] of Object.entries(SCREEN_AT)) {
    const on = here && at[0] === here[0] && at[1] === here[1];
    r.rect(mx + at[0] * 16, my + at[1] * 11, 15, 10, on ? '#80d010' : '#305830');
  }
}

/** Characters that fit on the HUD's hint line (8 px each, 8 px margins). */
export const HUD_HINT_CHARS = (SCREEN_W - 16) / 8;

/**
 * The HUD's switch hint: "TOOLS (RIGHT SHIFT): NEXT HERO" with a keyboard or pad, "HERO BUTTON:
 * NEXT HERO" on touch. A key name too long for the line ("RIGHT CONTROL", "NUM MULTIPLY") is
 * dropped, leaving "TOOLS: NEXT HERO", so the line is never cut off.
 */
export function townHudHint(game: Game): string {
  if (controlScheme(game) === 'touch') return 'HERO BUTTON: NEXT HERO';
  const full = `${fontText(abilityHint(game, 'TOOLS', 'select'))}: NEXT HERO`;
  return full.length <= HUD_HINT_CHARS ? full : 'TOOLS: NEXT HERO';
}

/** The screen a room indoors stands on (its front door's). */
function screenOfIndoor(room: string): readonly [number, number] | null {
  const door = DOORS.find((d) => d.to === `${room}-out`);
  return door && isOutdoor(door.room) ? SCREEN_AT[door.room] : null;
}

/** The village's menu: Continue, Quit to map (and, in dev mode, the assists). */
export class TownMenuScene extends MenuScene {
  constructor(game: Game, quit: () => void) {
    super(
      game,
      VILLAGE_NAME,
      [
        { label: 'Continue', select: () => game.scenes.pop() },
        {
          label: 'Quit to map',
          select: () => {
            game.scenes.pop();
            quit();
          },
          hint: 'Back to the map; the game is saved',
        },
        ...miniGameDevItems(game),
      ],
      () => game.scenes.pop(),
      true,
    );
  }

  override enter(): void {
    this.game.ctx.audio.sfx('pause');
    this.game.ctx.audio.pause();
    super.enter();
  }

  exit(): void {
    this.game.ctx.audio.resume();
  }

  /** The panel over a blank HUD band: the village HUD's lines would show through and round it. */
  override render(r: Renderer): void {
    r.rect(0, 0, SCREEN_W, HUD_H, '#000000');
    super.render(r);
  }
}
