/*
 * Where the campaign's story ends (docs/STORY.md 2.12), and where the real king is fought.
 *
 * 0.4.54: the campaign's 8-4 is a fake castle (the Plutonium Boss costume over a Piranha Plant,
 * fake no. 8). The real king, the wand breaking, the false-ending credits and the rift move to
 * Bowser's Castle (the Valley of Bowser page) in 0.4.55. Until then the ending stays at 8-4, so
 * the campaign never dead-ends: 8-4's fake is unmasked like the others, then the wand breaks and
 * the credits and the rift follow as before.
 *
 * TEMPORARY SWITCH (0.4.55, B55: flip it here, in this one place):
 *   FINALE = { castle: '8-5', bridgeRoom: <Bowser's Castle's bridge room id> }
 * Everything that belongs to the ending follows `castle`: the wand break (World.wandScene), the
 * false-ending credits (Game.showEnding), the ending's two Toad pages (castlePages). Everything
 * that belongs to the REAL king follows it too, but only once it is not a fake castle
 * (`finaleKingIsReal`): Bowser's "NO MORE STAND-INS" boast as the bridge room is entered
 * (level-beats.ts) and Toad's "THAT WAS THE REAL KING!" page. With the switch at 8-4 neither
 * plays (8-4's king is a fake), so no file uses up the boast's beat before Bowser's Castle exists.
 * Classic play never reads any of this: 8-4 is the real king and the end there, as always.
 */

/** The campaign's last castle (its main level id) and the room its king is fought in. */
export const FINALE: { readonly castle: string; readonly bridgeRoom: string } = {
  castle: '8-4',
  bridgeRoom: '8-4-end',
};

/**
 * The campaign's castles whose king is a fake in World 8 (0.4.54): SMB 8-4 (form 8, the Piranha
 * Plant). Worlds 1-7's castles are fakes by their world number (Bowser trueFormOf).
 */
export const WORLD8_FAKE_CASTLES: readonly string[] = ['8-4'];

/** Whether the finale's king is the real one (not one of the fakes). False while it is 8-4. */
export function finaleKingIsReal(): boolean {
  return !WORLD8_FAKE_CASTLES.includes(FINALE.castle);
}
