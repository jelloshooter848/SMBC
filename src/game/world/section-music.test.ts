import { describe, expect, it } from 'vitest';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { NO_INPUT, type InputFrame } from '@engine/input/input-manager';
import { toPx } from '@engine/math/units';
import { getLevel } from '@content/levels';
import { songs } from '@content/music/songs';
import { DEFAULT_ASSIST, newGameState } from '../context';
import { MARIO } from '../characters/mario';
import { parseTextMap, serializeTextMap } from '../level/textmap';
import { World } from './world';

// 0.4.55: a `music x song` zone changes the level's tune once a player passes column x, in the
// campaign's story only (World.storyMode); classic and dev play keep the level's own tune. BOWSER'S
// CASTLE's bridge section (column 480) plays `bowser-king` (owner: the real king's fight).

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

/** A flat castle room 40 wide, the hero at column 4, the tune changing at column 10. */
const ROOM = (() => {
  const rows: string[] = [];
  for (let y = 0; y < 15; y++) rows.push((y >= 13 ? '#' : '.').repeat(40));
  return parseTextMap(
    [
      'id: t',
      'theme: castle',
      'music: castle',
      'start: 4,12',
      '[tiles]',
      ...rows,
      '[zones]',
      'music 10 bowser-king',
    ].join('\n'),
    't',
  );
})();

const RIGHT: InputFrame = { ...NO_INPUT, held: (a) => a === 'right', dirX: 1 };

function walk(story: boolean, frames = 200) {
  const music: string[] = [];
  const audio: AudioSink = { ...NULL_AUDIO, playMusic: (id) => void music.push(id) };
  const w = new World(
    ROOM,
    { assets: STUB_ASSETS, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true },
    newGameState(MARIO),
    {
      seed: 1,
    },
  );
  w.storyMode = story;
  w.time = null;
  for (let i = 0; i < frames; i++) w.update([RIGHT]);
  return { w, music };
}

describe('a section of a level with its own tune (`music` zone)', () => {
  it('parses and writes back', () => {
    expect(ROOM.zones).toContainEqual({ kind: 'music', x: 10, music: 'bowser-king' });
    expect(serializeTextMap(ROOM)).toContain('music 10 bowser-king');
  });

  it('in the story: the tune changes once, as the hero passes the column', () => {
    const { w, music } = walk(true);
    expect(toPx(w.player.body.x)).toBeGreaterThan(10 * 16);
    expect(music).toEqual(['bowser-king']);
    expect(w.music).toBe('bowser-king');
  });

  it('before the column, and outside the story, the level keeps its own tune', () => {
    expect(walk(true, 1).w.music).toBe('castle');
    const classic = walk(false);
    expect(classic.music).toEqual([]);
    expect(classic.w.music).toBe('castle');
  });

  it("BOWSER'S CASTLE: bowser-king from the bridge section (480), after the last checkpoint (474)", () => {
    const l = getLevel('8-5');
    expect(l.music).toBe('castle');
    expect(l.zones).toContainEqual({ kind: 'music', x: 480, music: 'bowser-king' });
    expect(songs.some((s) => s.id === 'bowser-king')).toBe(true);
    const bowser = l.entities.find((e) => e.type === 'bowser');
    expect(bowser?.x).toBeGreaterThan(480);
  });
});
