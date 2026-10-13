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
 * page's roads in the new order; nothing else changes. 0.4.53 adds World 6 (6-2 ↔ 6-1) and World 7
 * (7-3 → 7-1, 7-1 → 7-2, 7-2 → 7-3).
 */

/** Internal level id → the label the campaign shows for it, for levels shown as another stage. */
export const CAMPAIGN_LABELS: Readonly<Record<string, string>> = {
  // World 4 (Samus): her cavern, internal 4-2 (Larry's airship comes with it), is played first.
  '4-2': '4-1',
  '4-1': '4-2',
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
