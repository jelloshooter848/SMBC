import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { TouchLabels } from '@engine/input/touch';
import { arenaPadId, installArenaGames } from '@content/worldmap/arena';
import { fxPalette } from '@content/sprites/palette-fx';
import type { MapNode } from '../map/types';
import type { Game } from '../scenes/game';
import { MINIGAMES } from '../minigames';
import { CHARACTERS } from '../characters/registry';
import type { CharacterDef } from '../characters/character';
import { fontText } from '../hud/text';
import { hasTraining, trainingScene } from '../tutorial/training';
import { AIRSHIP_CHALLENGE, AIRSHIP_TITLE } from '../scenes/airship';
import { BONUS_KINDS, BONUS_TITLES, type BonusKind } from '../bonus/rules';
import { createBonusScene } from '../bonus';
import { freshSeed } from '../world/world';
import { CRYSTAL_BALL } from '../map/captives';
import { FIRST_HERO, MET_LARRY, TUTORIAL_LEVEL } from '../save/save-files';
import { DevMiniGameResultScene, pickRoundHero, playRound, type DevRound } from '../scenes/dev-minigames';
import { TUTORIAL_ROUND } from './stage-round';

/*
 * The MINI GAME ARENA (owner decision for 0.4.7; the page is src/content/worldmap/arena.ts): every
 * game the file has found, one pad each, played "for fun" with JUMP. The list is built from the
 * registries, so it grows by itself:
 *
 *   kind       games                                        found once the file has...
 *   mini       every hero mini game (MINIGAMES)             met that hero (talked to the captive
 *                                                           once, SaveFile.met, or freed it)
 *   airship    Larry's airship (AIRSHIP_CHALLENGE)          boarded it ('larry' in met) or beaten him
 *   bonus      each SMB3 bonus game (BONUS_KINDS)           found the bonus spot (secret 'larry')
 *   stage      Mario's tutorial stage 1-0                   cleared or skipped 1-0
 *   training   each hero's training stage (hasTraining)     answered its training question
 *                                                           (SaveFile.tutorials) or freed the hero
 *
 * Developer "Unlock all" counts every game as found. A game not found yet shows as a dark "???"
 * pad (the hero's black silhouette when it has one) whose hint line says what to do; JUMP bumps.
 *
 * Larry's airship is played as a hero of the player's choosing: its pad opens character select
 * first (the file's freed heroes; Back is the arena again). The other games have no select.
 *
 * A round is Dev → Mini games' round (scenes/dev-minigames.ts playRound) played over the map: no
 * file is open meanwhile and everything is put back after, so the arena never changes progress,
 * the save, lives, items or freed heroes. Then the same result card (PASS / FAIL / QUIT), and the
 * map again with the hero on that pad; the map's music comes back and nothing is saved.
 */

export type ArenaKind = 'mini' | 'airship' | 'bonus' | 'stage' | 'training';

export interface ArenaGame {
  /** Stable id ('mini-luigi', 'airship', 'bonus-memory', 'stage-1-0', 'train-link'); its pad is 'pad-<id>'. */
  id: string;
  kind: ArenaKind;
  /** The hint line while found (at most 32 chars): 'MIRROR RACE', 'LINK TRAINING'. */
  title: string;
  /** The hero drawn on the pad (CharacterDef id), if any. */
  hero?: string;
  /** The hint line while not found (at most 32 chars, starting '???'). */
  locked: string;
  /** Found on this file (or Unlock all). */
  found(game: Game): boolean;
  /** The round JUMP plays. */
  round: DevRound;
}

/** The locked pads' hint lines. */
export const ARENA_LOCKED = {
  hero: '??? - FIND THIS HERO FIRST',
  training: '??? - FREE THIS HERO FIRST',
  airship: "??? - FIND LARRY'S AIRSHIP FIRST",
  bonus: '??? - FIND THE BONUS SPOT FIRST',
  stage: `??? - PLAY ${TUTORIAL_LEVEL} FIRST`,
} as const;

/** The file has met hero `id`: its captive was talked to (SaveFile.met), or it is freed. */
export function metHero(game: Game, id: string): boolean {
  return game.met.includes(id) || game.freed.includes(id);
}

const BONUS_FRAME: Readonly<Record<BonusKind, string>> = {
  'toad-house': 'node-toad-house',
  memory: 'node-spade',
  slots: 'node-spade',
};

/** A bonus game as a round: a prize passes, nothing won fails, Give up quits. */
function bonusRound(kind: BonusKind): DevRound {
  return {
    title: BONUS_TITLES[kind],
    who: 'TOAD',
    create: (game, done) =>
      createBonusScene(game, kind, freshSeed(), (r) =>
        done(r.gaveUp ? 'quit' : r.prizes.length ? 'pass' : 'fail'),
      ),
  };
}

/**
 * A hero's training stage as a round (START AT first): finished passes, Skip training quits.
 */
function trainingRound(hero: CharacterDef): DevRound {
  return {
    title: fontText(`${hero.name} TRAINING`),
    hero: hero.id,
    create: (game, done) =>
      trainingScene(game, hero, {
        player: 0,
        replay: true,
        onEnd: (r) => done(r === 'done' ? 'pass' : 'quit'),
      }),
  };
}

/** Every arena game, in pad order, from the registries (`characters`: the roster). */
export function arenaGames(characters: readonly CharacterDef[] = CHARACTERS): ArenaGame[] {
  const all = (game: Game) => game.mapUnlockAll;
  const secrets = (game: Game) => game.mapProgress.secrets;
  return [
    ...Object.values(MINIGAMES).map((def): ArenaGame => ({
      id: `mini-${def.hero}`,
      kind: 'mini',
      title: def.title,
      hero: def.hero,
      locked: ARENA_LOCKED.hero,
      found: (game) => all(game) || metHero(game, def.hero),
      round: def,
    })),
    {
      id: 'airship',
      kind: 'airship',
      title: AIRSHIP_TITLE,
      locked: ARENA_LOCKED.airship,
      found: (game) => all(game) || game.met.includes(MET_LARRY) || secrets(game).includes(CRYSTAL_BALL),
      round: AIRSHIP_CHALLENGE,
    },
    ...BONUS_KINDS.map((kind): ArenaGame => ({
      id: `bonus-${kind}`,
      kind: 'bonus',
      title: BONUS_TITLES[kind],
      locked: ARENA_LOCKED.bonus,
      found: (game) => all(game) || secrets(game).includes(CRYSTAL_BALL),
      round: bonusRound(kind),
    })),
    {
      id: `stage-${TUTORIAL_LEVEL}`,
      kind: 'stage',
      title: TUTORIAL_ROUND.title,
      hero: FIRST_HERO,
      locked: ARENA_LOCKED.stage,
      found: (game) => all(game) || game.mapProgress.cleared.includes(TUTORIAL_LEVEL),
      round: TUTORIAL_ROUND,
    },
    ...characters
      .filter((c) => hasTraining(c.id))
      .map((c): ArenaGame => ({
        id: `train-${c.id}`,
        kind: 'training',
        title: fontText(`${c.name} TRAINING`).slice(0, 32),
        hero: c.id,
        locked: ARENA_LOCKED.training,
        found: (game) => all(game) || game.tutorials.includes(c.id) || game.freed.includes(c.id),
        round: trainingRound(c),
      })),
  ];
}

/** The arena games laid out on the page (the registry's roster), by pad node id. */
export const ARENA_GAMES: readonly ArenaGame[] = arenaGames();
const BY_PAD = new Map(ARENA_GAMES.map((g) => [arenaPadId(g.id), g]));

// The page grows with the registries.
installArenaGames(ARENA_GAMES.map((g) => g.id));

/** The game on arena pad `n` (a 'game' node), or null. */
export function arenaGameAt(n: MapNode | undefined): ArenaGame | null {
  return (n?.kind === 'game' && n.game ? BY_PAD.get(arenaPadId(n.game)) : null) ?? null;
}

/** The hint line on pad `n`: the game's title, or why it is still dark. */
export function arenaPadHint(game: Game, n: MapNode): string {
  const g = arenaGameAt(n);
  if (!g) return '???';
  return g.found(game) ? g.title : g.locked;
}

/** 'MIRROR RACE' → 'Mirror Race' (the announcer's words). */
const spoken = (text: string): string =>
  text.toLowerCase().replace(/(^|[\s-])([a-z'])/g, (_, a: string, b: string) => a + b.toUpperCase());

/** What the announcer says on pad `n`: "Mirror Race, Luigi. Jump to play." / "Locked. Find this hero first." */
export function arenaPadSaid(game: Game, n: MapNode, jump: string): string {
  const g = arenaGameAt(n);
  if (!g) return 'Locked.';
  if (!g.found(game)) return `Locked. ${spoken(g.locked.replace(/^\?\?\? - /, ''))}.`;
  const hero = g.hero ? game.deps.characters.find((c) => c.id === g.hero)?.name : undefined;
  const who = g.kind === 'mini' && hero ? `, ${hero}` : '';
  return `${spoken(g.title)}${who}. ${jump} to play, for fun.`;
}

/** The touch labels on pad `n` (idle): PLAY while found, nothing to press otherwise. */
export function arenaPadTouch(game: Game, n: MapNode): Partial<TouchLabels> {
  const g = arenaGameAt(n);
  return { jump: g?.found(game) ? 'PLAY' : null };
}

/**
 * JUMP on pad `n` (the map is on top): a found game plays one round over the map, then the result
 * card, then the map again with the hero on the pad and its music (nothing saved: `then` runs when
 * the card is gone). Larry's airship, the one game played as a hero of your own, opens character
 * select first (pickRoundHero: the round is played as the picked hero, the file keeps its own;
 * Back is the map again with nothing started, and `then` runs). A dark pad bumps. Returns whether
 * a round (or its character select) started.
 */
export function playArenaPad(game: Game, n: MapNode, music: string, then: () => void): boolean {
  const g = arenaGameAt(n);
  if (!g || !g.found(game)) {
    game.ctx.audio.sfx('bump');
    return false;
  }
  game.ctx.audio.sfx('coin');
  const back = () => {
    game.ctx.audio.playMusic(music);
    then();
  };
  const start = (round: DevRound): boolean => {
    try {
      playRound(game, round, (result) => {
        game.scenes.push(
          new DevMiniGameResultScene(game, round, result, () => {
            game.scenes.pop();
            back();
          }),
        );
      });
    } catch (e) {
      // A round that cannot start: the map as it was, and why in the console.
      console.error(e);
      back();
      return false;
    }
    return true;
  };
  if (!g.round.asHero) return start(g.round);
  // The map's music plays on under the select; Back leaves it playing.
  pickRoundHero(game, g.round, start, then);
  return true;
}

/** The pads (items sheet, 16×16): a trophy for games, a signpost for tutorials, a dark '?'. */
export const ARENA_PAD_FRAMES: Readonly<Record<ArenaKind | 'locked', string>> = {
  mini: 'map-arena-game',
  airship: 'map-arena-game',
  bonus: 'map-arena-game',
  stage: 'map-arena-tutorial',
  training: 'map-arena-tutorial',
  locked: 'map-arena-locked',
};

/** The bare pad (no emblem) a figure stands on: the pad's own frame + '-plate'. */
export const arenaPlateFrame = (pad: string): string => `${pad}-plate`;

/** Px below the pad tile's top where a figure's feet rest: the middle of the pad's plate (rows 10-15). */
export const ARENA_FEET = 13;

/**
 * Draws pad `n` at its tile (shifted `ox`). What stands at the pad (the hero in colour when found,
 * a black silhouette when not; Larry at his airship's pad; the bonus game's icon) stands on the
 * bare pad, feet on its plate, centred and fully in view; the pad's colour still tells a game
 * (red) from a tutorial (blue) or a dark pad. A pad with nobody on it shows its emblem: a trophy,
 * a signpost or the dark '?'. Heroes are up to 32 px tall; the page's slots leave room (arena.ts).
 */
export function drawArenaPad(r: Renderer, game: Game, n: MapNode, ox: number, t: number): void {
  const items = game.ctx.assets.sheet('items');
  const g = arenaGameAt(n);
  const found = !!g && g.found(game);
  const x = ox + n.x * 16;
  const y = n.y * 16;
  const pad = ARENA_PAD_FRAMES[found && g ? g.kind : 'locked'];
  const figure = arenaFigure(game, g, found, t);
  if (!figure) {
    r.sprite(items, pad, x, y);
    return;
  }
  r.sprite(items, arenaPlateFrame(pad), x, y);
  const f = figure.sheet.frames.get(figure.frame);
  const w = f?.w ?? 16;
  r.sprite(figure.sheet, figure.frame, x + 8 - (w >> 1), y + ARENA_FEET - (f?.h ?? 16), figure.flip);
}

/** What stands on a pad: the game's hero (a silhouette until found), Larry, a bonus icon; else null. */
function arenaFigure(
  game: Game,
  g: ArenaGame | null,
  found: boolean,
  t: number,
): { sheet: SpriteSheet; frame: string; flip: boolean } | null {
  const assets = game.ctx.assets;
  if (g && found && g.kind === 'bonus') {
    const kind = g.id.slice('bonus-'.length) as BonusKind;
    return { sheet: assets.sheet('smb3'), frame: BONUS_FRAME[kind] ?? 'node-spade', flip: false };
  }
  if (g && found && g.kind === 'airship')
    return { sheet: assets.sheet('smb3'), frame: (t >> 4) & 1 ? 'larry-1' : 'larry-0', flip: false };
  const def = g?.hero ? game.deps.characters.find((c) => c.id === g.hero) : undefined;
  if (!g || !def) return null;
  const p = def.portrait;
  // A training pad's hero faces left, a mini game's right.
  return {
    sheet: assets.sheet(p.sheet, found ? p.palette : fxPalette(p.palette, 'silhouette')),
    frame: p.frame,
    flip: g.kind === 'training',
  };
}
