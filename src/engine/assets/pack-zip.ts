import type { StoredPack } from './idb';
import { makeZip, safeZipPath, type ZipEntry } from '../save/zip';

/*
 * An asset pack as `<name>.zip` (SAVE DATA's export, owner item 86): manifest.json and the pack's
 * files at the paths its manifest names, the folder layout Import pack reads, so the zip,
 * unzipped, goes back in through Import pack as the same pack. A backup import never restores
 * packs (a .zip import is roadmap item 84B).
 */

export interface PackZip {
  fileName: string;
  bytes: Uint8Array;
}

/** One stored pack as a zip. Rejects when a file cannot be read or has an unsafe path. */
export async function packZip(pack: StoredPack): Promise<PackZip> {
  const entries: ZipEntry[] = [{ path: 'manifest.json', data: JSON.stringify(pack.manifest, null, 2) }];
  for (const path of Object.keys(pack.files).sort()) {
    if (!safeZipPath(path) || path === 'manifest.json')
      throw new Error(`pack file "${path}" cannot go in a zip`);
    const blob = pack.files[path] as Blob;
    entries.push({ path, data: new Uint8Array(await blob.arrayBuffer()) });
  }
  return { fileName: `${pack.name}.zip`, bytes: makeZip(entries) };
}

/** Every pack that can be read, as zips, and the names of those that could not (left out). */
export async function packZips(packs: readonly StoredPack[]): Promise<{ zips: PackZip[]; failed: string[] }> {
  const zips: PackZip[] = [];
  const failed: string[] = [];
  for (const p of packs) {
    try {
      zips.push(await packZip(p));
    } catch {
      failed.push(p.name);
    }
  }
  return { zips, failed };
}
