import type { WorldMapPage } from '@game/map/types';
import { LOST_1 } from './lost1';

/*
 * The Lost Levels' map pages, in play order: 'll-1'..'ll-8', 'll-9' (World 9) and 'll-10'..
 * 'll-13' (worlds A-D), group 'll'. PLACEHOLDER: only 'll-1', with one node, so the hub's Lost
 * Levels pad has somewhere to land. The Lost Levels pages pass owns this folder and replaces it
 * (docs/WORLD_MAP.md); the registry (../index.ts) spreads this list after the hub.
 */
export const LOST_PAGES: WorldMapPage[] = [LOST_1];
