# Super Mario Bros. Crossover: REMIX

## Terms

- **Campaign mode** (formerly called Current): the REMIX story game and its rules. In code the
  rules value is `'campaign'` (`Rules` in `src/game/context.ts`). Data stored before v0.4.73 may
  still say `'current'`; it is read through `readRules()` and never written again.
- **Classic mode**: the original SMBC's rules (`'classic'`), played from the title's CLASSIC menu.
- A _campaign file_ is a REMIX save file; a campaign file always plays Campaign rules.
