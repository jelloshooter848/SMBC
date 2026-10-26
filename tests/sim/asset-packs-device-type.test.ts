import { describe, expect, it } from 'vitest';
import { packsNeedComputer } from '@engine/assets/folder-picker';

/*
 * Item 128 (owner): ASSET PACKS NEED A COMPUTER is decided by the kind of device. A coarse
 * primary pointer (a finger) is a phone or tablet, Android ones included, even where its browser
 * can pick a folder; a touchscreen laptop (a fine primary pointer, a folder picker) keeps Import.
 */

describe('item 128: ASSET PACKS by device type', () => {
  it('a phone or tablet (coarse pointer) needs a computer, folder picker or not (Android Chrome)', () => {
    for (const touchShown of [true, false])
      for (const folderPicker of [true, false])
        expect(packsNeedComputer({ touchShown, coarsePointer: true, folderPicker })).toBe(true);
  });

  it('a touchscreen laptop (fine pointer, folder picker) keeps Import, its touch pad up or not', () => {
    expect(packsNeedComputer({ touchShown: true, coarsePointer: false, folderPicker: true })).toBe(false);
    expect(packsNeedComputer({ touchShown: false, coarsePointer: false, folderPicker: true })).toBe(false);
  });

  it('a desktop keeps Import, picker or not; touch on without a picker still needs a computer', () => {
    expect(packsNeedComputer({ touchShown: false, coarsePointer: false, folderPicker: false })).toBe(false);
    expect(packsNeedComputer({ touchShown: true, coarsePointer: false, folderPicker: false })).toBe(true);
  });
});
