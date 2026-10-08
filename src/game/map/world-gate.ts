import { mapPage } from '@content/worldmap';
import { beat } from '../story/beats';
import { gateScript, RIFT_SEALED_PAGES, WELCOMES, welcomeHint, type Page } from '../story/script';
import { exitId, isOpen, revealId, sealStands } from './rules';
import type { ToadScene } from './toad-guide';
import type { MapNode, MapProgress, WorldExit, WorldMapPage } from './types';

/*
 * The world gates and the welcomes on the world map (docs/STORY.md 2.3b, 2.12; campaign only, the
 * map scene asks only while the story plays). Pure: the map scene (scenes/world-map.ts) plays what
 * these say is due.
 *
 * - The seal: while a castle is cleared and its world's hero is still captive, the road on stays
 *   shut (rules.gateHolds) and a seal stands at the page's edge (rules.sealStands).
 * - The reminder: the first time the page shows with the seal standing, Toad's box (routine).
 * - The gate scene (major): the first time the page shows with the road on being drawn in (the
 *   castle and the hero both done), Bowser's throne-room cutaway and his misfire, the seal
 *   shattering, the road drawing in, then Toad walking in. World 8's road on is the rift: its
 *   reminder is RIFT_SEALED_PAGES, and opening it is Toad's rift scene (toad-guide.ts), after the
 *   crack tears wide open when it had been seen shut.
 * - The welcome: the first arrival on a world's start node (worlds 2-8), the local speaking in
 *   the box at the top (no Toad); standing on the node, TALK (up) plays it again.
 */

/** World `n`'s number from its SMB page id ('smb-3' → 3), or 0. */
export function smbWorld(page: string): number {
  const m = /^smb-(\d)$/.exec(page);
  return m ? Number(m[1]) : 0;
}

/** The road on out of `page` that waits for a hero (its world gate), or null. */
export function gateExit(page: WorldMapPage): WorldExit | null {
  return page.exits.find((e) => e.gate !== undefined) ?? null;
}

/** The gate exit of `page` whose seal stands on this file, or null. */
export function sealedExit(progress: MapProgress, page: WorldMapPage): WorldExit | null {
  const e = gateExit(page);
  return e && sealStands(progress, page, e) ? e : null;
}

/**
 * World 8's rift is open on this file (2.12): 8-4 is beaten and its gate's hero (Sophia III) is
 * freed. Toad's rift scene waits for it.
 */
export function riftOpen(progress: MapProgress, freed: readonly string[]): boolean {
  const page = mapPage('smb-8');
  const e = page ? gateExit(page) : null;
  return progress.gameCleared === true && (!e?.gate || freed.includes(e.gate));
}

/** What gateDue and gateScenes read. */
export interface GateInput {
  page: WorldMapPage;
  progress: MapProgress;
  seen(id: string): boolean;
  /** Player 1's full name, in font characters ('MEGA MAN'). */
  hero: string;
  /** The node the hero stands on. */
  node: string;
}

/** The gate scene due now: page `world`'s road on is being drawn in (`pending`: reveal ids). */
export interface GateBreak {
  world: number;
  exit: WorldExit;
  /** Bowser's cutaway (worlds 1-7; none for World 8's rift). */
  bowser: readonly Page[];
  /** Toad once the seal is gone (worlds 1-7; World 8's is the rift scene in toad-guide.ts). */
  toad: readonly Page[];
  /** World 8: the crack had been seen shut, so it is seen tearing wide open. */
  tear: boolean;
}

/**
 * The gate scene due on the page shown: its gate exit's road is waiting in the reveal (`pending`,
 * page-qualified reveal ids) and the scene has not played on this file. Null otherwise.
 */
export function gateDue(g: GateInput, pending: readonly string[]): GateBreak | null {
  const world = smbWorld(g.page.id);
  const e = gateExit(g.page);
  if (!world || !e || g.seen(beat.gate(g.page.id))) return null;
  if (!pending.includes(revealId(g.page.id, exitId(e)))) return null;
  if (world === 8) return { world, exit: e, bowser: [], toad: [], tear: g.seen(beat.sealed(g.page.id)) };
  const s = gateScript(world, g.hero);
  if (!s) return null;
  return { world, exit: e, bowser: s.bowser, toad: s.toad, tear: false };
}

/** The welcome of `page` (worlds 2-8), or null. */
export function welcomeOf(page: string): (typeof WELCOMES)[string] | null {
  return WELCOMES[page] ?? null;
}

/**
 * The routine scenes due on the page shown (after the major ones): Toad's reminder while the seal
 * stands, then the local's welcome on the first arrival on the start node.
 */
export function gateScenes(g: GateInput): ToadScene[] {
  const out: ToadScene[] = [];
  const id = g.page.id;
  if (!smbWorld(id)) return out;
  if (sealedExit(g.progress, g.page) && !g.seen(beat.sealed(id))) {
    const pages = smbWorld(id) === 8 ? RIFT_SEALED_PAGES : (gateScript(smbWorld(id), g.hero)?.reminder ?? []);
    out.push({ ids: [beat.sealed(id)], pages: [...pages], walk: false });
  }
  const w = welcomeOf(id);
  const start = g.page.nodes.find((n) => n.kind === 'start');
  if (w && start && g.node === start.id && !g.seen(beat.welcome(id)))
    out.push({ ids: [beat.welcome(id)], pages: [...w.pages], walk: false });
  return out;
}

/** The start node of `page` when it has a local (worlds 2-8) and the file has it open, else null. */
export function localNode(progress: MapProgress, page: WorldMapPage): MapNode | null {
  if (!welcomeOf(page.id)) return null;
  const start = page.nodes.find((n) => n.kind === 'start');
  return start && isOpen(progress, page, start.id) ? start : null;
}

/** The hint line on a start node with a local ('TALK TO THE HEALER'), or ''. */
export function localHint(page: string): string {
  const w = welcomeOf(page);
  return w ? welcomeHint(w.local) : '';
}
