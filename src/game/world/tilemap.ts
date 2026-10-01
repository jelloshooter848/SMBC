import type { LevelData } from '../level/schema';
import { T, tileDef, type Collision } from '../level/tiles';

/** Mutable tile grid for a loaded level (bricks break, blocks get used). */
export class TileMap {
  readonly width: number;
  readonly height: number;
  readonly tiles: Uint16Array;

  constructor(level: LevelData) {
    this.width = level.width;
    this.height = level.height;
    this.tiles = new Uint16Array(level.tiles); // copy so restarts get a fresh map
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && tx < this.width && ty >= 0 && ty < this.height;
  }

  get(tx: number, ty: number): number {
    if (!this.inBounds(tx, ty)) return T.AIR;
    return this.tiles[ty * this.width + tx] as number;
  }

  set(tx: number, ty: number, id: number): void {
    if (this.inBounds(tx, ty)) this.tiles[ty * this.width + tx] = id;
  }

  /** Collision kind at a tile. Outside the level horizontally counts as solid wall; above/below is air. */
  collisionAt(tx: number, ty: number): Collision {
    if (tx < 0 || tx >= this.width) return 'solid';
    if (ty < 0 || ty >= this.height) return 'none';
    return tileDef(this.tiles[ty * this.width + tx] as number).collision;
  }

  isSolid(tx: number, ty: number): boolean {
    return this.collisionAt(tx, ty) === 'solid';
  }

  /** Solid when moving upward: hidden blocks only exist for heads. */
  blocksFromBelow(tx: number, ty: number): boolean {
    if (this.isSolid(tx, ty)) return true;
    if (!this.inBounds(tx, ty)) return false;
    return tileDef(this.tiles[ty * this.width + tx] as number).block?.kind === 'hidden';
  }
}
