import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { decorDef } from '@content/sprites/decor';
import { AssetRegistry } from '@engine/assets/registry';
import { CHARACTERS } from '@game/characters/registry';
import { applyLook, campaignLevel } from '@game/level/campaign';
import {
  hasSolidFloors,
  isCastleTheme,
  isSwimLevel,
  isWaterTheme,
  type LevelData,
  type Theme,
} from '@game/level/schema';
import { enemyPalette } from '@game/entities/enemies/enemy';
import { Decoration, decorPalette } from '@game/entities/objects/decoration';
import { levelMusic } from '@game/scenes/level';
import { hasThemeBackdrop } from '@game/world/theme-backdrop';
import { World } from '@game/world/world';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { MARIO } from '@game/characters/mario';

/*
 * 0.4.12's hero tributes: five campaign levels restyled in a hero's look (owner decisions), each
 * through its map's `campaignTheme:` / `campaignMusic:` headers and `[campaign-decor]`, applied by
 * level/campaign.ts in campaign play only. The coin heavens above them share the look; bonus rooms,
 * water areas and the other areas keep their own. A look is skin only: every restyled level plays
 * exactly as the classic one (same tiles, zones, entities, start and clock, and every rule that
 * keys off the theme answers the same).
 *
 * 0.4.24: World 2 is Hyrule, Link's world: its other levels and areas take Zelda II looks too (the
 * field for 2-2's way in and out and 2-3, a lake for 2-2, a palace for 2-4, a cave for 2-1's bonus
 * room and the Moblin's cave; hyrule-looks.test.ts). 2-2's lake is no water theme: it swims by its
 * map's `swim: true`.
 */

const RESTYLES: Readonly<Record<string, { theme: Theme; music: string; hero: string }>> = {
  '2-1': { theme: 'zelda2', music: 'zelda2-field', hero: 'link' },
  '2-1-sky': { theme: 'zelda2', music: 'zelda2-field', hero: 'link' },
  '2-1-sky2': { theme: 'zelda2', music: 'zelda2-field', hero: 'link' },
  // World 2 as Hyrule (0.4.24).
  '2-1-bonus': { theme: 'zelda2-cave', music: 'zelda2-cave', hero: 'link' },
  '2-1-cave': { theme: 'zelda2-cave', music: 'zelda2-cave', hero: 'link' },
  '2-2-intro': { theme: 'zelda2', music: 'zelda2-field', hero: 'link' },
  '2-2': { theme: 'zelda2-water', music: 'zelda2-water', hero: 'link' },
  '2-2-exit': { theme: 'zelda2', music: 'zelda2-field', hero: 'link' },
  '2-3': { theme: 'zelda2', music: 'zelda2-field', hero: 'link' },
  '2-4': { theme: 'zelda2-palace', music: 'zelda2-palace', hero: 'link' },
  '3-1': { theme: 'megaman-stage', music: 'mm-stage-31', hero: 'megaman' },
  '3-1-sky': { theme: 'megaman-stage', music: 'mm-stage-31', hero: 'megaman' },
  // World 3 as Mega Man's world (0.4.26).
  '3-1-bonus': { theme: 'megaman-metal', music: 'mm-station', hero: 'megaman' },
  '3-2': { theme: 'megaman-wood', music: 'mm-wood', hero: 'megaman' },
  '3-3': { theme: 'megaman-air', music: 'mm-air', hero: 'megaman' },
  '3-4': { theme: 'megaman-fortress', music: 'mm-wily', hero: 'megaman' },
  '4-2': { theme: 'brinstar', music: 'brinstar', hero: 'samus' },
  // World 4 as Samus's world, Zebes (0.4.27).
  '4-1': { theme: 'crateria', music: 'crateria', hero: 'samus' },
  '4-1-bonus': { theme: 'brinstar', music: 'brinstar', hero: 'samus' },
  '4-2-intro': { theme: 'crateria', music: 'crateria', hero: 'samus' },
  '4-2-exit': { theme: 'crateria', music: 'crateria', hero: 'samus' },
  '4-2-warp': { theme: 'crateria', music: 'crateria', hero: 'samus' },
  '4-2-bonus': { theme: 'brinstar', music: 'brinstar', hero: 'samus' },
  '4-3': { theme: 'norfair', music: 'norfair', hero: 'samus' },
  '4-4': { theme: 'tourian-lair', music: 'tourian', hero: 'samus' },
  // World 5 as Simon's world, Transylvania (0.4.28).
  '5-1': { theme: 'cv-gate', music: 'cv-hall', hero: 'simon' },
  '5-1-bonus': { theme: 'cv-catacomb', music: 'crypt', hero: 'simon' },
  '5-2': { theme: 'cv-town', music: 'cv-town', hero: 'simon' },
  '5-2-sky': { theme: 'cv-storm', music: 'cv-town', hero: 'simon' },
  '5-2-water': { theme: 'cv-lake', music: 'cv-lake', hero: 'simon' },
  '5-3': { theme: 'cv-clock', music: 'cv-stage', hero: 'simon' },
  '5-4': { theme: 'castlevania', music: 'cv-hall', hero: 'simon' },
  // World 6 as Ryu's world (0.4.29); 6-2 and its coin heaven keep the 0.4.12 night city.
  '6-1': { theme: 'ng-field', music: 'ng-stage', hero: 'ryu' },
  '6-2-bonus': { theme: 'ng-sewer', music: 'ng-sewer', hero: 'ryu' },
  '6-2-bonus2': { theme: 'ng-sewer', music: 'ng-sewer', hero: 'ryu' },
  '6-2-water': { theme: 'ng-harbor', music: 'ng-harbor', hero: 'ryu' },
  '6-3': { theme: 'ng-pass', music: 'ng-pass', hero: 'ryu' },
  '6-4': { theme: 'ng-temple', music: 'ng-boss', hero: 'ryu' },
  '6-2': { theme: 'ninja-city', music: 'ng-city', hero: 'ryu' },
  '6-2-sky': { theme: 'ninja-city', music: 'ng-city', hero: 'ryu' },
  // 7-3's Contra jungle came first (0.4.9), the model for the others.
  '7-3': { theme: 'contra-jungle', music: 'contra-jungle', hero: 'bill' },
};
const IDS = Object.keys(RESTYLES);

/** The level as the campaign plays it, and as it would without its look. */
const both = (id: string): [LevelData, LevelData] => {
  const lvl = getLevel(id);
  const plain: LevelData = { ...lvl };
  delete plain.campaignLook;
  return [campaignLevel(lvl), campaignLevel(plain)];
};

/** Everything but the skin (theme, music, decor and the look itself). */
const play = (l: LevelData) => {
  const { theme: _t, music: _m, decor: _d, campaignLook: _l, ...rest } = l;
  return { ...rest, tiles: Array.from(l.tiles) };
};

describe('the hero tributes: campaign looks of 2-1, 3-1, 4-2, 5-4 and 6-2', () => {
  it('each restyled level and coin heaven names its look; nothing else in the campaign has one', () => {
    const looked = levelIds().filter((id) => getLevel(id).campaignLook);
    expect(looked.sort()).toEqual([...IDS].sort());
    for (const id of IDS) {
      const { theme, music } = RESTYLES[id]!;
      expect(getLevel(id).campaignLook, id).toMatchObject({ theme, music });
    }
  });

  it.each(IDS)('%s: campaign play shows the look, theme, music and decor', (id) => {
    const { theme, music } = RESTYLES[id]!;
    const [camp] = both(id);
    expect([camp.theme, camp.music]).toEqual([theme, music]);
    const look = getLevel(id).campaignLook!;
    if (look.decor) expect(camp.decor).toEqual(look.decor);
    else expect(camp.decor).toEqual(getLevel(id).decor);
  });

  it.each(IDS)(
    '%s: outside the campaign (level select, ?level=, custom) it keeps the original look',
    (id) => {
      const lvl = getLevel(id);
      expect(lvl.theme).not.toBe(RESTYLES[id]!.theme);
      expect(lvl.music).not.toBe(RESTYLES[id]!.music);
      expect(applyLook(lvl, { theme: () => false, music: () => false })).toBe(lvl);
    },
  );

  it.each(IDS)('%s: plays exactly as the classic level (tiles, zones, entities, start, clock)', (id) => {
    const [camp, classic] = both(id);
    expect(play(camp)).toEqual(play(classic));
  });

  it.each(IDS)('%s: every rule that keys off the theme answers as in the classic level', (id) => {
    const [camp, classic] = both(id);
    const a = camp.theme;
    const b = classic.theme;
    // no look is a water theme, and a level swims in its look just as it did (2-2 by its
    // `swim: true`); castle rules (Bowser, Hammer Bros' floors); the enemies' (and corpses') palette
    expect(isWaterTheme(a), 'isWaterTheme').toBe(false);
    expect(isSwimLevel(camp), 'isSwimLevel').toBe(isSwimLevel(classic));
    expect(isCastleTheme(a), 'isCastleTheme').toBe(isCastleTheme(b));
    expect(hasSolidFloors(a), 'hasSolidFloors').toBe(hasSolidFloors(b));
    expect(enemyPalette(a), 'enemyPalette').toBe(enemyPalette(b));
    // a World built from it has the same swimming line, map and spawns
    const world = (l: LevelData) =>
      new World(
        l,
        {
          assets: new AssetRegistry({ default: {} }),
          audio: NULL_AUDIO,
          assist: { ...DEFAULT_ASSIST },
          reduceFlashing: true,
        },
        newGameState(MARIO),
        {},
      );
    const wa = world(camp);
    const wb = world(classic);
    expect(wa.waterTop).toBe(wb.waterTop);
    expect(Array.from(wa.map.tiles)).toEqual(Array.from(wb.map.tiles));
    const kinds = (w: World) =>
      w.entities
        .filter((e) => !(e instanceof Decoration))
        .map((e) => `${e.constructor.name} ${e.body.x} ${e.body.y}`)
        .sort();
    expect(kinds(wa)).toEqual(kinds(wb));
  });

  it.each(IDS)('%s: the restyle music plays for every hero (a hero tune never overrides it)', (id) => {
    const [camp] = both(id);
    for (const hero of CHARACTERS) {
      expect(levelMusic(camp, hero), hero.name).toBe(RESTYLES[id]!.music);
      // even a hero with an overworld tune of his own
      expect(levelMusic(camp, { ...hero, music: 'hero-tune' }), hero.name).toBe(RESTYLES[id]!.music);
    }
    // (outside the look an overworld area still plays a hero's own tune)
    const plain = { ...getLevel('1-1') };
    expect(levelMusic(plain, { music: 'hero-tune' })).toBe('hero-tune');
  });

  it.each(IDS)('%s keeps its look after the hero is freed and whatever the file holds', (id) => {
    // campaignLevel reads only the file's map secrets; no hero or secret takes a look away
    const secrets = ['larry', 'bonus-2', 'w1-secret', 'w4-secret'];
    expect(campaignLevel(getLevel(id), undefined, secrets).theme).toBe(RESTYLES[id]!.theme);
  });

  it('bonus rooms, water areas and the other areas of these levels keep their own looks', () => {
    const own = [
      // (World 2's bonus room and the Moblin's cave take Hyrule's cave look since 0.4.24; its Top
      // Secret Area keeps its own)
      '2-top-secret',
      // (3-1's bonus room is a Metal Man-style factory since 0.4.26; the space station keeps its own)
      '3-1-station',
      // (4-2's overworld areas, the vine's warp room and the bonus room take Zebes looks since
      // 0.4.27; Samus's cavern and Larry's airship keep their own)
      '4-2-cavern',
      '4-2-airship',
      '4-2-larry',
      '5-4-crypt',
      '5-4-dungeon',
      // (6-2's coin rooms and water area take World 6 looks since 0.4.29; Ryu's dojo keeps its own)
      '6-2-dojo',
      '1-1',
    ];
    for (const id of own) {
      const l = getLevel(id);
      expect(l.campaignLook, id).toBeUndefined();
      expect(campaignLevel(l).theme, id).toBe(l.theme);
    }
  });

  it('every decor piece a look places is drawn by its theme (an own frame or an @theme redraw)', () => {
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    for (const id of IDS) {
      const camp = campaignLevel(getLevel(id));
      const sheet = assets.sheet('decor', decorPalette(camp.theme));
      for (const d of camp.decor) {
        // Link's sky palace (2-1-sky2) places pieces of its own sheet: `zelda2-sky:<frame>`.
        const own = /^(zelda2-sky):(.+)$/.exec(d.kind);
        const has = own
          ? assets.sheet(own[1] as string).frames.has(own[2] as string)
          : sheet.frames.has(`${d.kind}@${camp.theme}`) || sheet.frames.has(d.kind);
        expect(has, `${id}: ${d.kind}`).toBe(true);
      }
    }
    // the pieces 0.4.12's art made for the maps to place are placed
    const placed = new Set(IDS.flatMap((id) => campaignLevel(getLevel(id)).decor.map((d) => d.kind)));
    for (const k of ['henge', 'mm-skyline', 'brinstar-brush', 'brinstar-column', 'cv-candle', 'ng-lamp'])
      expect(placed.has(k), k).toBe(true);
    expect(Object.keys(decorDef.frames)).toEqual(expect.arrayContaining(['henge', 'cv-candle', 'ng-lamp']));
  });

  it('nothing animates: the looks are still frames (reduce flashing has nothing to calm)', () => {
    // A decor kind that animates is named for its frames (`smb3:propeller-0`); the looks place none.
    // The one other sheet a look places from is the sky palace's, whose frames are all still.
    for (const id of IDS)
      for (const d of campaignLevel(getLevel(id)).decor)
        expect(d.kind.replace(/^zelda2-sky:/, ''), `${id}: ${d.kind}`).not.toMatch(/-0$|:/);
  });

  it("5-4 and 6-2 paint their hall and skyline behind; 4-2's warp room stays bare for the anchor", () => {
    expect(hasThemeBackdrop(campaignLevel(getLevel('5-4')).theme)).toBe(true);
    expect(hasThemeBackdrop(campaignLevel(getLevel('6-2')).theme)).toBe(true);
    expect(hasThemeBackdrop(campaignLevel(getLevel('6-2-sky')).theme)).toBe(true);
    const warp = getLevel('4-2').zones.find((z) => z.kind === 'warp')!;
    expect(campaignLevel(getLevel('4-2')).decor.filter((d) => d.x >= warp.x)).toEqual([]);
  });
});
