import type { Game } from '@game/scenes/game';
import type { LevelScene } from '@game/scenes/level';
import { Partner } from '@game/entities/objects/partner';
import { playStoryCards } from './cards';
import { PARTNERS } from './script';

/**
 * What the announcer says when a player comes within a partner's reach: "Doctor Light. Up to
 * talk." (the statue: "Up to read."); in co-op prefixed with the player.
 */
export function partnerNearSaid(who: string, player: number, coop: boolean): string {
  const script = PARTNERS[who];
  const name = script?.name ?? who;
  const verb = script?.verb === 'READ' ? 'read' : 'talk';
  return `${coop ? `Player ${player + 1}: ` : ''}${name}. Up to ${verb}.`;
}

/**
 * A player pressed up next to partner `who` (docs/STORY.md 2.5-2.10): its pages play in the story
 * box over the frozen level (OK next page, BACK skips the rest), then play goes on. It can be
 * talked to again any time. The old man's coin (PartnerScript.coinAfter) pops out over him once
 * that page is read on with OK, at most once a visit to the level (Partner.giveCoin).
 */
export function talkToPartner(game: Game, level: LevelScene, who: string): void {
  const script = PARTNERS[who];
  if (!script) return;
  const world = level.world;
  const partner = world.entities.find((e): e is Partner => e instanceof Partner && e.alive && e.who === who);
  playStoryCards(game, world, script.pages, () => level.resumePlay(), {
    onNext: (i) => {
      if (i === script.coinAfter) partner?.giveCoin(world);
    },
  });
}
