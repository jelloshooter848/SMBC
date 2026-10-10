import type { Renderer } from '@engine/gfx/renderer';
import type { InputFrame } from '@engine/input/input-manager';
import type { CharacterDef } from '../characters/character';
import { isHorizontal, type Dir } from '../topdown/geometry';
import { TdWalker } from '../topdown/walker';
import type { TdView } from '../topdown/view';
import type { TopDownWorld } from '../topdown/world';

/*
 * The heroes from above in Kakariko Village (design 1.4): 16×16, chibi, the `link-td` contract
 * (`down-0/1`, `up-0/1`, `side-0/1`; the side frames mirrored for left). Link uses his keep
 * sprite (`link-td`), Sophia III walks as Jason (`sophia`'s `jason-o-*`), Luigi is Mario's set in
 * his own colours; the rest have their own sheet, `td-<hero>` (src/content/sprites/town-heroes.ts).
 * Power shows by palette only (fire Mario and Luigi, Link's blue and red tunics, Samus's Varia).
 */

/** How a hero is drawn from above right now. */
export interface OverheadLook {
  sheet: string;
  palette?: string;
  frame: string;
  flip: boolean;
}

/** The palette a hero's power (and kit) asks for, or undefined for the sheet's own. */
export function overheadPalette(
  c: CharacterDef,
  power: string,
  kit: Readonly<Record<string, number>>,
): string | undefined {
  switch (c.id) {
    case 'mario':
    case 'luigi':
      return power === 'fire' ? `td-${c.id}-fire` : `td-${c.id}`;
    case 'link':
      // As his side-view self (characters/link: the beam's red, a found tunic's blue).
      return kit.beam ? 'link-td-red' : kit.tunic ? 'link-td-blue' : undefined;
    case 'samus':
      return kit.varia ? 'td-samus-varia' : undefined;
    default:
      return undefined;
  }
}

/** The sheet a hero is drawn from above with. */
export function overheadSheet(c: CharacterDef): string {
  if (c.id === 'link') return 'link-td';
  if (c.id === 'sophia') return 'sophia';
  if (c.id === 'luigi') return 'td-mario';
  return `td-${c.id}`;
}

/** The frame for `facing` at walk step `step` (0 standing). */
export function overheadLook(
  c: CharacterDef,
  power: string,
  kit: Readonly<Record<string, number>>,
  facing: Dir,
  step: 0 | 1,
): OverheadLook {
  const sheet = overheadSheet(c);
  const palette = overheadPalette(c, power, kit);
  if (c.id === 'sophia') return { sheet, frame: `jason-o-${facing}-${step}`, flip: false };
  const dir = isHorizontal(facing) ? 'side' : facing;
  return { sheet, ...(palette ? { palette } : {}), frame: `${dir}-${step}`, flip: facing === 'left' };
}

/** Who the town hero is right now (read each frame: SELECT changes it). */
export interface HeroSource {
  character(): CharacterDef;
  power(): string;
  kit(): Readonly<Record<string, number>>;
}

/**
 * A hero walking the village: the kit's eight-way walker (1.5 px a frame, 2 with ATTACK or RUN
 * held), drawn as whoever the file's hero is now. No sword, no jump: heroes only walk and talk.
 */
export class TownHero extends TdWalker {
  /** Moved on the last frame (the walk steps; standing shows step 0). */
  moving = false;

  constructor(
    x: number,
    y: number,
    private readonly who: HeroSource,
  ) {
    super(x, y);
    this.facing = 'up';
  }

  override update(world: TopDownWorld, input: InputFrame): void {
    const { x, y } = this;
    super.update(world, input);
    this.moving = x !== this.x || y !== this.y;
  }

  override walkInStep(world: TopDownWorld, dir: Dir, x: number, y: number): boolean {
    this.moving = true;
    return super.walkInStep(world, dir, x, y);
  }

  /** The look for now (exposed for tests and the HUD). */
  look(): OverheadLook {
    const step = (this.moving ? (this.walkT >> 3) & 1 : 0) as 0 | 1;
    return overheadLook(this.who.character(), this.who.power(), this.who.kit(), this.facing, step);
  }

  override render(r: Renderer, view: TdView, ox: number, oy: number): void {
    const look = this.look();
    const x = ox + this.x;
    const y = oy + this.y;
    const sheet = view.sheet(look.sheet, look.palette) ?? view.sheet(look.sheet);
    if (sheet?.frames.has(look.frame)) {
      const f = sheet.frames.get(look.frame);
      // Taller frames (Jason's are 16×16 too; a hero's may run a pixel or two over) stand on the feet.
      r.sprite(sheet, look.frame, x + 8 - ((f?.w ?? 16) >> 1), y + 16 - (f?.h ?? 16), look.flip);
    } else {
      r.rect(x + 3, y + 2, 10, 13, '#e45c10');
      r.rect(x + 5, y + 1, 6, 5, '#fca044');
    }
  }
}
