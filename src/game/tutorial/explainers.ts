import type { Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import type { TouchLabels } from '@engine/input/touch';
import { px } from '@engine/math/units';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { Game } from '../scenes/game';
import type { World, WorldEvent } from '../world/world';
import type { PickupKind } from '../entities/objects/pickup';
import { abilityHint } from '../scenes/hints';
import { fontText } from '../hud/text';
import { NO_TOUCH_BUTTONS } from '../touch-labels';
import { drawPromptBox, PROMPT_BOX_Y, wrapPrompt } from './stage-prompts';
import type { Tip } from './tips';

/*
 * One-time explainers (0.4.46, roadmap #20 and #24): the first time a hero touches each kind of
 * pickup (Mega Man's health, weapon energy and E-tank; Samus's energy and missile packs; Link's
 * magic jars, Simon's hearts and the other heroes' own drops), a short tip in a box under the HUD
 * says what it does. It holds the game until OK or TALK, as a training tip's first showing does
 * (tips.ts, 0.4.45), in training and in the campaign, once per save file: the file keeps the ones
 * shown (SaveFile.explained, written at once; save codes carry them since code version 2). A few
 * items explain a rule the same way the first time they are taken: Mega Man's Helmet (his weapons
 * come only while he wears it). A training stage teaches its items itself, so only pickups are
 * explained there. Classic play (no campaign file) never shows them.
 */

/** What each hero's pickups do, in a line or two (the name first, as a training tip's item). */
export const PICKUP_EXPLAINERS: Readonly<Record<string, Partial<Readonly<Record<PickupKind, string>>>>> = {
  megaman: {
    'health-small': 'HEALTH PELLET! IT REFILLS A BIT OF YOUR HEALTH BAR.',
    'health-large': 'BIG HEALTH PELLET! IT REFILLS LOTS OF HEALTH.',
    'weapon-small': 'WEAPON ENERGY! IT REFILLS THE WEAPON IN HAND.',
    'weapon-large': 'BIG WEAPON ENERGY! IT REFILLS A WEAPON A LOT.',
    'e-tank': 'E-TANK! SAVE IT: PAUSE AND USE IT FOR FULL HEALTH.',
  },
  samus: {
    'energy-small': 'ENERGY! IT GIVES BACK A LITTLE OF YOUR ENERGY.',
    'energy-large': 'BIG ENERGY! IT GIVES BACK LOTS OF YOUR ENERGY.',
    'missile-pack': 'MISSILE PACK! TWO MORE MISSILES FOR YOUR LAUNCHER.',
  },
  link: {
    bomb: 'BOMB! ONE MORE FOR YOUR BOMB BAG.',
    'magic-small': 'MAGIC JAR! IT REFILLS SOME MAGIC FOR YOUR SPELLS.',
    'magic-large': 'BIG MAGIC JAR! IT REFILLS ALL YOUR MAGIC.',
    'heart-small': 'HEART! IT GIVES BACK HALF A HEART.',
  },
  simon: {
    'heart-small': 'SMALL HEART! ONE HEART TO THROW SUB-WEAPONS WITH.',
    'heart-large': 'BIG HEART! FIVE HEARTS TO THROW SUB-WEAPONS WITH.',
  },
  ryu: {
    'ninpo-small': 'NINPO! SPIRIT POINTS FOR YOUR NINJA ARTS.',
    'ninpo-large': 'BIG NINPO! LOTS OF SPIRIT FOR YOUR NINJA ARTS.',
    'health-small': 'HEALTH! IT GIVES BACK SOME OF YOUR HEALTH BAR.',
  },
  bill: {
    capsule: 'FALCON! IT HEALS ONE HIT. GUNS COME FROM ? BLOCKS.',
    'health-small': 'HEALTH! IT HEALS ONE HIT.',
  },
  sophia: {
    'triple-ammo': 'MISSILE AMMO! MORE TRIPLE MISSILES TO FIRE.',
    'homing-ammo': 'HOMING AMMO! MORE HOMING MISSILES TO FIRE.',
  },
};

/** Rules a hero's item brings, explained the first time it is taken (campaign). */
export const ITEM_EXPLAINERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  megaman: { helmet: 'HELMET! ? BLOCKS GIVE WEAPONS ONLY WITH IT ON.' },
};

/** The explainer's id (SaveFile.explained): '<hero>:<pickup kind or item id>'. */
export const explainerId = (hero: string, what: string): string => `${hero}:${what}`;

/** Explainer `what` (a pickup kind or an item id) for `hero`'s words, or null when there is none. */
export function explainerText(hero: string, what: string): string | null {
  return PICKUP_EXPLAINERS[hero]?.[what as PickupKind] ?? ITEM_EXPLAINERS[hero]?.[what] ?? null;
}

/** Every explainer's id, the pickups' first (save codes' dictionary snapshot, tests). */
export const EXPLAINER_IDS: readonly string[] = [
  ...Object.entries(PICKUP_EXPLAINERS).flatMap(([h, m]) => Object.keys(m).map((k) => explainerId(h, k))),
  ...Object.entries(ITEM_EXPLAINERS).flatMap(([h, m]) => Object.keys(m).map((k) => explainerId(h, k))),
];

/** Columns a line takes in the narrowest box (right of Mega Man's bars, as a training box). */
export const EXPLAINER_COLS = 27;
/** The box's left edge for a hero with the bars at the screen's left (hud.ts, x 7-23). */
const BAR_LEFT = 26;
/** The gap between the box and the screen's right edge (as the training box's). */
const BOX_RIGHT = 4;
/** Frames an explainer waits for the hero to land (as a training tip does), then shows anyway. */
const LAND_WAIT = 120;

/** What a level or a training stage hands the box: its world, and how play goes on after it. */
export interface ExplainerHost {
  readonly world: World;
  /** Play on after the hold: the press that let it go never jumps. */
  resumePlay(): void;
}

interface Shown {
  id: string;
  lines: string[];
  said: string;
}

/** The explainers of one level or training stage (LevelScene, HeroStageScene). */
export class ExplainerBox {
  private readonly queue: Shown[] = [];
  /** The explainer up now (it holds the game until a press), or null. */
  current: Shown | null = null;
  private wait = 0;

  constructor(
    private readonly game: Game,
    private readonly host: ExplainerHost,
    /** Items explain their rule too (the campaign); a training stage's lessons teach its own. */
    private readonly items = true,
  ) {}

  /** Explainers show here: campaign play from a save file (training too), not an editor play-test. */
  get on(): boolean {
    return !!this.game.tips && this.game.campaign !== null && !this.game.playtestDone;
  }

  /** A world event of the frame: a pickup touched, an item taken for the first time. */
  event(ev: WorldEvent): void {
    if (ev.type !== 'pickup' && ev.type !== 'item') return;
    if (ev.type === 'item' && !this.items) return;
    const p = this.host.world.players[ev.player];
    if (p) this.offer(p.def.id, ev.item);
  }

  /** Explainer `what` for `hero`, queued unless the file has seen it (or it has none). */
  offer(hero: string, what: string): void {
    if (!this.on) return;
    const text = explainerText(hero, what);
    if (!text) return;
    const id = explainerId(hero, what);
    if (this.game.explained.includes(id) || this.queue.some((q) => q.id === id) || this.current?.id === id)
      return;
    const lines = wrapPrompt(fontText(text), this.cols);
    this.queue.push({ id, lines, said: lines.join(' ') });
  }

  /** The box's left edge: right of the bars for a hero who has them. */
  private get left(): number {
    const d = this.host.world.players[0]?.def.damage;
    return d && d.kind === 'hp' && d.hudStyle === 'bar' ? BAR_LEFT : 8;
  }

  /** Columns a line of the box takes. */
  get cols(): number {
    return Math.floor((SCREEN_W - this.left - BOX_RIGHT - 8) / 8);
  }

  /**
   * Each frame after the world's: the next explainer comes once nothing else holds the game and
   * the hero stands (or has been in the air a while). It is recorded on the file as it shows.
   */
  update(): void {
    const next = this.queue[0];
    const tips = this.game.tips;
    if (!next || !tips || this.frozen || tips.holder) return;
    const p = this.host.world.players[0];
    const steady =
      !p ||
      p.dead ||
      p.out ||
      // A grow or shrink under way plays out first (0.4.46: the hit's shrink shows, not a frozen flicker).
      ((p.body.onGround || !!p.vine || !!p.stairs || p.inWater || p.clinging) && !p.transition);
    if (!steady && ++this.wait <= LAND_WAIT) return;
    this.wait = 0;
    this.queue.shift();
    this.current = next;
    this.game.markExplained(next.id);
    const tip: Tip = { lines: next.lines, said: next.said, key: `explain|${next.id}` };
    tips.show(tip);
    if (!tips.hold(tip, this)) {
      this.current = null;
      return;
    }
    this.game.ctx.audio.sfx('pause');
    this.game.deps.announcer?.say(`${next.said} OK to continue.`);
  }

  /** An explainer holds the game now (the host's world stays frozen until a press). */
  get frozen(): boolean {
    return !!this.game.tips && this.game.tips.heldBy(this) !== null;
  }

  /**
   * Each frame before the host's world (after its MENU check): true while an explainer holds, and
   * on the frame a press lets it go (that press never reaches the hero).
   */
  hold(inputs: readonly InputFrame[]): boolean {
    const tips = this.game.tips;
    if (!tips?.heldBy(this)) return false;
    if (!tips.update(this, inputs)) {
      this.current = null;
      this.host.resumePlay();
    }
    return true;
  }

  /** The touch buttons while one holds the game (OK and MENU only), else null. */
  heldTouchLabels(): TouchLabels | null {
    if (!this.frozen) return null;
    // OK shows once the hold's lock is over (a tap on it works then), as the box's OK prompt does.
    return { ...NO_TOUCH_BUTTONS, jump: this.game.tips.unlocked ? 'OK' : null, start: 'MENU' };
  }

  /** The box while an explainer holds: under the HUD, or at the bottom when the hero is up high. */
  render(r: Renderer): void {
    const c = this.current;
    if (!c || !this.frozen) return;
    const world = this.host.world;
    const x = this.left;
    const w = SCREEN_W - x - BOX_RIGHT;
    const h = c.lines.length * 10 + 10;
    const camY = world.camera.pxY ?? 0;
    const high = world.players.some(
      (p) => !p.dead && !p.out && Math.round(p.body.y / px(1)) - camY < PROMPT_BOX_Y + h + 8,
    );
    const y = high ? SCREEN_H - h - 6 : PROMPT_BOX_Y;
    const ok = this.game.tips.unlocked ? fontText(abilityHint(this.game, 'OK', 'jump')) : '';
    drawPromptBox(r, this.game.ctx.assets.sheet('font'), c.lines, { x, y, w, foot: ok });
  }
}
