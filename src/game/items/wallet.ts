/*
 * Coins and the Wallet (0.4.42, the owner's addendum to the village design; docs/POWERUPS.md
 * "Kakariko shop"). Without the Wallet coins follow SMB: every 100 make a life and the count goes
 * back to 0. With it (a gift in Kakariko Village, on the save file) they add up to 999 with no
 * automatic 1-up: coins are for the shop. Classic play never has it.
 */

/** Coins SMB turns into a life. */
export const COINS_PER_LIFE = 100;
/** What the Wallet holds. */
export const WALLET_MAX = 999;
/** Its name, in the style of Zelda's wallets (original). */
export const WALLET_NAME = "TRAVELER'S WALLET";

interface Purse {
  coins: number;
  wallet: boolean;
}

/** Adds `n` coins by the rule in force; returns the lives SMB's rule makes of them (0 with the Wallet). */
export function gainCoins(s: Purse, n: number): number {
  if (s.wallet) {
    s.coins = Math.min(WALLET_MAX, s.coins + n);
    return 0;
  }
  s.coins += n;
  let lives = 0;
  while (s.coins >= COINS_PER_LIFE) {
    s.coins -= COINS_PER_LIFE;
    lives++;
  }
  return lives;
}

/** The most coins a run can hold: 999 with the Wallet, 99 without. */
export const coinCap = (wallet: boolean): number => (wallet ? WALLET_MAX : COINS_PER_LIFE - 1);

/** The coin count as every HUD shows it: 3 digits with the Wallet, 2 without. */
export function coinText(s: Purse): string {
  const digits = s.wallet ? 3 : 2;
  return String(Math.max(0, Math.min(coinCap(s.wallet), Math.floor(s.coins)))).padStart(digits, '0');
}
