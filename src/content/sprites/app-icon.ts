/*
 * The Home Screen icon (0.4.44): original pixel art, a "?" block over a red REMIX plate on the
 * SMB sky. 24 × 24 cells; the build (tools/pwa/plugin.ts) scales it up by whole pixels into the
 * 180, 192 and 512 px PNGs, so no PNG is kept in the repository. No imports: the Vite config
 * loads this file directly.
 */

/** One colour per letter. `.` is the sky (the background fills the whole square). */
export const APP_ICON_COLOURS: Readonly<Record<string, string>> = {
  '.': '#5c94fc', // sky
  k: '#200c00', // the block's outline
  g: '#fcd860', // its lit edge
  o: '#f89c1c', // its face
  s: '#a44400', // its shaded edge and rivets
  w: '#fcfcfc', // the "?" and the REMIX letters
  d: '#7c2c00', // the "?"'s shadow
  r: '#d82800', // the REMIX plate
};

// prettier-ignore
export const APP_ICON: readonly string[] = [
  '........................',
  '.....kkkkkkkkkkkkkk.....',
  '....kggggggggggggggk....',
  '....kgoooooooooooosk....',
  '....kgosoowwwwoososk....',
  '....kgooowwddwwooosk....',
  '....kgooowwdowwdoosk....',
  '....kgooooddwwwdoosk....',
  '....kgooooowwwddoosk....',
  '....kgooooowwddooosk....',
  '....kgooooowwdoooosk....',
  '....kgooooooddoooosk....',
  '....kgooooowwooooosk....',
  '....kgosooowwdoososk....',
  '....kgooooooddoooosk....',
  '....kgsssssssssssssk....',
  '.....kkkkkkkkkkkkkk.....',
  '..rrrrrrrrrrrrrrrrrrr...',
  '.rwwrrwwwrwrrrwrwrwrwr..',
  '.rwrwrwrrrwwrwwrwrwrwr..',
  '.rwwrrwwrrwrwrwrwrrwrr..',
  '.rwrwrwrrrwrrrwrwrwrwr..',
  '.rwrwrwwwrwrrrwrwrwrwr..',
  '..rrrrrrrrrrrrrrrrrrr...',
];

/** The PNG sizes built: the iPhone's apple-touch-icon, and the manifest's two. */
export const APP_ICON_SIZES = [180, 192, 512] as const;
