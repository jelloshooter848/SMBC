import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '@content/levels';
import { px } from '@engine/math/units';
import { songs } from '@content/music/songs';
import { sfx } from '@content/sfx/sfx';
import { defaultSettings, type Settings } from '@engine/save/settings';
import { normaliseClassic, defaultClassicSettings } from '@engine/save/original-options';
import type { AudioSink } from '@engine/audio/audio-manager';
import { CHARACTERS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { LINK } from '@game/characters/link';
import { MARIO } from '@game/characters/mario';
import { SIMON } from '@game/characters/simon';
import { SAMUS } from '@game/characters/samus';
import {
  CLASSIC_HERO_SOUNDS,
  heroSound,
  landSound,
  pickupSound,
  quietLanding,
} from '@game/characters/classic/sounds';
import type { Player } from '@game/entities/player';
import type { World } from '@game/world/world';
import { Bowser } from '@game/entities/enemies/bowser';
import { CharacterSelectScene } from '@game/scenes/character-select';
import { LevelScene } from '@game/scenes/level';
import {
  areaType,
  finalBossWorld,
  HERO_SETS,
  heroSet,
  musicFor,
  MUSIC_TYPES,
  SMB_SET,
  type MusicMoment,
} from '@game/scenes/original-music';
import { MUSIC_SET_ROW } from '@game/scenes/original-options';
import { makeGame, useStorage, type H } from './heroes-harness';

// Classic audio (0.5.0, GAP_LIST_0.5.0 G-060 to G-066, G-070 to G-074): per-hero music sets of our
// own songs with the SMB set as fallback, the Music set option, the select music and the choose
// jingle, the intro and coin heaven tunes, the boss trigger, and the heroes' own sounds. All of it
// Classic mode only; the campaign's music is untouched.

useStorage();

const SONG_IDS = new Set(songs.map((s) => s.id));
const SFX_IDS = new Set(sfx.map((s) => s.id));
const level = (id: string) => getLevel(id);
const moment = (o: Partial<MusicMoment>): MusicMoment => ({
  hero: 'mario',
  level: null,
  boss: false,
  set: 'character',
  ...o,
});

/** A game whose audio logs what plays, through Game.classicMusic as the real AudioManager does. */
function audioGame(
  over: Partial<Settings> = {},
): H & { music: string[]; jingles: string[]; sounds: string[] } {
  const settings = { ...defaultSettings(), ...over };
  const h = makeGame({ deps: { settings, applySettings: () => {} } });
  const music: string[] = [];
  const jingles: string[] = [];
  const sounds: string[] = [];
  const a = h.audio as unknown as AudioSink;
  a.playMusic = vi.fn((id: string) => void music.push(h.game.classicMusic(id) ?? '(none)'));
  a.playJingle = vi.fn((id: string, onEnd?: () => void) => {
    jingles.push(h.game.classicMusic(id) ?? '(none)');
    onEnd?.();
  });
  a.sfx = vi.fn((id: string) => void sounds.push(id));
  a.stopMusic = vi.fn(() => void music.push('(stop)'));
  return { ...h, music, jingles, sounds };
}

afterEach(() => vi.restoreAllMocks());

describe('G-060: per-hero music sets', () => {
  it('every song a set names is one of ours, and every set type is a music type', () => {
    for (const id of Object.values(SMB_SET)) expect(SONG_IDS.has(id), id).toBe(true);
    for (const [hero, set] of Object.entries(HERO_SETS))
      for (const [type, id] of Object.entries(set)) {
        expect(MUSIC_TYPES as readonly string[], `${hero} ${type}`).toContain(type);
        if (id) expect(SONG_IDS.has(id), `${hero} ${type}: ${id}`).toBe(true);
      }
  });

  it('each hero set has its own overworld theme (the priority), the SMB heroes none', () => {
    for (const id of ['link', 'megaman', 'bass', 'protoman', 'samus', 'simon', 'ryu', 'bill', 'sophia'])
      expect(heroSet(id)?.overworld, id).toBeTruthy();
    for (const id of ['mario', 'luigi', 'peach', 'pit', 'vicviper', 'yoshi']) expect(heroSet(id)).toBeNull();
  });

  it("a level plays the hero's song for its area type, and a type the hero lacks falls back to SMB's", () => {
    const at = (hero: string, id: string, asked = level(id).music) =>
      musicFor(asked, moment({ hero, level: level(id) }));
    expect(at('link', '1-1')).toBe('zelda2-field');
    expect(at('link', '1-2')).toBe('zelda2-cave');
    expect(at('link', '1-1-bonus')).toBe('dungeon');
    expect(at('link', '2-2')).toBe('zelda2-water');
    expect(at('link', '1-4')).toBe('zelda2-palace');
    expect(at('megaman', '1-3')).toBe('mm-air'); // a platform area
    expect(at('simon', '2-3')).toBe('cv-lake'); // a Cheep Cheep area
    expect(at('bill', '1-1')).toBe('contra-stage');
    expect(at('ryu', '1-1')).toBe('ng-stage');
    expect(at('sophia', '1-1')).toBe('bm-area');
    expect(at('samus', '1-1')).toBe('brinstar');
    // Samus has no water song yet: SMB's.
    expect(at('samus', '2-2')).toBe('water');
    // Mario plays the SMB set as before.
    expect(at('mario', '1-1')).toBe('overworld');
    expect(at('mario', '1-2')).toBe('underground');
    // The events: Star, level clear, castle clear; Link has no Star tune: SMB's.
    expect(musicFor('star', moment({ hero: 'link' }))).toBe('star');
    expect(musicFor('level-clear', moment({ hero: 'link' }))).toBe('link-win');
    expect(musicFor('castle-clear', moment({ hero: 'link' }))).toBe('triforce-get');
    expect(musicFor('castle-clear', moment({ hero: 'ryu' }))).toBe('castle-clear');
    // Song ids that are no music type pass through.
    expect(musicFor('title', moment({ hero: 'link' }))).toBe('title');
  });

  it('the area types follow the original levels (levelData*.xml TYPE)', () => {
    const t = (id: string) => areaType(level(id));
    expect(t('1-1')).toBe('overworld');
    expect(t('1-2-intro')).toBe('intro');
    expect(t('1-2')).toBe('underground');
    expect(t('1-1-bonus')).toBe('bonus');
    expect(t('1-3')).toBe('platform');
    expect(t('2-3')).toBe('cheep');
    expect(t('2-1-sky')).toBe('coin-heaven');
    expect(t('2-2')).toBe('water');
    expect(t('8-4')).toBe('castle');
    expect(t('ll-8-3')).toBe('platform');
    expect(t('ll-12-2')).toBe('cheep');
    expect(t('ll-2-1-sky')).toBe('coin-heaven');
  });

  it('the campaign and every run outside Classic mode play every song as asked', () => {
    const h = audioGame();
    h.game.newGame(LINK, '1-1');
    h.until(() => h.top() instanceof LevelScene, 600);
    expect(h.game.classicRun).toBe(false);
    for (const id of ['overworld', 'castle', 'star', 'death', 'level-clear', 'smb-select'])
      expect(h.game.classicMusic(id)).toBe(id);
    expect(h.music.at(-1)).toBe('overworld');
  });

  it("a Classic run plays the playing hero's set (Link in 1-1)", () => {
    const h = audioGame();
    h.game.devClassicGame(LINK, '1-1', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    expect(h.music.at(-1)).toBe('zelda2-field');
    expect(h.game.classicMusic('star')).toBe('star');
    expect(h.game.classicMusic('level-clear')).toBe('link-win');
  });
});

describe('G-066: the Music set option', () => {
  it('defaults to Character (the original default) and keeps a stored value only when known', () => {
    expect(defaultClassicSettings().musicSet).toBe('character');
    expect(normaliseClassic({ musicSet: 'map' }).musicSet).toBe('map');
    expect(normaliseClassic({ musicSet: 'mega' }).musicSet).toBe('character');
    expect(MUSIC_SET_ROW.values).toEqual(['character', 'map', 'random']);
  });

  it('Map plays the SMB set for every hero; the choose jingle and the death music stay the hero’s', () => {
    const m = moment({ hero: 'simon', level: level('1-1'), set: 'map' });
    expect(musicFor('overworld', m)).toBe('overworld');
    expect(musicFor('death', m)).toBe('cv-die');
  });

  it('Random picks Character or Map once for each area', () => {
    const classic = { ...defaultClassicSettings(), musicSet: 'random' as const };
    const h = audioGame({ classic });
    const roll = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    h.game.devClassicGame(LINK, '1-1', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    expect(h.music.at(-1)).toBe('zelda2-field');
    roll.mockReturnValue(0.1);
    // Same area: the roll holds.
    expect(h.game.classicMusic('overworld')).toBe('zelda2-field');
  });
});

describe('G-061, G-062: select music and the choose jingle', () => {
  it("Classic mode's select plays the select tune and the pick plays the hero's choose jingle", () => {
    const h = audioGame();
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    expect(h.top()).toBeInstanceOf(CharacterSelectScene);
    expect(h.music.at(-1)).toBe('smb-select');
    h.idle(12);
    for (let i = 0; i <= 40 && h.said.at(-1)?.split(', ')[0] !== 'Link'; i++) h.tap('right');
    h.tap('jump');
    // G-050, G-055 (0.5.0): Link's looks open first (OK keeps his own); the jingle starts with
    // his pick performance.
    if ((h.top() as CharacterSelectScene).pickerOpen) h.tap('jump');
    expect(h.jingles).toContain('link-choose');
    h.until(() => !(h.top() as CharacterSelectScene).performing, 300);
  });

  /** Classic mode's first select, then OK on hero `name`. */
  const pickOn = (name: string) => {
    const h = audioGame();
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    h.idle(12);
    for (let i = 0; i <= 40 && h.said.at(-1)?.split(', ')[0] !== name; i++) h.tap('right');
    h.tap('jump');
    // A hero with other looks (Mega Man: Proto Man) opens the look menu first: OK takes the
    // highlighted (own) look, and only that is the pick.
    if (h.said.at(-1)?.startsWith('Choose a look')) {
      expect(h.jingles).toEqual([]);
      h.tap('jump');
    }
    // G-055 (0.5.0): the pick performance plays out.
    h.until(
      () => !(h.top() instanceof CharacterSelectScene) || !(h.top() as CharacterSelectScene).performing,
      300,
    );
    return h;
  };

  it("Mega Man's pick teleports out with his jingle; Bill's shocks him; Mario's plays the SMB transition", () => {
    const mm = pickOn('Mega Man');
    expect(mm.jingles.at(-1)).toBe('mm-choose');
    expect(mm.sounds).toContain('mm-teleport');
    // Bill is electrocuted as he is chosen (G-070; Bill.as chooseCharacter).
    const bill = pickOn('Bill');
    expect(bill.jingles.at(-1)).toBe('contra-card');
    expect(bill.sounds).toContain('bill-shock');
    expect(pickOn('Mario').jingles.at(-1)).toBe('smb-transition');
  });

  it('BACK from the select stops its music and plays no choose jingle (or teleport) over the CLASSIC menu', () => {
    const h = audioGame();
    h.game.showClassicMenu();
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    h.idle(12);
    for (let i = 0; i <= 40 && h.said.at(-1)?.split(', ')[0] !== 'Mega Man'; i++) h.tap('right');
    h.tap('attack');
    h.idle(4);
    expect(h.top()).not.toBeInstanceOf(CharacterSelectScene);
    expect(h.jingles).toEqual([]);
    expect(h.sounds).not.toContain('mm-teleport');
    // The select tune stopped, and nothing started after it but the CLASSIC title's own 1-1 tune
    // (O-04: its demo is a real 1-1, as TitleLevel is, whose music starts with it).
    const at = h.music.lastIndexOf('smb-select');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(h.music.slice(at + 1)).toContain('(stop)');
    expect(h.music.slice(at + 1).filter((x) => x !== '(stop)')).toEqual(['overworld']);
  });

  it('a select outside Classic mode stays silent as before', () => {
    const h = audioGame();
    h.game.selectEntered(false);
    h.game.selectLeft(false);
    expect(h.music).toEqual([]);
    expect(h.jingles).toEqual([]);
  });
});

describe('G-063: intro and coin heaven tunes', () => {
  it('the x-2 walk-in plays the transition tune and coin heaven the Star tune (SMB set)', () => {
    expect(musicFor('overworld', moment({ level: level('1-2-intro') }))).toBe('smb-transition');
    expect(musicFor('overworld', moment({ level: level('2-1-sky') }))).toBe('star');
    expect(musicFor('overworld', moment({ hero: 'simon', level: level('2-1-sky') }))).toBe('cv-town');
  });
});

describe('G-064: the boss trigger', () => {
  it('Bowser on screen switches the castle tune to the boss tune, the final boss in world 8', () => {
    expect(musicFor('castle', moment({ hero: 'simon', level: level('1-4'), boss: true }))).toBe('cv-boss');
    expect(musicFor('castle', moment({ hero: 'simon', level: level('8-4'), boss: true }))).toBe('cv-beast');
    expect(finalBossWorld(level('ll-13-4'))).toBe(true);
    expect(finalBossWorld(level('ll-8-4'))).toBe(false);
    // SMB maps both to the castle tune.
    expect(musicFor('castle', moment({ level: level('1-4'), boss: true }))).toBe('castle');
  });

  it('in a Classic run the boss tune starts when Bowser comes on screen', () => {
    const h = audioGame();
    h.game.devClassicGame(SIMON, '1-4', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    const scene = h.top() as LevelScene;
    expect(h.music.at(-1)).toBe('cv-hall');
    const w = scene.world;
    expect(scene.bossMusic).toBe(false);
    // Bowser wakes as the screen nears him: walk the camera there.
    const spot = scene.level.entities.find((s) => s.type === 'bowser');
    expect(spot).toBeTruthy();
    const bx = px((spot?.x ?? 0) * 16);
    w.player.body.x = bx - px(120);
    for (let i = 0; i < 60 && !w.entities.some((e) => e instanceof Bowser); i++) {
      w.camera.x = bx - px(200);
      h.idle(1);
    }
    h.idle(2);
    expect(scene.bossMusic).toBe(true);
    expect(h.music.at(-1)).toBe('cv-boss');
  });
});

describe('G-065: hero death music and sounds', () => {
  it('Link, Mega Man, Bass, Bill and Sophia III die to their own sound; Simon and Ryu to their music', () => {
    for (const [id, sound] of [
      ['link', 'link-death'],
      ['megaman', 'mm-death'],
      ['bass', 'mm-death'],
      ['bill', 'contra-death'],
      ['sophia', 'sophia-die'],
    ] as const)
      expect(heroSound({ id }, 'death'), id).toBe(sound);
    expect(heroSound({ id: 'simon' }, 'death')).toBeUndefined();
    for (const id of ['link-death', 'mm-death', 'contra-death', 'sophia-die'])
      expect(SFX_IDS.has(id)).toBe(true);
    expect(musicFor('death', moment({ hero: 'simon' }))).toBe('cv-die');
    expect(musicFor('death', moment({ hero: 'ryu' }))).toBe('ng-die');
    expect(musicFor('death', moment({ hero: 'mario' }))).toBe('death');
  });

  it("a Classic Link's death stops the music and plays his sound, not Mario's jingle", () => {
    const h = audioGame();
    h.game.devClassicGame(LINK, '1-1', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    w.kill(w.player);
    expect(h.sounds).toContain('link-death');
    expect(h.jingles).not.toContain('death');
  });
});

describe('G-070 to G-074: the heroes’ own sounds', () => {
  it('every sound named is one of ours', () => {
    for (const [hero, s] of Object.entries(CLASSIC_HERO_SOUNDS)) {
      for (const id of [s.hurt, s.hit, s.kill, ...Object.values(s.pickups ?? {})])
        if (id) expect(SFX_IDS.has(id), `${hero}: ${id}`).toBe(true);
    }
    for (const id of [
      'mm-land',
      'mm-teleport',
      'samus-land',
      'morph-ball',
      'screw-attack',
      'bill-land',
      'bill-shock',
      'link-arrow',
      'link-bomb-set',
      'samus-bomb-set',
      'samus-beam',
      'samus-long-beam',
      'samus-ice-beam',
      'samus-wave-beam',
      'cv-dagger',
      'cv-axe',
      'cv-cross',
      'cv-holy-water',
      'ng-star',
      'ng-windmill',
      'ng-fire',
      'mm-blade',
      'bill-shot',
      'bill-flame',
    ])
      expect(SFX_IDS.has(id), id).toBe(true);
  });

  it('hurt, hit, kill and pickup sounds by hero, with the shared ones for the rest (G-071 to G-073)', () => {
    expect(heroSound({ id: 'link' }, 'hurt', 'pipe')).toBe('link-hurt');
    expect(heroSound({ id: 'bass' }, 'hurt', 'pipe')).toBe('mm-hurt');
    expect(heroSound({ id: 'bill' }, 'hurt', 'pipe')).toBe('bill-shock');
    expect(heroSound({ id: 'mario' }, 'hurt', 'pipe')).toBe('pipe');
    expect(heroSound({ id: 'simon' }, 'hit', 'hurt-enemy')).toBe('cv-hit');
    expect(heroSound({ id: 'mario' }, 'kill')).toBeUndefined();
    expect(pickupSound({ id: 'link' }, 'heart-small')).toBe('link-heart');
    expect(pickupSound({ id: 'samus' }, 'missile-pack')).toBe('samus-missile-get');
    expect(pickupSound({ id: 'ryu' }, 'ninpo-large')).toBe('ng-pickup');
    expect(pickupSound({ id: 'mario' }, 'heart-small')).toBe('pickup');
  });

  it('a Classic hero taking a hit plays its own hurt sound (G-071)', () => {
    const h = audioGame();
    h.game.devClassicGame(LINK, '1-1', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    w.player.powerState = 'big';
    w.hurtPlayer(w.player, 1);
    expect(h.sounds).toContain('link-hurt');
    expect(h.sounds).not.toContain('pipe');
  });

  it('Mega Man lands with his own sound (G-070)', () => {
    const h = audioGame();
    h.game.devClassicGame(CHARACTERS.find((c) => c.id === 'megaman') as CharacterDef, '1-1', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    h.idle(10);
    h.sounds.length = 0;
    w.player.body.y -= px(32);
    w.player.body.onGround = false;
    h.until(() => w.player.body.onGround, 120);
    h.idle(2);
    expect(h.sounds).toContain('mm-land');
  });

  it('no landing sound down the flagpole or onto a springboard (G-070; Samus.as 524, Bill.as 927)', () => {
    const sounds: string[] = [];
    const world = (clearPhase: string | null, spring: boolean) =>
      ({
        clearPhase,
        onSpring: () => spring,
        audio: { sfx: (id: string) => sounds.push(id) },
      }) as unknown as World;
    const land = (w: World) => {
      const p = { body: { onGround: false }, scratch: {} } as unknown as Player;
      landSound(p, w, 'bill-land');
      p.body.onGround = true;
      landSound(p, w, 'bill-land');
    };
    land(world('slide', false));
    land(world(null, true));
    expect(sounds).toEqual([]);
    land(world(null, false));
    expect(sounds).toEqual(['bill-land']);
    expect(quietLanding({} as Player, world('hop', false))).toBe(true);
  });

  it("Samus's footsteps are muted in the walk-in to a pipe (G-070; Samus.as 1404)", () => {
    const h = audioGame();
    h.game.devClassicGame(SAMUS, '1-2-intro', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    expect(w.autoWalk).toBe(true);
    h.sounds.length = 0;
    const x0 = w.player.body.x;
    for (let i = 0; i < 40 && h.top() instanceof LevelScene && (h.top() as LevelScene).world === w; i++)
      h.step();
    // She walked (the walk-in moves her right), in silence.
    expect(w.player.body.x).toBeGreaterThan(x0);
    expect(h.sounds).not.toContain('samus-step');
  });

  it('Classic mode under Campaign rules: the hero music, hit and death sounds still play (G-060, G-065, G-072)', () => {
    const h = audioGame({ classicRules: 'current' });
    h.game.devClassicGame(LINK, '1-1', 'current');
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    expect(w.rules).toBe('current');
    expect(h.music.at(-1)).toBe('zelda2-field');
    expect(w.hitSound({ kind: 'sword', amount: 1, owner: w.player, dirX: 1 })).toBe('link-hit');
    w.kill(w.player);
    expect(h.sounds).toContain('link-death');
    expect(h.jingles).not.toContain('death');
    // Music set Map: the SMB set, under Current rules too.
    const classic = { ...defaultClassicSettings(), musicSet: 'map' as const };
    const m = audioGame({ classicRules: 'current', classic });
    m.game.devClassicGame(LINK, '1-1', 'current');
    m.until(() => m.top() instanceof LevelScene, 600);
    expect(m.music.at(-1)).toBe('overworld');
  });

  it('Classic rules outside Classic mode (dev free play): the shared hit and death sounds', () => {
    const h = audioGame();
    h.game.newGame(LINK, '1-1', null, { rules: 'classic' });
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    expect(w.rules).toBe('classic');
    expect(w.hitSound({ kind: 'sword', amount: 1, owner: w.player, dirX: 1 })).toBe('hurt-enemy');
    w.kill(w.player);
    expect(h.jingles).toContain('death');
    expect(h.sounds).not.toContain('link-death');
  });

  it('Samus walks with footsteps every 150 ms (G-070; Samus.as STEP_TMR)', () => {
    const h = audioGame();
    h.game.devClassicGame(SAMUS, '1-1', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    h.idle(10);
    h.sounds.length = 0;
    for (let i = 0; i < 9 * 4; i++) h.step(['right']);
    const steps = h.sounds.filter((x) => x === 'samus-step').length;
    expect(steps).toBeGreaterThanOrEqual(3);
    expect(steps).toBeLessThanOrEqual(4);
    h.sounds.length = 0;
    h.idle(20);
    expect(h.sounds).not.toContain('samus-step');
  });

  it("each hero's default pickup sound: Samus's energy, Simon's sub-weapon, Bill's item (G-073)", () => {
    expect(pickupSound({ id: 'samus' }, 'heart-small')).toBe('samus-energy');
    expect(pickupSound({ id: 'simon' }, 'bomb')).toBe('cv-weapon');
    expect(pickupSound({ id: 'simon' }, 'heart-large')).toBe('cv-heart');
    expect(pickupSound({ id: 'bill' }, 'bomb')).toBe('bill-item');
    expect(pickupSound({ id: 'link' }, 'ninpo-small')).toBe('link-item');
    for (const id of ['samus-energy', 'cv-weapon', 'bill-item', 'mm-1up', 'samus-step'])
      expect(SFX_IDS.has(id), id).toBe(true);
  });

  it("Mega Man's 1-up mushroom plays his new-life sound in place of the 1-up's (G-073)", () => {
    const h = audioGame();
    h.game.devClassicGame(CHARACTERS.find((c) => c.id === 'megaman') as CharacterDef, '1-1', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    h.sounds.length = 0;
    w.player.def.behaviour.onPowerUp?.(w.player, '1up', w);
    expect(h.sounds).toContain('mm-1up');
    expect(h.sounds).not.toContain('1up');
    // Mario's stays the 1-up's.
    const m = audioGame();
    m.game.devClassicGame(MARIO, '1-1', 'classic');
    m.until(() => m.top() instanceof LevelScene, 600);
    const mw = (m.top() as LevelScene).world;
    mw.player.def.behaviour.onPowerUp?.(mw.player, '1up', mw);
    expect(m.sounds).toContain('1up');
  });

  it("a blast's hit makes the hero's own hit sound, and the hit source is left as it was (G-072)", () => {
    const h = audioGame();
    h.game.devClassicGame(SIMON, '1-1', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    const src = { kind: 'bomb' as const, amount: 1, owner: w.player, dirX: 1 as const };
    expect(w.hitSound(src)).toBe('cv-hit');
    expect(src).toEqual({ kind: 'bomb', amount: 1, owner: w.player, dirX: 1 });
    // Mario's (no sound of his own): the shared one.
    const m = audioGame();
    m.game.devClassicGame(MARIO, '1-1', 'classic');
    m.until(() => m.top() instanceof LevelScene, 600);
    const mw = (m.top() as LevelScene).world;
    expect(mw.hitSound({ kind: 'bomb', amount: 1, owner: mw.player, dirX: 1 })).toBe('hurt-enemy');
  });

  it('the campaign keeps the shared hit sound for every hero', () => {
    const h = audioGame();
    h.game.newGame(SIMON, '1-1');
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    expect(w.hitSound({ kind: 'bomb', amount: 1, owner: w.player, dirX: 1 })).toBe('hurt-enemy');
  });

  it('Samus lands, curls into the morph ball and spins the Screw Attack with her own sounds (G-070)', () => {
    const h = audioGame();
    h.game.devClassicGame(SAMUS, '1-1', 'classic');
    h.until(() => h.top() instanceof LevelScene, 600);
    const w = (h.top() as LevelScene).world;
    h.idle(10);
    h.sounds.length = 0;
    // A running jump with the Flower: the somersault brings the Screw Attack; then the landing.
    w.player.powerState = 'fire';
    for (let i = 0; i < 8; i++) h.step(['right']);
    for (let i = 0; i < 30; i++) h.step(['right', 'jump']);
    h.until(() => w.player.body.onGround, 200);
    h.idle(2);
    expect(h.sounds).toContain('screw-attack');
    expect(h.sounds.filter((s) => s === 'screw-attack')).toHaveLength(1);
    expect(h.sounds).toContain('samus-land');
    // Down crouches, Down again curls up.
    h.tap('down');
    h.idle(4);
    h.tap('down');
    h.idle(2);
    expect(h.sounds).toContain('morph-ball');
  });
});
