# Roadmap and ideas

This file lists what is planned next and the ideas we have agreed to keep for later. Versions are proposals:
the owner picks the version number at release time. When an idea is built, move it to CHANGELOG.md and delete it
here.

## Planned

| Order | What                                                                                                                                                 | Status                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1     | **0.4.9: Bill under 7-3** (Contra look for 7-3, the exploding bridge, the jungle camp, the Jungle Assault mini game) and the Arena airship hero pick | Built; browser QA, then the PR |
| 2     | **0.4.10: "Safety floor" dev assist**: deadly pits get an invisible floor at the pit's rim and lava turns solid (dev mode only)                      | Being built                    |
| 3     | **Level restyles**: each earlier hero's level takes on their game's look in the campaign (see below)                                                 | Next                           |
| 4     | **Mini game fidelity pass**: compare the older mini games with their real NES games, using the owner's reference screenshots                         | With the restyles              |
| 5     | **Classic SMBC rules** (the 19 reports from PR #51), plus an automated tile-by-tile check of our levels against the NES maps                         | After the restyles             |

### Level restyles (campaign only)

Each level keeps its layout, tiles and enemies exactly; only the look and music change. It uses the campaign-look
hook built for 7-3 (`campaignTheme:`, `campaignMusic:`, `[campaign-decor]` in the level's map).

| Level | Hero     | Look                   |
| ----- | -------- | ---------------------- |
| 2-1   | Link     | Zelda II               |
| 3-1   | Mega Man | Mega Man               |
| 4-2   | Samus    | Metroid                |
| 5-4   | Simon    | Castlevania            |
| 6-2   | Ryu      | Ninja Gaiden           |
| 7-3   | Bill     | Contra (done in 0.4.9) |

1-1 stays as it is, since Luigi is from Mario's own world. Two things to keep in mind:

- A theme drives some gameplay: a water theme turns on swimming, and a hero's own music only plays on the
  `overworld` theme. No restyle may use a water theme.
- Open question: once the hero is freed, does the level keep its look? The current lean is yes, because it marks
  where they were found.

## Ideas for later

These are agreed ideas, not yet scheduled.

### 1. Koopaling airships in the Lost Levels warp zones

Larry Koopa, reached through 4-2's warp zone, was the first of SMB3's seven Koopalings. The other six are Morton,
Wendy, Iggy, Roy, Lemmy and Ludwig. Each one would get an airship reached through a Lost Levels warp zone, the same
way Larry's is reached in 4-2.

- **Where:** the Lost Levels have 9 forward warp zones:
  - LL 1-2: three single-pipe warps, to worlds 2, 3 and 4;
  - LL 5-1: to world 6;
  - LL 5-2: two warps, to worlds 7 and 8;
  - LL A-2: to world B;
  - LL A-3: to world C;
  - LL B-4: to world D.

  Six of these would lead to a Koopaling. Which warp gets which Koopaling is still to be decided. The rest keep
  their NES behaviour.

- **Fights:** each Koopaling fights as in SMB3. For example:
  - Wendy throws candy rings;
  - Roy and Morton stomp and shake the ground;
  - Lemmy rides a ball;
  - Ludwig hops and fires blasts;
  - Iggy fires wand blasts.
- **Reward:** beating a Koopaling opens one of the warp hub's "???" pads, which ties this idea to the boss rush, time
  trials and gallery ideas below. It could also add an item to the SMB3 inventory.

### 2. The backward warps become a trap

Three Lost Levels warp zones send you back instead of forward. It was Nintendo's joke on players:

- LL 3-1 has two, both to world 1;
- LL 8-1 has one, to world 5.

Keep the joke, with a payoff:

- In the campaign, the backward pipe leads to a trap room instead, for example a Poison Mushroom "Toad House" or a
  reverse-gravity room.
- Getting through it gives a big reward.
- Failing it costs nothing: you go back out to the level.

### 3. Sophia III, the last original hero

The original Crossover's cast was Mario, Luigi, Link, Mega Man, Samus, Simon, Bill, Ryu and Sophia III. Sophia III,
the tank from Blaster Master, is the only one we haven't made. World 8 is also the only SMB world without a hidden
hero, so she would be hidden there.

- **A new playable hero:**
  - drives, hovers and fires the cannon;
  - Jason, the pilot, can climb out on foot to fit small gaps;
  - power-ups give hover fuel and cannon upgrades.
- **Hiding place:** her hideout is somewhere in World 8, with an entrance unlike any used so far.
- **Mini game:** in Blaster Master's style, as true to the real game as possible.
- **Size:** this is the biggest of the three ideas, because it adds a full character kit as well as the usual
  hideout, mini game, art and music.

### Uses for the warp hub's "???" pads

The warp hub has three "???" pads. Once the Koopalings open them, they could hold:

- a boss rush of every mini game boss;
- time trials on levels you have cleared;
- a hero gallery and sound test.
