/*
 * Where the campaign's story ends (docs/STORY.md 2.12), and where the real king is fought.
 *
 * 0.4.54: the campaign's 8-4 is a fake castle (the Plutonium Boss costume over a Piranha Plant,
 * fake no. 8). The real king, the wand breaking, the false-ending credits and the rift move to
 * Bowser's Castle (the Valley of Bowser page) in 0.4.55. Until then the ending stays at 8-4, so
 * the campaign never dead-ends: 8-4's fake is unmasked like the others, then the wand breaks and
 * the credits and the rift follow as before.
 *
 * 0.4.55 (B55): the switch is flipped. BOWSER'S CASTLE (internal 8-5, one area) is the last
 * castle; its king's bridge starts at column 480 (`bridgeAt`), where his boast plays. 8-4 is an
 * ordinary castle in the campaign now (`endMoved`): its `next=end` exit goes back to the map like
 * any castle's, with Toad's "another castle" line, and no credits.
 * Everything that belongs to the ending follows `castle`: the wand break (World.wandScene), the
 * false-ending credits (Game.showEnding), the ending's two Toad pages (castlePages). Everything
 * that belongs to the REAL king follows it too, but only once it is not a fake castle
 * (`finaleKingIsReal`): Bowser's "NO MORE STAND-INS" boast as the bridge room is entered
 * (level-beats.ts) and Toad's "THAT WAS THE REAL KING!" page. With the switch at 8-4 neither
 * plays (8-4's king is a fake), so no file uses up the boast's beat before Bowser's Castle exists.
 * Classic play never reads any of this: 8-4 is the real king and the end there, as always.
 */

/**
 * The campaign's last castle (its main level id), the room its king is fought in, and (a room
 * that is the whole castle) the column where his bridge section starts.
 */
export const FINALE: { readonly castle: string; readonly bridgeRoom: string; readonly bridgeAt?: number } = {
  castle: '8-5',
  bridgeRoom: '8-5',
  bridgeAt: 480,
};

/**
 * Whether castle `main`'s `next=end` exit is no longer the end in the story (0.4.55: SMB 8-4,
 * since the ending moved to Bowser's Castle): it is cleared like any castle, back to the map. The
 * Lost Levels' ends and the finale itself are untouched; classic play never asks.
 */
export function endMoved(main: string): boolean {
  return main !== FINALE.castle && !main.startsWith('ll-');
}

/**
 * The campaign's castles whose king is a fake in World 8 (0.4.54): SMB 8-4 (form 8, the Piranha
 * Plant). Worlds 1-7's castles are fakes by their world number (Bowser trueFormOf).
 */
export const WORLD8_FAKE_CASTLES: readonly string[] = ['8-4'];

/** Whether the finale's king is the real one (not one of the fakes). False while it is 8-4. */
export function finaleKingIsReal(): boolean {
  return !WORLD8_FAKE_CASTLES.includes(FINALE.castle);
}
