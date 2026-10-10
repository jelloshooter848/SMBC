import { describe, expect, it } from 'vitest';
import type { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO, type AudioSink } from '@engine/audio/audio-manager';
import { NO_INPUT } from '@engine/input/input-manager';
import { getLevel } from '@content/levels';
import { DEFAULT_ASSIST, newGameState } from '../context';
import { MARIO } from '../characters/mario';
import { World } from '../world/world';
import { coinText, gainCoins, WALLET_MAX, WALLET_NAME } from './wallet';
import {
  migrateSave,
  migrateV3toV4,
  newSave,
  SAVE_MIGRATIONS,
  SAVE_VERSION,
  saveFromState,
  stateFromSave,
} from '../save/save-files';
import { CHARACTERS } from '../characters/registry';

// The Wallet (owner addendum to the approved village design, 0.4.42): a villager's free gift on
// the first visit to Kakariko. Without it, SMB's rule (100 coins make a life and the count goes
// back to 0); with it, coins add up to 999 and there is no automatic 1-up. Classic play keeps
// SMB's coins exactly.

const STUB_ASSETS = {
  sheet: () => ({ id: 'stub', image: null, frames: new Map() }),
  has: () => false,
} as unknown as AssetRegistry;

function world(wallet: boolean, coins: number) {
  const sfx: string[] = [];
  const audio: AudioSink = { ...NULL_AUDIO, sfx: (id) => void sfx.push(id) };
  const state = newGameState(MARIO);
  state.wallet = wallet;
  state.coins = coins;
  const ctx = { assets: STUB_ASSETS, audio, assist: { ...DEFAULT_ASSIST }, reduceFlashing: true };
  const w = new World(getLevel('1-1'), ctx, state, { seed: 1 });
  w.update([NO_INPUT]);
  return { w, state, sfx };
}

describe('coins and the Wallet', () => {
  it('has an original name in the style of Zelda wallets', () => {
    expect(WALLET_NAME).toBe("TRAVELER'S WALLET");
  });

  it('without the Wallet (and in classic play): 100 coins make a life and the count goes back to 0', () => {
    const { w, state, sfx } = world(false, 99);
    expect(newGameState(MARIO).wallet).toBe(false);
    w.addCoin();
    expect(state.coins).toBe(0);
    expect(state.lives).toBe(4);
    expect(sfx).toContain('1up');
    const s = { coins: 95, wallet: false };
    expect(gainCoins(s, 10)).toBe(1);
    expect(s.coins).toBe(5);
    expect(gainCoins(s, 250)).toBe(2);
    expect(s.coins).toBe(55);
  });

  it('with the Wallet: coins go past 100 with no 1-up, and stop at 999', () => {
    const { w, state, sfx } = world(true, 99);
    w.addCoin();
    expect(state.coins).toBe(100);
    expect(state.lives).toBe(3);
    expect(sfx).not.toContain('1up');
    state.coins = 998;
    w.addCoin();
    w.addCoin();
    expect(state.coins).toBe(WALLET_MAX);
    expect(WALLET_MAX).toBe(999);
    const s = { coins: 990, wallet: true };
    expect(gainCoins(s, 50)).toBe(0);
    expect(s.coins).toBe(999);
  });

  it('the HUD shows 3 digits with the Wallet, 2 without', () => {
    expect(coinText({ coins: 7, wallet: false })).toBe('07');
    expect(coinText({ coins: 7, wallet: true })).toBe('007');
    expect(coinText({ coins: 512, wallet: true })).toBe('512');
  });
});

describe('the save: one flag, "has the Wallet"', () => {
  it('a new file has no Wallet; the format moves on one version with a migration', () => {
    expect(newSave(1, 'mario').wallet).toBe(false);
    expect(SAVE_MIGRATIONS.at(-1)).toBe(migrateV3toV4);
    expect(SAVE_VERSION).toBe(4);
    expect(newSave(1, 'mario').v).toBe(4);
  });

  it('an old (v3) file loads, with the Wallet off', () => {
    const { wallet: _w, ...old } = { ...newSave(1, 'link'), v: 3, coins: 42 };
    expect(migrateV3toV4(old)).toMatchObject({ v: 4, wallet: false, coins: 42 });
    const s = migrateSave(old, 1);
    expect(s?.v).toBe(4);
    expect(s?.wallet).toBe(false);
    expect(s?.coins).toBe(42);
    expect(s?.character).toBe('link');
  });

  it('the flag goes into the run and back to the file; coins keep their cap', () => {
    const save = { ...newSave(1, 'mario'), wallet: true, coins: 640 };
    const loaded = migrateSave(JSON.parse(JSON.stringify(save)), 1);
    expect(loaded?.wallet).toBe(true);
    expect(loaded?.coins).toBe(640);
    const state = stateFromSave(loaded!, CHARACTERS);
    expect(state.wallet).toBe(true);
    expect(state.coins).toBe(640);
    state.coins = 700;
    expect(saveFromState(loaded!, state)).toMatchObject({ wallet: true, coins: 700 });
    // An odd file: no Wallet, yet more than 99 coins; or with it, more than 999.
    expect(migrateSave({ ...save, wallet: false }, 1)?.coins).toBe(99);
    expect(migrateSave({ ...save, coins: 5000 }, 1)?.coins).toBe(999);
    expect(migrateSave({ ...save, wallet: 'yes' }, 1)?.wallet).toBe(false);
  });
});
