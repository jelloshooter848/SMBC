import type { Sfx } from '@engine/audio/mml';
import { HERO_ITEMS } from '@game/items/catalog';

/*
 * One short pickup cue per hero item (docs/POWERUPS.md 11), `item-<id>`: each hero has one motif in
 * their own game's sound and every item ends it on its own note (the grow item on a held two-note
 * close), so the set stays small and each item still sounds like itself. All original.
 */

interface Motif {
  /** The opening, with its channel settings (duty, volume, envelope, length). */
  head: string;
  /** The octave the endings are in. */
  octave: number;
  noise?: string;
  triangle?: string;
}

const MOTIFS: Readonly<Record<string, Motif>> = {
  // Zelda II: a bright square arpeggio, a little fanfare.
  link: { head: '@2 v10 q8 x0 l32 o5 c e g o6 c', octave: 6 },
  // Mega Man: the quick get-weapon run, half duty.
  megaman: { head: '@1 v11 q7 x0 l32 o5 e g o6 c e', octave: 6 },
  // Metroid: a thin, cold rising figure over a low triangle.
  samus: { head: '@0 v9 q8 x0 l32 o4 a o5 e a', octave: 6, triangle: 'q8 l16 o3 a' },
  // Castlevania: a minor flourish.
  simon: { head: '@2 v11 q8 x0 l32 o4 g o5 d g a+', octave: 6 },
  // Ninja Gaiden: a clipped, staccato run.
  ryu: { head: '@1 v10 q5 x0 l32 o5 d f a o6 d', octave: 6 },
  // Contra: a punchy octave jump with a snare hit.
  bill: { head: '@1 v12 q8 x0 l32 o4 c o5 c o4 g o5 c', octave: 6, noise: 'v8 x1 l32 n4' },
  // Blaster Master: a buzzy rise.
  sophia: { head: '@3 v9 q8 x0 l32 o5 c g o6 c', octave: 6 },
};

/** Endings, one per item in catalog order (the grow item is first). */
const ENDINGS = ['e16 g8', 'd16', 'e16', 'f16', 'g16', 'a16', 'b16', 'c16', 'd8', 'e8'];

function cue(index: number, m: Motif): Omit<Sfx, 'id'> {
  const ending = ENDINGS[index % ENDINGS.length] as string;
  const octave = index >= 7 ? m.octave + 1 : m.octave;
  const out: Omit<Sfx, 'id'> = { pulse: `${m.head} o${octave} ${ending}` };
  if (m.noise) out.noise = m.noise;
  if (m.triangle) out.triangle = m.triangle;
  return out;
}

export const heroItemSfx: Sfx[] = Object.entries(MOTIFS).flatMap(([hero, m]) =>
  (HERO_ITEMS[hero]?.items ?? []).map((item, i) => ({ id: `item-${item.id}`, ...cue(i, m) })),
);
