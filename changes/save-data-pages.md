### Changed

- Options → Save data has three rows: Back up on device (Export backup and Import backup), Back
  up online (web version only) and Reset game (Erase all data, renamed). The note drawn under the
  rows is gone; it is still said.
- Back up online opens, the first time on a device (and again after a reset), with a note that
  online backup is an experimental save feature, that saves may be lost, and that a backup on
  the device is the safest way to keep your game.
- Show my code is now Show most recent code. Delete online copy is now Delete most recent code:
  it also forgets the code on this device, so the next online backup makes a new one.
- The backup code card shows only the servers line, a blank line and the code, drawn in its own
  colour, which follows the colour-blind and high-contrast palettes.
- Reset game never deletes the online backup (the "Also delete your online backup?" question is
  gone). When a backup is online, its code is shown first, with Copy code, in the offline copy too.
- Reset game and Import backup keep this device's record of the Home Screen notes it has
  shown, so they do not come back after a reset, and a backup from another device does not
  change it.

### Fixed

- Online backup tries to load again after a failed load, instead of failing until the page is
  reloaded; after two failures in a row it says to reload the page.
- Importing an older backup file with this device's own online code no longer makes the code
  look as if it had never been backed up online.
- A first online backup that failed no longer says "Nothing changed", and its code no longer
  counts as an online copy (no Show or Delete row, no code shown before a reset) until a backup
  with it works.
- A backup code brought by an imported file is stored in its standard form.
