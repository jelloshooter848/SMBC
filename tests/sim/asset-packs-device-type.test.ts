import { describe, expect, it } from 'vitest';
import { packsFolderless } from '@engine/assets/folder-picker';

/*
 * Item 128 (owner): ASSET PACKS NEED A COMPUTER was decided by the kind of device; since item
 * 141 the same decision only takes away the folder import (every device has Import pack (.zip)). A coarse
 * primary pointer (a finger) is a phone or tablet, Android ones included, even where its browser
 * can pick a folder; a touchscreen laptop (a fine primary pointer, a folder picker) keeps Import.
 */

describe('item 128: ASSET PACKS by device type', () => {
  it('a phone or tablet (coarse pointer) has no folder import, folder picker or not (Android Chrome)', () => {
    for (const touchShown of [true, false])
      for (const folderPicker of [true, false])
        expect(packsFolderless({ touchShown, coarsePointer: true, folderPicker })).toBe(true);
  });

  it('a touchscreen laptop (fine pointer, folder picker) keeps Import, its touch pad up or not', () => {
    expect(packsFolderless({ touchShown: true, coarsePointer: false, folderPicker: true })).toBe(false);
    expect(packsFolderless({ touchShown: false, coarsePointer: false, folderPicker: true })).toBe(false);
  });

  it('a desktop keeps Import, picker or not; touch on without a picker has none', () => {
    expect(packsFolderless({ touchShown: false, coarsePointer: false, folderPicker: false })).toBe(false);
    expect(packsFolderless({ touchShown: true, coarsePointer: false, folderPicker: false })).toBe(true);
  });
});
