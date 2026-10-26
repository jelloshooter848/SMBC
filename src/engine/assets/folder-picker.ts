/**
 * Can the page pick an asset pack's folder? (0.4.73, owner item 84 choice A.)
 *
 * Importing a pack needs a folder picker (`<input type=file webkitdirectory>`, looked for on
 * HTMLInputElement's prototype). iPhone and iPad browsers (all WebKit) know the attribute but
 * their picker ignores it and only offers single files from the Files app, so feature detection
 * alone says yes there: an iOS or iPadOS device (an iPad reports itself as a Mac with touch
 * points) counts as having no folder picker.
 */
export function folderPickerSupported(
  input: object | undefined = typeof HTMLInputElement === 'undefined'
    ? undefined
    : HTMLInputElement.prototype,
  nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator,
): boolean {
  if (!input || !('webkitdirectory' in input)) return false;
  const ua = nav?.userAgent ?? '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1);
  return !ios;
}

export interface PackPickerFacts {
  /** The on-screen touch pad is up (the player is on touch). */
  touchShown: boolean;
  /** matchMedia('(pointer: coarse)'): the primary pointer is a finger. */
  coarsePointer: boolean;
  /** folderPickerSupported(). */
  folderPicker: boolean;
}

/**
 * Whether the ASSET PACKS page leaves out Import pack (folder) and Export template, by the kind
 * of device (items 84, 128; since item 141 every device has Import pack (.zip) instead of the old
 * ASSET PACKS NEED A COMPUTER): a finger for the primary pointer is a phone or tablet, Android
 * ones included (Chrome there has a folder picker, but a phone is no place to build a pack); the
 * touch pad up on a device that cannot pick a folder is one too. A touchscreen laptop (a fine
 * primary pointer and a folder picker) keeps them, and so does a desktop browser without the
 * picker (its own picker says what it can do).
 */
export function packsFolderless(f: PackPickerFacts): boolean {
  return f.coarsePointer || (f.touchShown && !f.folderPicker);
}
