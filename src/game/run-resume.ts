import type { MapSetId } from '@engine/save/progress';
import { CLASSIC_GAME_MODES, type ClassicGameMode } from '@engine/save/original-options';
import type { MapDifficulty } from '@engine/save/settings';
import { defaultPower, type GameState, type Rules } from './context';
import { startHp, type CharacterDef } from './characters/character';
import { CHARACTERS, CLASSIC_EXTRAS, heroFor, isSkin } from './characters/registry';

/**
 * A Classic mode run as kept (G-008; B-L): what the original's file keeps for the hero playing
 * (StatManager.as 610-640, 884-959): the level (its first area, or the area its checkpoint is in),
 * lives, score, coins, power and kit, every other hero's power and kit (BUG-06), Survival's fallen
 * heroes and the rules the run plays. Since B-L it is the `run` of a Classic save file
 * (original-files.ts), which holds the run's rules and continues beside it. The old per-set slots
 * (0.4.68 on) and the single slot (0.4.67) held one of these too; original-files.ts migrates them.
 */
/** The single slot of 0.4.67 (migrated by original-files.ts, via its level's set). */
export const CLASSIC_RESUME_KEY = 'smbc-classic-resume';

/** The old per-set slot of map set `set` (0.4.68 on; migrated by original-files.ts). */
export function classicResumeKey(set: MapSetId): string {
  return `${CLASSIC_RESUME_KEY}-${set}`;
}

/**
 * The map set a level id belongs to: `sp-` Special, `ll-` The Lost Levels, anything else SMB1
 * (as original-game.ts mapSetOf reads it; a test keeps the two agreeing).
 */
export function resumeSetOf(levelId: string): MapSetId {
  if (levelId.startsWith('sp-')) return 'special';
  if (levelId.startsWith('ll-')) return 'lost';
  return 'smb';
}

export interface ClassicResume {
  v: 1;
  /** The level (its first area, or the area its checkpoint is in) the run goes back to. */
  levelId: string;
  rules: Rules;
  /** The hero playing (the roster def's id, a look's own id for a look). */
  hero: string;
  score: number;
  coins: number;
  lives: number;
  world: number;
  stage: number;
  powerState: string;
  hp: number;
  kit: Record<string, number>;
  warped: boolean;
  checkpoint: GameState['checkpoint'];
  /** Survival: the fallen heroes and whether revival is allowed. */
  survival?: { fallen: string[]; reviveAllowed: boolean };
  /** An old slot's Map Difficulty (RC-002; migration reads it; a file keeps it in its rules). */
  difficulty?: MapDifficulty;
  /** An old slot's Game mode (RC-002; migration reads it; a file keeps it in its rules). */
  gameMode?: ClassicGameMode;
  /**
   * BUG-06: the power, hit points and kit of each hero not playing, by slot hero id, as the
   * original's file keeps every hero's upgrades and ammo (StatManager.as 610-643). A slot without
   * it (older, or a continue's, where every hero starts afresh): every other hero at his default.
   */
  heroKits?: Record<string, HeroKit>;
  /** When it was written (Date.now()): which set's run is the latest. Older slots have none. */
  savedAt?: number;
  /** BUG-05: written by a game over at its continue point; going on from it is a continue used. */
  continued?: true;
  /**
   * An old per-set slot's continues (#196's item 8). Migration reads it; a file keeps its count
   * beside the run (ClassicFile.continues), never here.
   */
  continues?: number;
}

/** A hero's kept power (Game.classicKits). */
export interface HeroKit {
  powerState: string;
  hp: number;
  kit: Record<string, number>;
}

/** The slot for `state` at the WORLD card of `levelId`. */
export function resumeOf(
  levelId: string,
  state: GameState,
  rules: Rules,
  survival?: ClassicResume['survival'],
  heroKits?: Readonly<Record<string, HeroKit>>,
): ClassicResume {
  return {
    v: 1,
    levelId,
    rules,
    hero: state.character.id,
    score: state.score,
    coins: state.coins,
    lives: state.lives,
    world: state.world,
    stage: state.stage,
    powerState: state.powerState,
    hp: state.hp,
    kit: { ...state.kit },
    warped: state.warped,
    checkpoint: state.checkpoint ? { ...state.checkpoint } : null,
    ...(survival
      ? { survival: { fallen: [...survival.fallen], reviveAllowed: survival.reviveAllowed } }
      : {}),
    ...(heroKits ? { heroKits: copyKits(heroKits) } : {}),
  };
}

function copyKits(kits: Readonly<Record<string, HeroKit>>): Record<string, HeroKit> {
  const out: Record<string, HeroKit> = {};
  for (const [id, k] of Object.entries(kits))
    out[id] = { powerState: k.powerState, hp: k.hp, kit: { ...k.kit } };
  return out;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A slot's numbers-only kit (other values dropped). */
function readKit(v: unknown): Record<string, number> {
  const kit: Record<string, number> = {};
  if (v && typeof v === 'object') for (const [k, n] of Object.entries(v)) if (num(n)) kit[k] = n;
  return kit;
}

/**
 * The def hero `id` plays under `rules`: a roster hero's (its Classic def under Classic rules) or
 * a Classic-only extra or look by its own id. Undefined for an id no select offers.
 */
function heroDef(id: string, rules: Rules): CharacterDef | undefined {
  const roster = CHARACTERS.find((c) => c.id === id);
  if (roster) return heroFor(roster, rules);
  return CLASSIC_EXTRAS.find((c) => c.id === id);
}

/**
 * The Classic select slot hero `id` (Game.classicKits' keys: a roster hero's id, or a Classic-only
 * extra's that is no other hero's look), as Classic rules play it; undefined for any other id.
 */
function slotDef(id: string): CharacterDef | undefined {
  const roster = CHARACTERS.find((c) => c.id === id);
  if (roster) return heroFor(roster, 'classic');
  return CLASSIC_EXTRAS.find((c) => c.id === id && !isSkin(c));
}

/**
 * `powerState` and `hp` checked for `def` (null when they do not read for it). A power-up hero's
 * power must be one of its states; his hp means nothing (startHp: always 0), so any number reads
 * as 0. A hit-point hero must be at full power with 0 < hp <= its max (the kit's maxHp when it
 * has grown).
 */
function checkedPower(
  def: CharacterDef,
  powerState: unknown,
  hp: unknown,
  kit: Record<string, number>,
): { powerState: string; hp: number } | null {
  if (typeof powerState !== 'string' || !num(hp)) return null;
  const d = def.damage;
  if (d.kind === 'powerup') return d.states.includes(powerState) ? { powerState, hp: startHp(def) } : null;
  const max = kit.maxHp ?? d.max;
  return powerState === defaultPower(def) && hp > 0 && hp <= max ? { powerState, hp } : null;
}

/**
 * A slot's other heroes' kits (always Classic rules'), each checked: an id that is no Classic
 * select slot is dropped, and so is an entry whose power or hp does not read for its hero (that
 * hero starts at his default).
 */
function readHeroKits(v: unknown): Record<string, HeroKit> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Record<string, HeroKit> = {};
  for (const [id, k] of Object.entries(v as Record<string, unknown>)) {
    const def = slotDef(id);
    if (!def || !k || typeof k !== 'object') continue;
    const e = k as Partial<HeroKit>;
    const kit = readKit(e.kit);
    const power = checkedPower(def, e.powerState, e.hp, kit);
    if (power) out[id] = { ...power, kit };
  }
  return out;
}

/**
 * A kept run as stored (a file's `run`, or an old per-set slot), checked field by field; null
 * when it does not read as one (a broken one).
 */
export function parseResume(raw: unknown): ClassicResume | null {
  const r = raw as Partial<ClassicResume> | null;
  if (!r || typeof r !== 'object' || r.v !== 1) return null;
  if (typeof r.levelId !== 'string' || typeof r.hero !== 'string') return null;
  if (r.rules !== 'classic' && r.rules !== 'current') return null;
  if (![r.score, r.coins, r.lives, r.world, r.stage, r.hp].every(num) || (r.lives ?? 0) < 1) return null;
  if (typeof r.powerState !== 'string') return null;
  const kit = readKit(r.kit);
  const heroKits = readHeroKits(r.heroKits);
  // The playing hero's own power and hp, checked as the others' are: one that does not read for
  // its hero is that hero's default (an unknown hero is left to Game.classicResume, which drops it).
  const def = heroDef(r.hero, r.rules);
  const power = def
    ? (checkedPower(def, r.powerState, r.hp, kit) ?? { powerState: defaultPower(def), hp: startHp(def) })
    : {};
  const cp = r.checkpoint;
  const checkpoint =
    cp && typeof cp === 'object' && typeof cp.level === 'string' && num(cp.x)
      ? { level: cp.level, x: cp.x, ...(num(cp.y) ? { y: cp.y } : {}) }
      : null;
  const {
    survival: sv,
    difficulty: d,
    gameMode: gm,
    savedAt,
    heroKits: _hk,
    continues: cn,
    continued: cd,
    ...rest
  } = r as ClassicResume;
  return {
    ...rest,
    // An old per-set slot's count (#196; migration reads it): a whole number of 0 or more, else none.
    ...(Number.isInteger(cn) && (cn as number) >= 0 ? { continues: cn } : {}),
    ...(cd === true ? { continued: true as const } : {}),
    // An older slot, or a value this version does not know: none (the caller falls back).
    ...(d === 'easy' || d === 'normal' || d === 'hard' ? { difficulty: d } : {}),
    ...((CLASSIC_GAME_MODES as readonly string[]).includes(gm as string) ? { gameMode: gm } : {}),
    ...(num(savedAt) ? { savedAt } : {}),
    ...power,
    kit,
    ...(heroKits ? { heroKits } : {}),
    warped: r.warped === true,
    checkpoint,
    ...(sv && Array.isArray(sv.fallen)
      ? {
          survival: {
            fallen: sv.fallen.filter((id): id is string => typeof id === 'string'),
            reviveAllowed: sv.reviveAllowed !== false,
          },
        }
      : {}),
  };
}
