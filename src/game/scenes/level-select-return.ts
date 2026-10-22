import type { Game } from './game';
import type { MenuScene } from './menu';
import { MAP_SETS, mapSetOf, type MapSet } from './original-game';
import { worldName } from './level-targets';
import { DevMenuScene } from './dev';
import {
  DevCampaignScene,
  DevClassicScene,
  DevLevelPage,
  DevLevelPagesScene,
  DevWorldScene,
  type DevPick,
} from './dev-play';
import { DEV_VILLAGE } from '../town/secret-house';
import { CUSTOM_PREFIX } from '../level/library';

/*
 * v0.4.74 items 63 / 64 (owner): Dev > Level select takes its starts back to itself. A level
 * cleared, Quit, and the last castle's credits go back to the world's level page the start was
 * made from (Again too), its cursor on the level just played, which it says (the page's own
 * opening line). The pages under it are rebuilt as the player reached them (Dev mode > Level
 * select > Classic or Campaign > ...), so BACK steps back one page at a time. Nothing is written.
 * (Item 94 removed the Level Select cheat, whose practice runs also came back to it.)
 */

/** World and level of area `id` in map set `set` ("ll-10-2-intro": 10, 2), or null. */
export function worldStageOf(set: MapSet, id: string): { world: number; stage: number } | null {
  const prefix = set.start.replace(/\d+-\d+$/, '');
  if (!id.startsWith(prefix)) return null;
  const m = /^(\d+)-(\d+)/.exec(id.slice(prefix.length));
  if (!m) return null;
  const world = Number(m[1]);
  const stage = Number(m[2]);
  if (world < 1 || world > set.lastWorld || stage < 1 || stage > 4) return null;
  return { world, stage };
}

/** Puts `page`'s cursor on its row `label` (when it has one) before it opens. */
function focus(page: MenuScene, label: string): MenuScene {
  page.focusLabel(label);
  return page;
}

/**
 * Dev > Level select again, over the REMIX title (just shown): the pages down to the one that
 * lists level `levelId` (the START page's `pick` says which branch), its cursor on that level.
 */
export function openDevLevelSelect(game: Game, pick: Pick<DevPick, 'branch'>, levelId: string): void {
  const push = (page: MenuScene, label?: string) => game.scenes.push(label ? focus(page, label) : page);
  push(new DevMenuScene(game), 'Level select');
  if (pick.branch === 'classic') {
    push(new DevLevelPagesScene(game), 'Classic');
    const set = mapSetOf(levelId);
    const at = worldStageOf(set, levelId);
    push(new DevClassicScene(game), set.label);
    if (!at) return;
    push(new DevWorldScene(game, 'classic', set, false), `World ${worldName(at.world)}`);
    push(new DevLevelPage(game, 'classic', set, at.world, false), `${worldName(at.world)}-${at.stage}`);
    return;
  }
  push(new DevLevelPagesScene(game), 'Campaign');
  const lost = MAP_SETS[2] as MapSet;
  const smb = MAP_SETS[0] as MapSet;
  const set = levelId.startsWith(lost.start.replace(/\d+-\d+$/, '')) ? lost : smb;
  const at = worldStageOf(set, levelId);
  if (!at) {
    const row =
      levelId === DEV_VILLAGE
        ? 'Village'
        : levelId.startsWith(CUSTOM_PREFIX)
          ? 'Custom levels'
          : levelId === '1-0' || levelId.startsWith('1-0-')
            ? 'Tutorial 1-0'
            : 'Back';
    push(new DevCampaignScene(game), row);
    return;
  }
  push(new DevCampaignScene(game), set === lost ? 'Lost story level' : 'Story level');
  push(
    new DevWorldScene(game, 'campaign', set, false),
    `${set === lost ? 'Lost world' : 'World'} ${worldName(at.world)}`,
  );
  push(new DevLevelPage(game, 'campaign', set, at.world, false), `${worldName(at.world)}-${at.stage}`);
}
