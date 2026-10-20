/*
 * The campaign's level order (owner, Oct 13; docs/WORLD_MAP.md "Campaign order"): each world's
 * FIRST level is the one where its hero is met, so the rest of the world is played as that hero.
 * Campaign play only: classic play keeps the original SMB order and shows the real ids.
 *
 * Internal level ids never change (saves and save codes keep them); only the campaign's roads (its
 * map pages, content/worldmap) and the labels the player sees change. This table is the one place
 * those labels come from: the map's header and nodes (MapNode.shown, set on every campaign page
 * from it), the level's intro card, the HUD's WORLD, the announcer, a hero stage's own HUD.
 *
 * A world played in another order adds its rows here (internal → shown) and draws its campaign
 * page's roads in the new order; nothing else changes. Since 0.4.53 World 6 (6-2 ↔ 6-1) and World 7
 * (7-3 → 7-1, 7-1 → 7-2, 7-2 → 7-3) too.
 */
import { worldLabel } from '../hud/world-label';

/** Internal level id → the label the campaign shows for it, for levels shown as another stage. */
export const CAMPAIGN_LABELS: Readonly<Record<string, string>> = {
  // World 4 (Samus): her cavern, internal 4-2 (Larry's airship comes with it), is played first.
  '4-2': '4-1',
  '4-1': '4-2',
  // World 6 (Ryu, 0.4.53): his dojo, under internal 6-2 (the city street), is played first.
  '6-2': '6-1',
  '6-1': '6-2',
  // World 7 (Bill, 0.4.53): his jungle camp, under internal 7-3, is played first; then the
  // snowfield (internal 7-1) and the jungle river (internal 7-2); 7-4 stays last.
  '7-3': '7-1',
  '7-1': '7-2',
  '7-2': '7-3',
};

/** The label level `levelId` shows as in the campaign ('4-2' → '4-1'); classic: the id itself. */
export function campaignLabel(levelId: string, campaign = true): string {
  return (campaign && CAMPAIGN_LABELS[levelId]) || levelId;
}

/** The internal level shown as `label` in the campaign ('4-1' → '4-2'): campaignLabel's inverse. */
export function campaignLevel(label: string): string {
  for (const [id, shown] of Object.entries(CAMPAIGN_LABELS)) if (shown === label) return id;
  return label;
}

/**
 * The stage number a level of SMB world `world`, stage `stage` shows as: its campaign label's
 * when `campaignOrder` (GameState.campaignOrder: a campaign file playing an SMB level), else
 * `stage`. Lost Levels never set campaignOrder, so their own world numbers never match a row.
 */
export function shownStage(world: number, stage: number, campaignOrder: boolean | undefined): number {
  if (!campaignOrder) return stage;
  const label = CAMPAIGN_LABELS[`${world}-${stage}`];
  return label ? Number(label.split('-')[1]) : stage;
}

/** A level shown by a place's name: on the HUD and the intro card (`shown`), to the announcer (`said`). */
export interface PlaceName {
  readonly shown: string;
  readonly said: string;
}

/**
 * Levels the player sees by a place's name, never by a number (0.4.55: BOWSER'S CASTLE, internal
 * 8-5, the VALLEY OF BOWSER's node; owner, Oct 13). Keyed by world and stage, so a level's areas
 * share it. Every play shows it (the level is the campaign's own; classic never reaches it).
 */
export const PLACE_NAMES: Readonly<Record<string, PlaceName>> = {
  '8-5': { shown: "BOWSER'S CASTLE", said: "Bowser's Castle" },
};

/** The place name world `world`, stage `stage` is shown by, or null for a numbered level. */
export function shownPlace(world: number, stage: number): PlaceName | null {
  return PLACE_NAMES[`${world}-${stage}`] ?? null;
}

/**
 * What the announcer calls a level: its place's name, else 'World 4-1' (the campaign's label),
 * with the world as shown (worldLabel: the Lost Levels' worlds 10-13 are A-D).
 */
export function spokenLevel(world: number, stage: number, campaignOrder: boolean | undefined): string {
  return (
    shownPlace(world, stage)?.said ?? `World ${worldLabel(world)}-${shownStage(world, stage, campaignOrder)}`
  );
}
