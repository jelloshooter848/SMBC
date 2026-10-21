# Exceptions to the original-art rule

The project's rule is that every sprite, tile and sound is our own work, stored as text: pixel
arrays in `src/content/sprites` and MML in `src/content/music`. Nothing ripped from another game
is used, and `pnpm check:assets` refuses binary art and audio in the repository.

There is **one** named exception. It is not a precedent: every other original-asset rule is
unchanged, and no other art, music or sound from the original game, or from Nintendo, Capcom,
Konami or anyone else, may be taken.

## The Exploding Rabbit logo (Classic mode's full power-up)

> Exploding Rabbit logo © Jay Pavlina / Exploding Rabbit, used as a tribute in Classic mode; will
> be replaced on request.

- **What it is.** Super Mario Bros. Special's one full power-up, `pickups/ExplodingRabbitPowerup.as`
  in the original Super Mario Bros. Crossover. It is drawn as the original's Exploding Rabbit logo.
- **Where it comes from.** The SMB map skin's sheet (`BmdInfo_Map000`, rectangle
  `ar(324,194,67,16)` in `GraphicsManager.as`): four 16x16 frames, copied pixel for pixel and in
  their colours.
- **How it is stored.** As text pixel arrays in `src/content/sprites/rabbit-logo.ts`. No image file
  is in the repository.
- **Where it shows.** Classic mode (Classic rules) only. Under Current rules the item keeps our own
  drawing, the Fire Flower's.
- **Who decided.** The owner, in 0.5.0, accepting the risk. If Jay Pavlina or Exploding Rabbit
  object, the sprite will be replaced with our own drawing.
- **Credit.** The same line is in the in-game credits (`CREDITS_RABBIT_LOGO` in
  `src/game/scenes/credits.ts`), in the README, and in `tools/check-no-binaries.mjs`.
