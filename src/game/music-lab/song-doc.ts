import { compileSong, lineCol, MmlError, parseMml, type CompiledSong, type Song } from '@engine/audio/mml';

/*
 * Music Lab's song text (item 136): one document holding a song's settings and its four channels
 * in the game's own MML (engine/audio/mml.ts, parsed by the game's parser, never a second one).
 *
 *   title: My song
 *   tempo: 140
 *   loop: on
 *   pulse1:
 *     o5 l8 c d e f g4 g4
 *   pulse2: ...
 *   triangle: ...
 *   noise: ...
 *
 * A line that starts with one of those names and a colon starts that part; a channel's MML runs
 * to the next such line. Errors carry their line and column in the document.
 */

export const CHANNELS = ['pulse1', 'pulse2', 'triangle', 'noise'] as const;
export type Channel = (typeof CHANNELS)[number];
const KIND: Record<Channel, 'pulse' | 'triangle' | 'noise'> = {
  pulse1: 'pulse',
  pulse2: 'pulse',
  triangle: 'triangle',
  noise: 'noise',
};

export const MIN_TEMPO = 40;
export const MAX_TEMPO = 300;
export const DEFAULT_TEMPO = 140;

/** An error in the document: what, and where (offsets into the text; line and column 1-based). */
export interface DocError {
  message: string;
  line: number;
  col: number;
  /** The bad spot: [start, end) in the text. */
  start: number;
  end: number;
  channel?: Channel;
}

export interface SongDoc {
  title: string;
  tempo: number;
  loop: boolean;
  song: Song;
  compiled: CompiledSong;
}

export type DocResult = { ok: true; doc: SongDoc } | { ok: false; error: DocError };

const HEADER = /^([ \t]*)([A-Za-z][A-Za-z0-9]*)[ \t]*:/;
const NAMES = new Set<string>(['title', 'tempo', 'loop', ...CHANNELS]);

function error(text: string, message: string, start: number, end: number, channel?: Channel): DocError {
  const { line, col } = lineCol(text, start);
  return { message, line, col, start, end: Math.max(end, start + 1), ...(channel ? { channel } : {}) };
}

/** Parse and compile a Music Lab document; the first error found, with its position, otherwise. */
export function parseSongDoc(text: string): DocResult {
  let title = '';
  let tempo = DEFAULT_TEMPO;
  let loop = true;
  const bodies: Partial<Record<Channel, { text: string; offset: number }>> = {};
  let current: Channel | null = null;
  let offset = 0;
  for (const raw of text.split('\n')) {
    const lineStart = offset;
    offset += raw.length + 1;
    const line = raw.replace(/\r$/, '');
    const m = HEADER.exec(line);
    const name = m?.[2]?.toLowerCase();
    if (m && name && NAMES.has(name)) {
      const valueAt = lineStart + m[0].length;
      const value = line.slice(m[0].length);
      const nameAt = lineStart + (m[1] ?? '').length;
      if ((CHANNELS as readonly string[]).includes(name)) {
        const ch = name as Channel;
        if (bodies[ch])
          return { ok: false, error: error(text, `${ch} is written twice`, nameAt, nameAt + ch.length) };
        bodies[ch] = { text: value, offset: valueAt };
        current = ch;
        continue;
      }
      current = null;
      const v = value.replace(/;.*$/, '').trim();
      const vAt = valueAt + (value.length - value.trimStart().length);
      if (name === 'title') title = value.trim().slice(0, 40);
      else if (name === 'tempo') {
        const n = /^\d+$/.test(v) ? Number(v) : NaN;
        if (!(n >= MIN_TEMPO && n <= MAX_TEMPO))
          return {
            ok: false,
            error: error(text, `tempo ${MIN_TEMPO}-${MAX_TEMPO} expected`, vAt, vAt + Math.max(1, v.length)),
          };
        tempo = n;
      } else {
        const on = /^(on|yes|true)$/i.test(v);
        if (!on && !/^(off|no|false)$/i.test(v))
          return {
            ok: false,
            error: error(text, 'loop: on or off expected', vAt, vAt + Math.max(1, v.length)),
          };
        loop = on;
      }
      continue;
    }
    // A colon is never MML: an unknown `name:` line is a misspelt part, inside a channel too.
    if (m && /^[ \t]*[A-Za-z][A-Za-z0-9]*[ \t]*:/.test(line.replace(/;.*$/, ''))) {
      const at = lineStart + (m[1] ?? '').length;
      const what = `unknown part "${m[2]}:" (use title, tempo, loop, pulse1, pulse2, triangle or noise)`;
      return { ok: false, error: error(text, what, at, at + (m[2] ?? '').length) };
    }
    if (current) {
      const body = bodies[current] as { text: string; offset: number };
      // The channel's text keeps its place in the document: offsets map straight back.
      body.text += '\n' + line;
      continue;
    }
    const code = line.replace(/;.*$/, '');
    if (code.trim()) {
      const at = lineStart + (code.length - code.trimStart().length);
      const what = 'start a channel first: pulse1:, pulse2:, triangle: or noise:';
      return { ok: false, error: error(text, what, at, at + 1) };
    }
  }
  for (const ch of CHANNELS) {
    const body = bodies[ch];
    if (!body) continue;
    try {
      parseMml(body.text, KIND[ch]);
    } catch (e) {
      if (!(e instanceof MmlError)) throw e;
      const s = body.offset + e.start;
      const end = body.offset + Math.max(e.pos, e.start + 1);
      return { ok: false, error: error(text, `${ch}: ${e.reason}`, s, end, ch) };
    }
  }
  const song: Song = { id: 'music-lab', bpm: tempo, loop };
  for (const ch of CHANNELS) {
    const body = bodies[ch];
    if (body && body.text.trim()) song[ch] = body.text;
  }
  if (!CHANNELS.some((ch) => song[ch]))
    return { ok: false, error: error(text, 'no notes yet: write pulse1: and some notes', 0, 1) };
  return { ok: true, doc: { title, tempo, loop, song, compiled: compileSong(song) } };
}

/** Removes the indent every non-blank line shares, and blank lines at either end. */
function dedent(s: string): string {
  const lines = s.replace(/\r/g, '').split('\n');
  while (lines.length && !lines[0]?.trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1]?.trim()) lines.pop();
  const indent = Math.min(
    ...lines.filter((l) => l.trim()).map((l) => (/^[ \t]*/.exec(l) as RegExpExecArray)[0].length),
  );
  return lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0).trimEnd()).join('\n');
}

/** A song (one of the game's own, as an example) as a Music Lab document. */
export function songToDoc(song: Song, title = song.id): string {
  const out = [`title: ${title}`, `tempo: ${song.bpm}`, `loop: ${song.loop ? 'on' : 'off'}`];
  for (const ch of CHANNELS) {
    const body = song[ch];
    if (!body) continue;
    out.push('', `${ch}:`);
    for (const l of dedent(body).split('\n')) out.push(`  ${l}`.trimEnd());
  }
  return out.join('\n') + '\n';
}

/** `text` with its `name:` line set to `value` (added after the last settings line if missing). */
function setHeader(text: string, name: 'tempo' | 'loop' | 'title', value: string): string {
  const lines = text.split('\n');
  const re = new RegExp(`^([ \\t]*)${name}[ \\t]*:.*$`, 'i');
  const i = lines.findIndex((l) => re.test(l));
  if (i >= 0) {
    // Keep a comment written after the value.
    const comment = /;.*$/.exec(lines[i] as string)?.[0];
    lines[i] = `${name}: ${value}${comment ? ` ${comment}` : ''}`;
    return lines.join('\n');
  }
  let at = 0;
  for (let j = 0; j < lines.length; j++) {
    const m = HEADER.exec(lines[j] as string);
    const n = m?.[2]?.toLowerCase();
    if (n === 'title' || n === 'tempo' || n === 'loop') at = j + 1;
    else if (n) break;
  }
  lines.splice(at, 0, `${name}: ${value}`);
  return lines.join('\n');
}

export const setTempo = (text: string, bpm: number): string =>
  setHeader(text, 'tempo', String(Math.round(Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, bpm)))));
export const setLoop = (text: string, on: boolean): string => setHeader(text, 'loop', on ? 'on' : 'off');
export const setTitle = (text: string, title: string): string => setHeader(text, 'title', title);

/** The tempo and loop the text asks for, read even while the rest has an error. */
export function readSettings(text: string): { tempo: number; loop: boolean } {
  const t = /^[ \t]*tempo[ \t]*:[ \t]*(\d+)/im.exec(text);
  const l = /^[ \t]*loop[ \t]*:[ \t]*(\w+)/im.exec(text);
  const n = t ? Number(t[1]) : DEFAULT_TEMPO;
  return {
    tempo: n >= MIN_TEMPO && n <= MAX_TEMPO ? n : DEFAULT_TEMPO,
    loop: l ? !/^(off|no|false)$/i.test(l[1] ?? '') : true,
  };
}

/** A new song's text: an original four-bar sketch on all four channels. */
export const NEW_SONG = `title: New song
tempo: 132
loop: on

pulse1:
  @2 v11 q6 x0 o5 l8
  ; a short tune: change a note, then PLAY
  e g a g e4 d4 | c e g >c< b4 g4
  a g e d c4 e4 | d2 r2

pulse2:
  @1 v7 q5 o4 l8
  [c e g e]2 [f a >c< a]2
  [e g b g]2 [d g b g]2

triangle:
  o3 l2
  c c | f f | e e | g g

noise:
  l8 [k h s h]8
`;

/**
 * Music Lab's syntax help (item 136): each row is what to write and what it does, from the MML
 * dialect's own reference (engine/audio/mml.ts).
 */
export const SYNTAX_HELP: readonly (readonly [string, string])[] = [
  ['title: My song', 'The song’s name (optional).'],
  ['tempo: 140', `Beats per minute, ${MIN_TEMPO} to ${MAX_TEMPO}. The Tempo buttons change this line.`],
  ['loop: on', 'on: the song repeats. off: it plays once. The Loop button changes this line.'],
  ['pulse1: pulse2:', 'Two square-wave channels: melody and harmony. Their notes follow, on any lines.'],
  ['triangle:', 'The bass channel (volume and duty do nothing on it).'],
  ['noise:', 'The drum channel: k s h and n only, no pitched notes.'],
  ['c d e f g a b', 'Notes. Add + or # for sharp, - for flat: c+ e-.'],
  ['c4 c8 c16 c4.', 'A length after a note: 1 whole, 2 half, 4 quarter, 8, 16, 32, 64. A dot adds half.'],
  ['r r8', 'A rest (silence), with an optional length.'],
  ['c4^8  c4&8', 'A tie: ^ or & adds the next length to the note before.'],
  ['o4  <  >', 'Octave 0 to 8; < goes one octave down, > one up.'],
  ['l8', 'The length for notes written without one.'],
  ['v12', 'Volume 0 to 15.'],
  ['@2', 'Duty 0 to 3: the pulse channels’ tone, from thin to round.'],
  ['q6', 'Gate 1 to 8: how much of each note sounds (8 = smooth, joined notes).'],
  ['x1  x0', 'Decay on or off: each note fades out.'],
  ['p-12 c8', 'Slide: the next note glides by that many semitones.'],
  ['k s h', 'Drums on the noise channel: kick, snare, hi-hat (lengths as notes).'],
  ['n5', 'A noise sound with period 0 to 15 (noise channel).'],
  ['[c d e]3', 'Repeat what is inside [ ] 3 times (2 if no number). Repeats can nest.'],
  ['L', 'Loop point: a looping song comes back here, not to the start.'],
  ['|', 'A bar line, for reading only (ignored, as spaces and new lines are).'],
  ['; note', 'A comment, up to the end of the line.'],
];
