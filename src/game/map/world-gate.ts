import { mapPage } from '@content/worldmap';
import { VALLEY_LIVE, VALLEY_PAGE_ID } from '@content/worldmap/valley-of-bowser';
import { beat } from '../story/beats';
import {
  gateScript,
  RIFT_SEALED_PAGES,
  VALLEY_SEALED_PAGES,
  WELCOMES,
  welcomeHint,
  type Page,
} from '../story/script';
import { exitId, isOpen, revealId, sealStands } from './rules';
import type { ToadScene } from './toad-guide';
import type { AboveLookId, MapNode, MapProgress, WorldExit, WorldMapPage } from './types';

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
 * - (0.4.55) Once the VALLEY OF BOWSER is live, campaign World 8's road on leads there and is an
 *   ordinary world gate: its seal (not the crack) shatters when Sophia III is freed, with no
 *   cutaway; its reminder is VALLEY_SEALED_PAGES. The rift moves to the Valley (RIFT_PAGE), whose
 *   road on to the Lost Levels opens after Bowser's Castle (no hero gate).
 * - The welcome: the first arrival on a world's start node (worlds 2-8), the local speaking in
 *   the box at the top (no Toad); standing on the node, TALK (or JUMP) plays it again.
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
 * Whether gate exit `e` is the rift (2.12): World 8's road straight on to the Lost Levels, as it
 * was until the VALLEY OF BOWSER (classic, and campaign before 0.4.55). Drawn as the crack.
 */
export function isRiftExit(e: WorldExit): boolean {
  return e.to.startsWith('ll-');
}

/**
 * The page Toad's rift scene plays on (2.12): the VALLEY OF BOWSER once it is live (0.4.55: the
 * wand breaks at Bowser's Castle, and the road on to the Lost Levels leaves the Valley), else
 * World 8.
 */
export const RIFT_PAGE: string = VALLEY_LIVE ? VALLEY_PAGE_ID : 'smb-8';

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
  /** (0.4.55) No cutaway, but the seal shatters (World 8's road on to the Valley). */
  shatter?: boolean;
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
  if (world === 8 && isRiftExit(e))
    return { world, exit: e, bowser: [], toad: [], tear: g.seen(beat.sealed(g.page.id)) };
  // World 8's road on to the Valley: its seal shatters, no cutaway and no words (0.4.55).
  if (world === 8) return { world, exit: e, bowser: [], toad: [], tear: false, shatter: true };
  const s = gateScript(world, g.hero);
  if (!s) return null;
  return { world, exit: e, bowser: s.bowser, toad: s.toad, tear: false };
}

/** The welcome of `page` (worlds 2-8), or null. */
export function welcomeOf(page: string): (typeof WELCOMES)[string] | null {
  return WELCOMES[page] ?? null;
}

/**
 * What page `page`'s local says (worlds 2-8): its own-hero page when one of the heroes `playing`
 * is the world's hero (its gate's; 0.4.47, first of the three sets), else the welcome, or once
 * that hero is among `freed`, the after-freed page instead. Empty without a local.
 */
export function welcomePages(
  page: string,
  freed: readonly string[],
  playing: readonly string[] = [],
): readonly Page[] {
  const w = welcomeOf(page);
  if (!w) return [];
  const map = mapPage(page);
  const hero = map ? gateExit(map)?.gate : undefined;
  if (hero && w.own?.length && playing.includes(hero)) return w.own;
  return hero && freed.includes(hero) && w.after?.length ? w.after : w.pages;
}

/**
 * The routine scenes due on the page shown (after the major ones): Toad's reminder while the seal
 * stands, then the local's welcome on the first arrival on the start node.
 */
export function gateScenes(g: GateInput): ToadScene[] {
  const out: ToadScene[] = [];
  const id = g.page.id;
  if (!smbWorld(id)) return out;
  const sealed = sealedExit(g.progress, g.page);
  if (sealed && !g.seen(beat.sealed(id))) {
    const pages =
      smbWorld(id) === 8
        ? isRiftExit(sealed)
          ? RIFT_SEALED_PAGES
          : VALLEY_SEALED_PAGES
        : (gateScript(smbWorld(id), g.hero)?.reminder ?? []);
    out.push({ ids: [beat.sealed(id)], pages: [...pages], walk: false });
  }
  const w = welcomeOf(id);
  const start = g.page.nodes.find((n) => n.kind === 'start');
  if (w && start && g.node === start.id && !g.seen(beat.welcome(id)))
    out.push({ ids: [beat.welcome(id)], pages: [...welcomePages(id, g.progress.freed ?? [])], walk: false });
  return out;
}

/** The start node of `page` when it has a local (worlds 2-8) and the file has it open, else null. */
export function localNode(progress: MapProgress, page: WorldMapPage): MapNode | null {
  if (!welcomeOf(page.id)) return null;
  const start = page.nodes.find((n) => n.kind === 'start');
  return start && isOpen(progress, page, start.id) ? start : null;
}

/**
 * The column a world's local stands in, counted from its start node, where the default (the next
 * column) has a tree or a rock in the way (World 3: a tree just below the road).
 */
const LOCAL_COLUMN: Readonly<Record<string, number>> = { 'smb-3': 2 };

/**
 * Pixels a local stands lower than the default on a page drawn from above with this look (0.4.50,
 * campaign play): on Mega City, Roll's head clears the walkway's rim over her; on Galesburg and
 * Galuga Island (0.4.53) the elder's and the sergeant's heads clear the road's rim and its light
 * halo, and on THE UNDERWORLD (0.4.54) the miner's. Classic pages keep the default.
 */
const LOCAL_DROP: Readonly<Partial<Record<AboveLookId, number>>> = {
  megacity: 1,
  galesburg: 2,
  galuga: 2,
  underworld: 2,
};

/**
 * Where page `page`'s local is drawn (its 16x20 sprite's top-left, px), or null without one:
 * beside the start node, down and to the right, its head just under the road on (every start
 * node is at the page's left edge, its road leaving to the right). That keeps it in full view of
 * any hero standing on the node, Sophia III's tank included, and off the roads and the nodes
 * (tests/sim/world-gates.test.ts checks every world with every hero).
 */
export function localSpot(page: WorldMapPage): { x: number; y: number } | null {
  if (!welcomeOf(page.id)) return null;
  const start = page.nodes.find((n) => n.kind === 'start');
  if (!start) return null;
  return {
    x: (start.x + (LOCAL_COLUMN[page.id] ?? 1)) * 16,
    y: start.y * 16 + 12 + (page.above ? (LOCAL_DROP[page.above] ?? 0) : 0),
  };
}

/** The hint line on a start node with a local ('TALK TO THE HEALER'), or ''. */
export function localHint(page: string): string {
  const w = welcomeOf(page);
  return w ? welcomeHint(w.local) : '';
}
