import type { AudioSink } from '@engine/audio/audio-manager';

/**
 * BUG-12 (owner): the joins between the REMIX title's theme and the CLASSIC title's overworld
 * (the original's title demo plays 1-1's music). The two songs stay their own; only the joins
 * are smoothed, through the music fade (AudioManager.fadeOutMusic, crossfadeMusic), never the
 * volume or mute. Every time is in seconds.
 */
export const TITLE_MUSIC = {
  /**
   * With the smash: the REMIX theme fades out over CLASSIC's fall (original-title.ts SMASH.drop,
   * 16 frames), ending a frame before impact, so the smash lands on near-silence.
   */
  fallOut: 15 / 60,
  /** ...and the overworld starts on the impact frame, rising over this: the smash is its downbeat. */
  impactIn: 0.2,
  /** Reduce flashing (no smash): the REMIX theme fades out over this, then the overworld rises. */
  crossOut: 0.4,
  crossIn: 0.4,
  /**
   * BACK to the REMIX title (0.4.72): the overworld is cut as the way back starts, over just
   * this (no click); the REMIX theme comes in as REMIX lands in place (0.4.74), from bar 3.
   */
  shatterOut: 0.05,
} as const;

/**
 * Crossfade to `id` (out, then in); a sink without crossfades just plays it. Returns the seconds
 * until `id` starts (0: at once).
 */
export function joinMusic(audio: AudioSink, id: string, out: number, fadeIn: number): number {
  if (audio.crossfadeMusic) return audio.crossfadeMusic(id, out, fadeIn);
  audio.playMusic(id, fadeIn);
  return 0;
}
