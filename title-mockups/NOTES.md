# SMB Crossover REMIX: title-screen mockups (0.5.0 "Chapter 1")

Files (all at the game's 256x240; `*-1x.png` is the real size, the plain name is the x3 view):
`mockup-a.png`, `mockup-b.png`, `mockup-c.png`, `logo-small.png`, `overview.png` (all three side by side, x2).
They are built by `title.preview.ts` and `lib.ts` (run with `npx vitest run --config preview.config.mts` from the repo).
The script uses the repo's own sprite data and the 8x8 font. Every letter in the logos is the HUD font's glyphs scaled
up and given a bevel, an extrude and an outline, so the logo can ship as generated sprite rows (no binary assets) and
uses only characters the font has. Sophia III's sprite is read from the `wip-0.4.11-sophia-character` branch.

Text on every mockup: the menu (START GAME, CUSTOM LEVELS, OPTIONS, DEV MODE shown unlocked in grey), `V0.5.0`,
"MADE BY JELLOSHOOTER848", "BASED ON SUPER MARIO BROS. / CROSSOVER BY EXPLODING RABBIT", "UNOFFICIAL FAN PROJECT",
"CHAPTER 1". Coloured text (gold, cyan, grey) needs a few `font` palette variants. Today the font draws white only.

## A: block logo over an SMB scene

- **Look:** sky `#5c94fc`, SMB hills, clouds and ground tiles. "SMB" sits in a small red tag (`#f83800`). "CROSSOVER"
  uses the font at x3 by x4 with a banded fill (`#f8d878` > `#f8b800` > `#fca044` > `#e45c10`), a white top edge, a
  3px `#a81000` extrude and a black outline. "REMIX" is a red-on-white rubber stamp, sheared about 11 degrees, with a
  drop shadow and worn ink.
- **Heroes:** they stand in a row on the ground. Freed heroes are drawn in colour; heroes still to find are black
  silhouettes with a "?" (the mockup shows 4 of 8 freed). The row doubles as a progress display.
- **Animation:**
  - The clouds and hills scroll slowly in parallax.
  - The logo drops in letter by letter with a small bounce, like a block bump. Then the REMIX stamp slams on: one
    frame at 2x, a 2-frame screen shake and a dust puff.
  - The freed heroes walk in from the left one at a time and stop in their slots. Each one does its idle blink or
    pose now and then.
- **Music:** the current `title` fanfare, re-orchestrated. A noise-channel "record scratch" and a drum stinger play
  as the stamp lands, then a bouncier loop.

## B: SMB3-style stage

- **Look:** a black stage with a red curtain (`#a81000` and `#f83800`, `#503000` in the folds), gold tie-backs and
  fringe (`#f8b800`, `#ac7c00`), and a tan-and-brown checkered floor with footlights. The logo is printed on a cream
  ribbon banner (`#fcd8a8`). "CROSSOVER" is red with a brown extrude. "REMIX" sits on a red ribbon tag hanging under
  the banner.
- **Heroes:** they are the cast. Freed heroes stand in spotlights (dithered `#404040` cones with pools of light on
  the floor). Heroes not yet found wait in the dark as silhouettes with a grey rim.
- **Animation:**
  - The curtain rises (wipe up) as the drum roll plays, and the banner unrolls down from the valance.
  - The spotlights click on one by one, each with a hero pose. The footlights twinkle.
  - When a new hero has been freed since the last visit, their spotlight turns on as a small "debut" moment.
- **Music:** an SMB3-like drum roll and curtain fanfare, then a jaunty vaudeville loop of the title theme.

## C: the wand's rift

- **Look:** deep space (black, with a `#0000bc` nebula dither and stars). A jagged, eye-shaped tear runs across the
  top: a dark-blue swirl inside, then bands of `#9878f8`, `#d800cc` and `#3cbcfc`, a white-hot rim and magenta
  sparks outside. Larry's wand-blast sprites spark at its tips. "CROSSOVER" fades white > cyan > blue with a magenta
  extrude. "REMIX" is glitchy: cyan and magenta ghost copies offset from it, with one row shoved sideways.
- **Shards:** seven slanted shards fly out of the rift, one per hidden hero's world:
  - Zelda II ruins with Link
  - Mega Man's station with Mega Man
  - Zebes with its Chozo statue and Samus
  - the Castlevania crypt's stained glass with Simon
  - Ninja Gaiden's moon with Ryu
  - Contra's jungle with Bill
  - Blaster Master's cavern with Sophia III

  A shard whose hero is still captive is grey static with a rimmed silhouette and a "?". Mario and Luigi stand on
  blocks beside the menu, watching the rift. This direction tells the story: Bowser stole Larry's wand to pull heroes
  out of other worlds.
- **Animation:**
  - The wand bolt zaps the screen and the rift tears open from the centre outward.
  - The logo is "pulled through" the rift: it scales in at 2x, 1.5x, then 1x, with palette cycling.
  - The rim shimmers by rotating the 4 rift colours every 4 frames. This is cheap and needs no new art.
  - Each found shard flickers on in turn. Captive shards keep a rolling static band.
- **Music:** an eerie arpeggio with a pulse shimmer, plus a short quote of each hero's motif as their shard lights.
  It resolves into the title fanfare.

## Small logo "SMBC REMIX" (`logo-small.png`)

1. **2x block version:** "SMBC" with the same bevel and extrude, plus a tilted red REMIX tab. About 100x30.
2. **One-line version, 8px tall:** "SMBC" with a red REMIX box. For HUD bars, the pause screen and the page header.
3. **16x16 "S/R" mark:** a favicon idea.

Each is shown on dark and on sky backgrounds.

## Recommendation

**A as the base, with C's rift as its intro.** A is the most readable. It is unmistakably "SMB" and nods to the
original SMBC's title (an SMB scene with a big logo). Its hero row doubles as a progress display. It is also the
cheapest to build, since it reuses scene art the game already has. The REMIX stamp says "different project" at a
glance.

Then open on C's moment: the wand bolt tears a rift, and the logo and heroes drop out of it onto the SMB field. A then
gets C's story beat without C's density.

B is charming, but it is the most "SMB3 pastiche" of the three and the busiest to animate.
