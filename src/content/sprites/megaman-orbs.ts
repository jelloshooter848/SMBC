import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * Classic SMBC Mega Man's and Bass's death burst (G-054): the energy orbs that fly out of him
 * (MegaManBase.initiateNormalDeath's MegaManParticle). Drawn here from scratch, on the hero's own
 * palette roles (megaman.ts: 1 light armour, 2 dark armour, 4 white), so each look's orbs are in
 * its colours. `orb-0` is the full orb, `orb-1` its pulse (the pieces swap every 2 frames; held
 * on `orb-0` with Reduce flashing).
 */
export const megamanOrbsDef: SpriteDef = {
  palette: 'megaman',
  frames: {
    'orb-0': ['..2222..', '.211112.', '21144112', '21444412', '21444412', '21144112', '.211112.', '..2222..'],
    'orb-1': ['........', '..2222..', '.214412.', '.244442.', '.244442.', '.214412.', '..2222..', '........'],
  },
};
