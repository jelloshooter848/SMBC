# Coin heavens (the sky areas up the vine) stand on ground blocks; the original's floor and ledges are cloud blocks

- **Severity:** cosmetic
- **Build:** 0.4.2 (commit d448967)
- **Where:** 2-1-sky, row 13 (the floor from column 0); also 3-1-sky, 5-2-sky, 6-2-sky and the Lost
  Levels coin heavens ll-2-1-sky, ll-3-1-sky, ll-4-1-sky, ll-5-1-sky, ll-8-3-sky, ll-9-3-sky,
  ll-10-1-sky, ll-11-1-sky, ll-12-1-sky, ll-13-2-sky
- **How to get there:** `?dev=1&level=2-1-sky`, or hit the vine brick at column 83 of 2-1 and climb
- **Character and power:** any
- **Input:** any
- **Browser and device:** any

## Steps

1. Open `?dev=1&level=2-1-sky` (or climb the vine in 2-1).
2. Climb off the vine and look at the platform you land on.

## Expected

Owner's report: "On level 2-1 there is an elevated platform accessible only by taking a vine up. The
platforms in the original NES game are clouds. Ours are regular blocks. Let's fix that." Owner decision:
fix every sky area where the original uses clouds.

In the Crossover data (`levelDataSmb.xml`, `levelDataLostLevels.xml`) these areas are
`<AREA TYPE="coinHeaven">` and their floor and ledges are plain `groundNormal` tokens. The look comes
from the theme: `GameSuperMarioBros.as` `setUpLevelThemes()` gives every `LT_COIN_HEAVEN` area a
TG_COIN_HEAVEN group (normal; night in SMB1 Worlds 3 and 6; gray in Lost Levels World 9), and that
tile set draws groundNormal as the NES cloud block.

## Actual

`tools/levelgen/convert-smbc.mjs` mapped `groundNormal` to `#` (ground) in every non-castle area, and
our themes only recolour tiles, so the coin heavens drew brown overworld ground.

## How often

every time

## Notes

- 4-2's vine area (`4-2-warp`, `TYPE="platform"`) is not a coin heaven: the original skins it with
  TG_MUSHROOM_PLATFORM_ORANGE, so it keeps its ground floor.
- Collision is unchanged: the cloud block is solid like ground.

Status: fixed — the converter now emits the cloud-block tile (`O`, solid like `#`, new in the default legend) for the ground tokens of `coinHeaven` areas; the 14 sky maps were regenerated, and only their `#` cells changed to `O` (tests: `levels.test.ts` "Coin heavens stand on cloud blocks", `lost/lost-coin-heavens.test.ts`).
