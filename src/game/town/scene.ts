import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import { Actions } from '@engine/input/actions';
import type { Renderer } from '@engine/gfx/renderer';
import type { TouchLabels } from '@engine/input/touch';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { DOORS, GATE, SCREEN_AT, SCREEN_NAMES, type IndoorId, type TownDoor } from '@content/town/kakariko';
import { INDOOR_SURROUND, townArt } from '@content/sprites/town';
import type { CharacterDef } from '../characters/character';
import { startHp } from '../characters/character';
import type { Game } from '../scenes/game';
import { abilityHint, controlScheme } from '../scenes/hints';
import { MenuScene } from '../scenes/menu';
import { miniGameDevItems } from '../minigames/menu';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { fontText } from '../hud/text';
import { playStoryCards } from '../story/cards';
import {
  DOOR_LOCKED,
  NO_ONE_ELSE,
  SHOP_FULL,
  SHOP_ONE_A_VISIT,
  SHOP_OWNED,
  shopGrowFirst,
  shopShort,
} from '../story/kakariko';
import type { Page } from '../story/script';
import { coinText } from '../items/wallet';
import { itemInfo } from '../items/catalog';
import { TopDownWorld, type TdEvent } from '../topdown/world';
import { drawRoomTiles, renderWorld } from '../topdown/render';
import type { Room } from '../topdown/room';
import { DIR_VEC, ROOM_COLS, ROOM_H, ROOM_W, SIDE_DIR, TILE } from '../topdown/geometry';
import { fxPalette } from '@content/sprites/palette-fx';
import { fontOf, sheetLookup, type TdSheets, type TdView } from '../topdown/view';
import { talkTarget } from '../topdown/person';
import { overheadLook, TownHero } from './hero';
import { FOLK_DEFS, folkSpawner, HELD_FRAMES, Kid, ShopTable, Townsperson, type TalkContext } from './folk';
import {
  buy,
  newShopVisit,
  SHOP_STOCK,
  shopEntries,
  type ShopEntry,
  type ShopIcon,
  type ShopSlot,
} from './shop';
import { ShopCardScene } from './shop-card';
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
/**
 * The top of the play area: the room is centred on the screen, with a strip of the screens above
 * and below it (or more of its own edge) round it, and the HUD drawn over it, as in A Link to the
 * Past (owner, RQ41: no black HUD box).
 */
export const PLAY_Y = (SCREEN_H - ROOM_H) >> 1;
/** Frames a place-name banner stays at least, before moving or a key clears it. */
export const BANNER_MIN = 60;
/** Frames the welcome banner shows on a first visit before the guard says hello. */
export const BANNER_GREET = 120;

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
  /**
   * A notice (a shut door, nobody to switch to): said as it shows, and like the banner it stays
   * until the hero is walked or a key pressed once it has shown BANNER_MIN frames (never timing
   * out on its own). `t`: frames shown.
   */
  notice: { text: string; t: number } | null = null;
  /**
   * The place-name banner (the village and the screen or room; on arrival also the NEXT HERO
   * hint), shown on entering the village or a new place and cleared by moving or a key once it
   * has shown BANNER_MIN frames. `t`: frames shown.
   */
  banner: { lines: string[]; t: number } | null = null;
  /** Someone is being talked to (their cards are up). */
  talking: Townsperson | null = null;
  /** The guard's hello is still to come (first visit, after the walk in). */
  private greet: boolean;
  /**
   * Hobb's gift is still to come (0.4.42): on arrival, after any hello, while the file has no
   * Wallet (the first visit, or the first since a file found the village before the shop).
   */
  private gift: boolean;
  /** This visit's shop (the 1-up without the Wallet is one a visit). */
  readonly shopVisit = newShopVisit();
  /** What floats over the hero's head (a bought item, the Wallet), and for how long more. */
  held: { icon: ShopIcon; t: number } | null = null;
  /** An item's own sound, played a moment after the purchase jingle. */
  private laterSfx: { id: string; t: number } | null = null;
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
    this.gift = !game.state.wallet;
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
    this.screen = this.world.room.id;
    this.banner = null;
    this.say(`${spoken(VILLAGE_NAME)}. ${spoken(this.placeName())}.`);
  }

  /** What the screen or room the hero is in is called. */
  placeName(): string {
    const room = this.world.room.id;
    return isOutdoor(room) ? SCREEN_NAMES[room] : indoorName(room as IndoorId);
  }

  /** The banner for the place the hero is in (`welcome`: with the NEXT HERO hint, on arrival). */
  showBanner(welcome = false): void {
    const lines = [VILLAGE_NAME, fontText(this.placeName())];
    if (welcome) lines.push('', townHudHint(this.game));
    this.banner = { lines, t: 0 };
  }

  /** Announced on the first frame (the scene may be built before the announcer is listening). */
  private announced = false;

  private say(text: string): void {
    this.game.deps.announcer?.say(text);
  }

  private sfx(id: string): void {
    this.game.ctx.audio.sfx(id);
  }

  /** Someone is still to speak on arrival (the guard's hello, Hobb's gift). */
  get arriving(): boolean {
    return this.greet || this.gift;
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
      wallet: this.game.state.wallet,
    };
  }

  /** `p` has something to say (or, a display table, something on it to buy). */
  canTalk(p: unknown): p is Townsperson {
    if (p instanceof ShopTable) return p.entry !== null;
    return p instanceof Townsperson && p.pages(this.talkContext()).length > 0;
  }

  touchLabels(): TouchLabels {
    if (!this.free) return { ...NO_TOUCH_BUTTONS };
    const target = talkTarget(this.world);
    const talk = this.canTalk(target);
    return { ...NO_TOUCH_BUTTONS, jump: talk ? target.verb : null, start: 'MENU', select: 'HERO' };
  }

  update(input: InputFrame): void {
    this.t++;
    if (!this.announced) {
      this.announced = true;
      this.showBanner(true);
      this.say(`${spoken(VILLAGE_NAME)}. ${spoken(this.placeName())}. ${this.helpSaid()}`);
    }
    if (this.banner) this.banner.t++;
    if (this.notice) this.notice.t++;
    const before = { x: this.hero.x, y: this.hero.y, free: this.free };
    if (this.puff && ++this.puff.t >= PUFF_FRAMES) this.puff = null;
    if (this.held && ++this.held.t >= HELD_FRAMES) this.held = null;
    if (this.laterSfx && --this.laterSfx.t <= 0) {
      this.sfx(this.laterSfx.id);
      this.laterSfx = null;
    }
    this.stockTables();
    if (this.switchT > 0) this.switchT--;
    if (this.fade) {
      this.updateFade();
      return;
    }
    if (this.free) {
      if (input.pressed('start')) {
        this.game.scenes.push(new TownMenuScene(this.game, () => this.leave(), this));
        return;
      }
      if (input.pressed('select')) this.switchHero();
      else if (input.pressed('jump') || input.pressed('special')) {
        const p = talkTarget(this.world);
        if (p instanceof ShopTable) {
          if (this.openTable(p)) return;
        } else if (p instanceof Townsperson && this.talk(p)) return;
      }
    }
    this.world.update(input);
    // The banner goes once it has been seen, as soon as the hero is walked or a key pressed.
    const moved = before.free && (this.hero.x !== before.x || this.hero.y !== before.y);
    const dismiss = moved || anyPressed(input);
    if (this.banner && this.banner.t >= BANNER_MIN && dismiss) this.banner = null;
    if (this.notice && this.notice.t >= BANNER_MIN && dismiss) this.notice = null;
    for (const e of this.world.events.splice(0)) this.onEvent(e);
    const welcomed = !this.banner || this.banner.t >= BANNER_GREET;
    if (this.arriving && this.free && welcomed && this.game.scenes.top === this) {
      if (this.greet) {
        this.greet = false;
        const guard = this.folk('guard');
        if (guard) this.talk(guard);
      } else {
        // Hobb's gift, straight after (the next frame): his cards, then the Wallet.
        this.gift = false;
        if (!this.game.state.wallet) this.giveWallet();
      }
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
    const who = this.canTalk(p) ? p : null;
    if (who && who !== this.prompted) {
      const e = who instanceof ShopTable ? who.entry : null;
      const name = e ? `${e.name}, ${e.mark ? e.mark.toLowerCase() : `${e.price} coins`}` : spoken(who.name);
      this.say(`${name}. ${this.promptText(who)}.`);
    }
    this.prompted = who;
  }

  /** Who stands in the room with FOLK id `id`, if anyone. */
  private folk(id: string): Townsperson | null {
    const p = this.world.entities.find((e) => e instanceof Townsperson && e.id === id);
    return p instanceof Townsperson ? p : null;
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
    this.banner = null;
    const after = p.after(ctx);
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
        if (after === 'heal') this.heal();
        if (after === 'wallet' && !this.game.state.wallet) {
          // BACK skipped the cards: the Wallet is given all the same.
          this.receiveWallet();
          this.say(`You got the ${spoken(WALLET_SAID)}.`);
        }
      },
      {
        bottom,
        // The Wallet changes hands as its card shows (the last page).
        ...(after === 'wallet'
          ? { onNext: (i: number) => i === pages.length - 2 && this.receiveWallet() }
          : {}),
      },
    );
    return true;
  }

  /**
   * Hobb's gift (0.4.42): he turns to the hero and hands over the Wallet; his cards are skippable
   * (BACK), and it is given either way. Without him in the room (a test's odd start) the cards
   * play all the same.
   */
  giveWallet(): void {
    const hobb = this.folk('tanner');
    if (hobb) {
      this.talk(hobb);
      return;
    }
    const pages = FOLK_TANNER_PAGES(this.talkContext());
    playStoryCards(this.game, null, pages, () => this.receiveWallet(), {
      bottom: this.hero.y < ROOM_H / 2,
      onNext: (i) => i === pages.length - 2 && this.receiveWallet(),
    });
  }

  /** The Wallet is the file's: held up over the hero, a fanfare, saved at once. */
  receiveWallet(): void {
    const s = this.game.state;
    if (s.wallet) return;
    s.wallet = true;
    this.held = { icon: { sheet: 'town-folk', frame: 'wallet' }, t: 0 };
    this.sfx('wallet');
    this.game.autosave();
  }

  /** The shop's tables show the current hero's stock (refreshed every frame: SELECT changes it). */
  private stockTables(): void {
    if (this.world.room.id !== 'shop') return;
    const entries = shopEntries(this.game.state, this.shopVisit);
    for (const e of this.world.entities) if (e instanceof ShopTable) e.entry = entries[e.index] ?? null;
  }

  /** TALK at a display table: its buy card (or the shopkeeper saying why not). False if bare. */
  openTable(t: ShopTable): boolean {
    this.stockTables();
    const e = t.entry;
    if (!e) return false;
    this.banner = null;
    this.notice = null;
    const reply = shopReply(e, this.game.state.coins, this.game.state.character.id);
    this.game.scenes.push(
      new ShopCardScene(this.game, e, reply, (yes) => yes && this.purchase(e.slot), this.hero.y < ROOM_H / 2),
    );
    return true;
  }

  /**
   * Buys the current hero's `slot` (YES on the card): the purchase jingle, then the item's own
   * sound; the item floats over the hero, its name shows and is said, and the file is saved.
   */
  purchase(slot: ShopSlot): void {
    const out = buy(this.game.state, this.shopVisit, slot);
    if (out.kind !== 'bought') return;
    const e = out.entry;
    this.sfx('shop-buy');
    this.laterSfx = { id: out.sfx, t: 24 };
    this.held = { icon: e.icon, t: 0 };
    this.notify(`${fontText(e.name.toUpperCase())}!`, false);
    this.say(`${e.name}: ${e.does}. Thank you!`);
    this.stockTables();
    this.game.autosave();
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

  private notify(text: string, said = true): void {
    this.notice = { text, t: 0 };
    if (said) this.say(spoken(text));
  }

  private onEvent(e: TdEvent): void {
    switch (e.type) {
      case 'room': {
        this.updateMusic();
        if (e.id !== this.screen) {
          this.screen = String(e.id);
          this.notice = null;
          // Outdoors the screen is only said (the pause menu shows it): the banner is for arriving
          // and for going indoors, as A Link to the Past names places.
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
          if (!isOutdoor(this.screen)) this.showBanner();
          else this.banner = null;
          this.say(`${spoken(this.placeName())}.`);
        });
        return;
      }
      case 'door-shut': {
        this.sfx('bump');
        this.notify(DOOR_LOCKED);
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
    this.stockTables();
    drawSurround(r, this.view, this.world);
    renderWorld(r, this.view, this.world, PLAY_Y);
    this.drawPuff(r);
    this.drawHeld(r);
    this.drawPrompt(r);
    const k = this.fadeLevel();
    if (k > 0) r.rect(0, 0, SCREEN_W, SCREEN_H, `rgba(0,0,0,${k.toFixed(3)})`);
    // Paused, the menu has the place, the map and the hints; the HUD would only clutter it.
    if (this.game.scenes.top instanceof TownMenuScene) return;
    drawTownHud(r, this);
    if (this.banner && !this.fade) drawBanner(r, this.view, this.banner.lines, this.hero.y < ROOM_H / 2);
    const n = this.notice;
    if (n) drawNotice(r, fontOf(this.view), n.text);
  }

  /** A puff of smoke where the hero switched (two rings; one still cloud with reduce flashing). */
  private drawPuff(r: Renderer): void {
    const p = this.puff;
    if (!p || this.world.transition) return;
    const sheet = this.view.sheet('town-folk');
    const frame = this.view.reduceFlashing ? 'puff-calm' : `puff-${Math.min(2, Math.floor(p.t / 6))}`;
    const x = p.x;
    const y = PLAY_Y + p.y;
    if (sheet?.frames.has(frame)) r.sprite(sheet, frame, x, y);
    else r.rect(x + 2, y + 2, 12, 12, 'rgba(252,252,252,0.6)');
  }

  /** A bought item (or the Wallet) held up over the hero's head, as it is got. */
  private drawHeld(r: Renderer): void {
    const h = this.held;
    if (!h || this.world.transition) return;
    const sheet = this.view.sheet(h.icon.sheet);
    const f = sheet?.frames.get(h.icon.frame);
    const x = this.hero.x + 8;
    const y = PLAY_Y + this.hero.y - 3;
    if (sheet && f) r.sprite(sheet, h.icon.frame, x - (f.w >> 1), y - f.h);
    else r.rect(x - 6, y - 12, 12, 12, '#f8d878');
  }

  /** TALK (READ, LOOK; BUY at a table) over whoever the hero can talk to. */
  private drawPrompt(r: Renderer): void {
    if (!this.free) return;
    const p = talkTarget(this.world);
    if (!this.canTalk(p)) return;
    const text = fontText(this.promptText(p));
    const font = fontOf(this.view);
    const w = text.length * 8 + 4;
    const x = Math.max(2, Math.min(SCREEN_W - w - 2, p.x + 8 - (w >> 1)));
    // Over a display table it sits above the item on it, not across it.
    const y = PLAY_Y + (p instanceof ShopTable ? p.y - 18 : promptRow(p.y, this.hero.y));
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

/** Any button pressed this frame (a place-name banner goes). */
const anyPressed = (input: InputFrame): boolean => Actions.some((a) => input.pressed(a));

/** A notice on a dark band over the village's lower part. */
function drawNotice(r: Renderer, font: ReturnType<typeof fontOf>, text: string): void {
  const t = fontText(text);
  const w = t.length * 8 + 16;
  const x = (SCREEN_W - w) >> 1;
  const y = SCREEN_H - 28;
  r.rect(x, y, w, 16, 'rgba(0,0,0,0.8)');
  r.text(font, t, x + 8, y + 4);
}

/** The Wallet's name as said ("Traveler's Wallet"). */
const WALLET_SAID = "TRAVELER'S WALLET";

/** Hobb's pages with no Hobb in the room (giveWallet's fallback). */
const FOLK_TANNER_PAGES = (ctx: TalkContext): readonly Page[] => FOLK_DEFS.tanner?.pages(ctx) ?? [];

/**
 * What the shopkeeper says on the buy card when `e` can't be bought by a hero with `coins` (null:
 * it can, the card asks BUY?).
 */
export function shopReply(e: ShopEntry, coins: number, hero: string): Page | null {
  switch (e.mark) {
    case 'GROW FIRST': {
      const grow = SHOP_STOCK[hero]?.grow ?? '';
      return shopGrowFirst(fontText((itemInfo(hero, grow)?.name ?? grow).toUpperCase()));
    }
    case 'FULL':
      return SHOP_FULL;
    case 'SOLD OUT':
      return e.slot === 'life' ? SHOP_ONE_A_VISIT : SHOP_OWNED;
  }
  return coins < e.price ? shopShort(e.price) : null;
}

/** The power a hero has, as the HUD names it. */
export function powerName(game: Game): string {
  const s = game.state;
  const c = s.character;
  if (c.id === 'sophia')
    // Sophia III's cannon: Normal, Hyper, Crusher (stored as small, big, fire).
    return s.powerState === 'fire' ? 'CRUSHER' : s.powerState === 'big' ? 'HYPER' : 'NORMAL';
  if (c.damage.kind === 'powerup')
    return s.powerState === 'fire' ? 'FIRE' : s.powerState === 'big' ? 'SUPER' : 'SMALL';
  return `HP ${s.hp}/${fullHp(c, s.kit)}`;
}

/**
 * The dark outline's offsets: each HUD text's silhouette all eight ways and a shadow down-right,
 * under it, so it reads over busy scenery (benches, hedges) as well as grass and floorboards.
 */
const OUTLINE: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [2, 2],
];

/** Text with a dark outline, so it reads on grass, paths and floorboards alike. */
function outlined(r: Renderer, view: TdView, text: string, x: number, y: number, colour?: string): void {
  const dark = view.sheet('font', fxPalette('font', 'silhouette'));
  if (dark) for (const [dx, dy] of OUTLINE) r.text(dark, text, x + dx, y + dy);
  r.text((colour ? view.sheet('font', colour) : null) ?? fontOf(view), text, x, y);
}

/** One of the HUD's 8×8 icons (the town-folk sheet's `hud-*`), or a flat square without the art. */
function icon(r: Renderer, view: TdView, frame: string, x: number, y: number, fallback: string): void {
  const sheet = view.sheet('town-folk');
  if (sheet?.frames.has(frame)) r.sprite(sheet, frame, x, y);
  else r.rect(x, y, 8, 8, fallback);
}

/** Where the HUD's pieces sit (screen pixels): the hero's box, the counters, the health. */
export const TOWN_HUD = {
  box: { x: 12, y: 6, w: 24, h: 24 },
  coins: { x: 44, y: 8 },
  lives: { x: 68, y: 8 },
  /** The health's right edge and rows (the label over it). */
  right: 244,
  labelY: 6,
  healthY: 17,
  /** Everything stays above this line (the room's top two rows show under it). */
  bottom: 34,
} as const;

/**
 * The health label's word (drawn "- WORD -", the dashes as outlined bars): Mario and Luigi's (and
 * Sophia III's) is their power, everyone else's their health.
 */
export function healthLabel(c: CharacterDef): string {
  return c.damage.kind === 'powerup' ? 'POWER' : 'HEALTH';
}

/**
 * Samus's energy as her tanks and the EN count left in the one in use (her side-view HUD's: full
 * tanks over EN), from the hero's hit points, their full count and her kit's tanks.
 */
export function energyOf(
  hp: number,
  full: number,
  tanks: number,
  start: number,
): { full: number; total: number; en: number } {
  const size = tanks > 0 ? (full - start) / tanks : 0;
  if (!(size > 0)) return { full: 0, total: 0, en: hp };
  const got = Math.max(0, Math.min(tanks, Math.floor((hp - 1) / size)));
  return { full: got, total: tanks, en: Math.max(0, hp - got * size) };
}

/**
 * The village HUD, drawn over the play area in A Link to the Past's manner (no panel behind it):
 * at the top left the hero's portrait in a framed box and the coin and life counters under their
 * icons; at the top right the hero's health in their own style under a "- HEALTH -" label
 * (hearts, a bar, Samus's EN and tanks, or Mario and Luigi's power). Every piece is outlined.
 */
function drawTownHud(r: Renderer, scene: TownScene): void {
  const game = scene.game;
  const view = scene.view;
  const s = game.state;
  const c = s.character;
  const H = TOWN_HUD;
  // The hero's box: a dark rim, a gold frame, a night-blue inside, the hero from above.
  const b = H.box;
  r.rect(b.x, b.y, b.w, b.h, '#101010');
  r.rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, '#f8d878');
  r.rect(b.x + 3, b.y + 3, b.w - 6, b.h - 6, '#182848');
  const look = overheadLook(c, s.powerState, s.kit, 'down', 0);
  const sheet = view.sheet(look.sheet, look.palette) ?? view.sheet(look.sheet);
  const f = sheet?.frames.get(look.frame);
  if (sheet && f) r.sprite(sheet, look.frame, b.x + 12 - (f.w >> 1), b.y + 12 - (f.h >> 1));
  // Coins and lives: the icon over the count. With the Wallet the coins take 3 digits (0.4.42)
  // and the lives move over to make room.
  const two = (n: number) => String(Math.max(0, Math.min(99, n))).padStart(2, '0');
  const coins = coinText(s);
  const cw = coins.length * 8;
  outlined(r, view, '$', H.coins.x + (cw >> 1) - 4, H.coins.y);
  outlined(r, view, coins, H.coins.x, H.coins.y + 10);
  const livesX = Math.max(H.lives.x, H.coins.x + cw + 8);
  icon(r, view, 'hud-life', livesX + 4, H.lives.y, '#40a040');
  outlined(r, view, two(s.lives), livesX, H.lives.y + 10);
  // Health, right-aligned under its label.
  const width = drawHealth(r, view, game);
  // The label, "- HEALTH -": gold over its dark outline, and solid outlined bars for the dashes
  // (the font's thin dash glyphs got lost in benches and hedges).
  const label = healthLabel(c);
  const lw = label.length * 8 + 20;
  const lx = Math.min(SCREEN_W - 4 - lw, H.right - (width >> 1) - (lw >> 1));
  for (const bx of [lx, lx + lw - 6]) {
    r.rect(bx - 1, H.labelY + 1, 8, 5, '#101010');
    r.rect(bx, H.labelY + 2, 6, 3, '#f8d878');
  }
  outlined(r, view, label, lx + 10, H.labelY, 'font-gold');
}

/** The hero's health at the HUD's top right; returns how wide it is drawn. */
function drawHealth(r: Renderer, view: TdView, game: Game): number {
  const s = game.state;
  const c = s.character;
  const H = TOWN_HUD;
  const y = H.healthY;
  if (c.damage.kind === 'powerup') {
    const word = powerName(game);
    const frame = word === 'FIRE' ? 'hud-flower' : word === 'SUPER' ? 'hud-shroom' : 'hud-small';
    // Sophia III's cannon level is a word alone (no mushroom for a tank).
    const w = (c.id === 'sophia' ? 0 : 11) + word.length * 8;
    if (c.id !== 'sophia') icon(r, view, frame, H.right - w, y, '#d83830');
    outlined(r, view, word, H.right - word.length * 8, y);
    return w;
  }
  const full = fullHp(c, s.kit);
  const style = c.damage.hudStyle;
  if (style === 'hearts') {
    // Two hit points a heart, ten to a row (a second row under the first).
    const hearts = Math.ceil(full / 2);
    const perRow = Math.min(10, hearts);
    let row = '';
    const rows: string[] = [];
    for (let i = 0; i < hearts; i++) {
      const left = s.hp - i * 2;
      row += left >= 2 ? 'h' : left === 1 ? 'f' : 'e';
      if (row.length === perRow) {
        rows.push(row);
        row = '';
      }
    }
    if (row) rows.push(row);
    rows.forEach((t, i) => outlined(r, view, t, H.right - perRow * 8, y + i * 9));
    return perRow * 8;
  }
  if (style === 'number') {
    const e = energyOf(s.hp, full, s.kit.tanks ?? 0, startHp(c));
    const text = `EN${String(Math.round(e.en)).padStart(2, '0')}`;
    const w = text.length * 8 + (e.total > 0 ? e.total * 7 + 2 : 0);
    const x0 = H.right - w;
    for (let i = 0; i < e.total; i++) {
      r.rect(x0 + i * 7 - 1, y, 8, 7, '#101010');
      r.rect(x0 + i * 7, y + 1, 6, 5, '#fcfcfc');
      if (i >= e.full) r.rect(x0 + i * 7 + 1, y + 2, 4, 3, '#202020');
    }
    outlined(r, view, text, H.right - text.length * 8, y);
    return w;
  }
  // A bar of the hero's hit points, two pixels each, in a dark frame.
  const w = full * 2;
  const x0 = H.right - w;
  r.rect(x0 - 2, y - 1, w + 3, 9, '#101010');
  for (let i = 0; i < full; i++) {
    const on = i < s.hp;
    r.rect(x0 + i * 2, y + 1, 1, 1, on ? '#fcfcfc' : '#505050');
    r.rect(x0 + i * 2, y + 2, 1, 4, on ? '#f8d878' : '#303030');
  }
  return w;
}

/**
 * The place-name banner (A Link to the Past's): a framed box with the village's name in gold and
 * the place's under it (on arrival also the NEXT HERO hint), over the play area's top, or its
 * bottom when the hero is in the top half.
 */
function drawBanner(r: Renderer, view: TdView, lines: readonly string[], bottom: boolean): void {
  const w = Math.min(SCREEN_W, Math.max(...lines.map((l) => l.length)) * 8 + 16);
  const h = lines.length * 10 + 10;
  const x = (SCREEN_W - w) >> 1;
  const y = bottom ? PLAY_Y + ROOM_H - h - 6 : TOWN_HUD.bottom + 6;
  r.rect(x, y, w, h, '#101010');
  r.rect(x + 1, y + 1, w - 2, h - 2, '#d8d8d8');
  r.rect(x + 2, y + 2, w - 4, h - 4, 'rgba(16,24,56,0.92)');
  lines.forEach((l, i) => {
    if (!l) return;
    const sheet = (i === 0 ? view.sheet('font', 'font-gold') : null) ?? fontOf(view);
    r.text(sheet, l, x + ((w - l.length * 8) >> 1), y + 6 + i * 10);
  });
}

/**
 * The play area's surroundings: the room fills 176 of the screen's 240 rows, so a strip of the
 * screen above shows over it and of the screen below under it, as a scrolling view would (more
 * of the room's own edge where there is none); indoors, the house's outside. They slide with the
 * rooms.
 */
function drawSurround(r: Renderer, view: TdView, world: TopDownWorld): void {
  const placed: [Room, number, number][] = [];
  let ox = 0;
  let oy = PLAY_Y;
  const tr = world.transition;
  if (tr) {
    const v = DIR_VEC[SIDE_DIR[tr.side]];
    const span = v.dx !== 0 ? ROOM_W : ROOM_H;
    const shift = Math.round((tr.t / tr.frames) * span);
    placed.push([tr.from, -v.dx * shift, PLAY_Y - v.dy * shift]);
    ox = v.dx * (span - shift);
    oy = PLAY_Y + v.dy * (span - shift);
  }
  placed.push([world.room, ox, oy]);
  const open = () => 'open' as const;
  for (const [room, x, y] of placed) {
    const v: TdView =
      room.def.dark && view.sheets.tilesDark ? { ...view, tilePalette: view.sheets.tilesDark } : view;
    if (room.wall !== 0) {
      // Indoors: the ground round the house, above and below.
      const tiles = v.sheet(v.sheets.tiles, v.tilePalette);
      for (const by of [y - 2 * TILE, y - TILE, y + ROOM_H, y + ROOM_H + TILE])
        for (let col = 0; col < ROOM_COLS; col++)
          if (tiles?.frames.has(INDOOR_SURROUND)) r.sprite(tiles, INDOOR_SURROUND, x + col * TILE, by);
          else r.rect(x + col * TILE, by, TILE, TILE, '#a06030');
      continue;
    }
    for (const dir of [-1, 1] as const) {
      const next = world.dungeon.roomAt(room.gx, room.gy + dir);
      if (next && next.wall === 0) drawRoomTiles(r, v, next, open, x, y + dir * ROOM_H);
      else for (const k of [2, 1]) drawRoomTiles(r, v, room, open, x, y + dir * k * TILE);
    }
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

/**
 * The village's menu: Continue, Quit to map (and, in dev mode, the assists); under them where the
 * hero is (the place and a little map of the six screens, the hero's lit) and the NEXT HERO hint,
 * the HUD's old lines (RQ41: the HUD is drawn over the village now, with no room for them).
 */
export class TownMenuScene extends MenuScene {
  private told = false;

  constructor(
    game: Game,
    quit: () => void,
    private readonly town: TownScene | null = null,
  ) {
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

  /** The first time: the place and the NEXT HERO hint, then the item, as one announcement. */
  protected override announce(): void {
    if (this.told || !this.town) return super.announce();
    this.told = true;
    const it = this.items[this.index];
    const said = `${spoken(this.town.placeName())}. ${nextHeroSaid(this.game)}. ${it ? it.label : ''}`;
    this.game.deps.announcer?.say(said);
  }

  exit(): void {
    this.game.ctx.audio.resume();
  }

  override render(r: Renderer): void {
    r.rect(0, 0, SCREEN_W, SCREEN_H, 'rgba(0,0,0,0.45)');
    super.render(r);
    const town = this.town;
    if (!town) return;
    const font = fontOf(town.view);
    const top = 52 + Math.min(9, this.items.length) * 14 + 6;
    if (top > 112) return; // the dev items fill the panel
    const centre = (t: string, y: number) => r.text(font, t, (SCREEN_W - t.length * 8) >> 1, y);
    const place = fontText(town.placeName());
    centre(place, top);
    // The six screens, the hero's lit (indoors: the screen the building stands on).
    const room = town.world.room.id;
    const here = isOutdoor(room) ? SCREEN_AT[room] : screenOfIndoor(room);
    const mx = (SCREEN_W - 48) >> 1;
    const my = top + 12;
    for (const at of Object.values(SCREEN_AT)) {
      const on = here && at[0] === here[0] && at[1] === here[1];
      r.rect(mx + at[0] * 16, my + at[1] * 11, 15, 10, on ? '#80d010' : '#305830');
    }
    const [key, what] = nextHeroLines(this.game);
    centre(what, my + 30);
    centre(key, my + 40);
  }
}

/** The NEXT HERO hint in two lines for the menu: the button (with its key), then what it does. */
export function nextHeroLines(game: Game): [string, string] {
  const key =
    controlScheme(game) === 'touch' ? 'HERO BUTTON' : fontText(abilityHint(game, 'TOOLS', 'select'));
  return [key, 'NEXT HERO:'];
}

/** The NEXT HERO hint as said. */
function nextHeroSaid(game: Game): string {
  const [key] = nextHeroLines(game);
  return `${key}: next hero`;
}
