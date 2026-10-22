### Added

- Classic mode: beating a map set on Hard unlocks ADVANCED CHEATS on that file only: every
  assist (no damage, safety floor, show hidden items, slow motion and the rest) for that
  cleared file's level replays. Turn them on from the file's world box or its pause menu. The
  unlock is said after the credits, and a short box explains it the first time the file is
  picked. Erasing the file clears them; no other file and never the campaign gets them.

### Fixed

- Classic mode: erasing a file that holds a game moved in from an older version no longer
  brings that game back on the next visit when the old save could not be removed before.
- Classic mode: when saves cannot be read (the browser blocks storage), the file box says
  "SAVES CAN'T BE READ RIGHT NOW" and refuses new games and erasing instead of showing every
  file as a new game, so a real file is never written over.
- Classic mode: on release builds a file whose hero is not released yet now says "This hero is
  not in this version yet. The file is kept." instead of asking to turn on dev mode.
- Dev mode: turning dev mode off in the middle of a run with an unreleased hero ends the
  current life and opens the hero select, even in Single hero; the file stays marked.
