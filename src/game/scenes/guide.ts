import type { Scene } from '@engine/scene';
import type { InputFrame } from '@engine/input/input-manager';
import type { Renderer } from '@engine/gfx/renderer';
import type { Code } from '@engine/input/bindings';
import { describeCode } from '@engine/input/bindings';
import { px, toPx } from '@engine/math/units';
import type { Game } from './game';
import { MenuScene } from './menu';
import type { CharacterDef, DemoPose, GuideAction } from '../characters/character';
import { Player } from '../entities/player';
import { wrapText, fontText } from '../hud/text';

const COLS = 30;
const PAGE_X = 8;
const TEXT_Y = 72;
const ROWS = 16;
const DEMO_FRAMES = 90;
/** Where the demo hero stands: a short floor at the top left under the tagline. */
const DEMO_FLOOR_Y = 62;
const DEMO_CENTER_X = 40;

/** Names for the standard gamepad mapping. */
export function describePad(code: Code): string {
  const names: Record<string, string> = {
    'pad:0': 'A',
    'pad:1': 'B',
    'pad:2': 'X',
    'pad:3': 'Y',
    'pad:4': 'LB',
    'pad:5': 'RB',
    'pad:6': 'LT',
    'pad:7': 'RT',
    'pad:8': 'BACK',
    'pad:9': 'START',
    'pad:12': 'D-UP',
    'pad:13': 'D-DOWN',
    'pad:14': 'D-LEFT',
    'pad:15': 'D-RIGHT',
  };
  return names[code] ?? describeCode(code).toUpperCase();
}

const TOUCH: Record<string, string> = {
  jump: 'A',
  attack: 'B',
  special: 'C',
  start: 'START',
  select: 'SELECT',
  up: 'PAD UP',
  down: 'PAD DOWN',
  'left/right': 'PAD',
};

/** Index of heroes; picking one opens its guide. */
export class GuideIndexScene extends MenuScene {
  constructor(game: Game, onBack: () => void) {
    super(game, 'HOW TO PLAY', [], onBack);
    this.setItems([
      ...game.deps.characters.map((c) => ({
        label: c.name,
        select: () => game.scenes.push(new GuideScene(game, c, () => game.scenes.pop())),
        hint: c.guide.tagline,
      })),
      { label: 'Back', select: onBack },
    ]);
  }
}

/** One hero's pages: controls with the live bindings, power-ups, tool belt; a demo sprite on top. */
export class GuideScene implements Scene {
  translucent = false;
  private page = 0;
  private scroll = 0;
  private t = 0;
  private readonly pages: { title: string; lines: string[] }[];
  private readonly demo: Player;
  private poseIndex = 0;
  private poseT = 0;
  private demoFrame = 0;

  constructor(
    private readonly game: Game,
    private readonly def: CharacterDef,
    private readonly onBack: () => void,
  ) {
    this.pages = this.buildPages();
    const power = def.damage.kind === 'powerup' ? 'fire' : 'full';
    this.demo = new Player(px(64), px(112), def, power, def.damage.kind === 'hp' ? def.damage.max : 0);
    Object.assign(this.demo.scratch, def.devKit?.() ?? {});
    if (def.damage.kind === 'hp' && this.demo.scratch.maxHp) this.demo.hp = this.demo.scratch.maxHp;
    this.demo.body.onGround = true;
    this.demo.refitHitbox();
    this.applyPose(this.currentPose());
  }

  private currentPose(): DemoPose {
    const poses = this.def.guide.demo;
    return poses[this.poseIndex % Math.max(1, poses.length)] ?? 'idle';
  }

  /** Put the throwaway player into a pose by poking the fields the sprite pickers read. */
  applyPose(pose: DemoPose): void {
    const p = this.demo;
    p.anim = 'idle';
    p.crouching = false;
    p.attackTimer = 0;
    p.body.onGround = true;
    p.body.vx = 0;
    p.body.vy = 0;
    p.scratch.ball = 0;
    p.scratch.throwT = 0;
    p.scratch.spin = 0;
    p.scratch.aimUp = 0;
    p.clinging = false;
    switch (pose) {
      case 'walk':
        p.anim = 'walk';
        p.body.vx = p.profile.maxWalk;
        break;
      case 'jump':
        p.anim = 'jump';
        p.body.onGround = false;
        p.body.vy = -0x02000;
        break;
      case 'attack':
        p.anim = 'attack';
        p.attackTimer = 12;
        break;
      case 'crouch':
        p.crouching = true;
        p.anim = 'crouch';
        if (!this.def.crouches) p.scratch.ball = 1;
        break;
      case 'special':
        p.scratch.throwT = 10;
        p.scratch.aimUp = 1;
        p.scratch.spin = 30;
        p.anim = 'jump';
        p.body.onGround = false;
        break;
      case 'idle':
        break;
    }
    p.refitHitbox();
  }

  private bindingLabel(action: GuideAction): string {
    const s = this.game.deps.settings;
    const b = s?.input.bindings[0];
    // Touch labels only when the pad is forced on or this is a touch device.
    const mode = s?.input.touch ?? 'auto';
    const touchDevice = typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
    const touchOn = mode === 'on' || (mode === 'auto' && touchDevice);
    const parts = action.split('+').map((a) => a.trim().replace(' (hold)', ''));
    const one = (a: string): string => {
      if (a === 'left/right') {
        const l = b?.keyboard.left[0];
        const r = b?.keyboard.right[0];
        return `${l ? describeCode(l) : 'LEFT'}/${r ? describeCode(r) : 'RIGHT'}`;
      }
      const kb = b?.keyboard[a as keyof typeof b.keyboard]?.[0];
      const pad = b?.gamepad[a as keyof typeof b.gamepad]?.[0];
      const bits = [kb ? describeCode(kb) : a.toUpperCase()];
      if (pad) bits.push(`(${describePad(pad)})`);
      if (touchOn && TOUCH[a]) bits.push(`TOUCH ${TOUCH[a]}`);
      return bits.join(' ');
    };
    const hold = action.endsWith('(hold)') ? ' HOLD' : '';
    return fontText(parts.map(one).join(' + ') + hold);
  }

  private buildPages(): { title: string; lines: string[] }[] {
    const g = this.def.guide;
    const pages: { title: string; lines: string[] }[] = [];
    const controls: string[] = [];
    for (const c of g.controls) {
      controls.push(`${this.bindingLabel(c.action)}:`);
      for (const l of wrapText(c.does, COLS - 2)) controls.push(`  ${l}`);
    }
    pages.push({ title: 'CONTROLS', lines: controls });
    const power: string[] = [];
    const names = { mushroom: 'MUSHROOM', flower: 'FIRE FLOWER', star: 'STAR', drops: 'ENEMY DROPS' };
    for (const pu of g.powerups) {
      power.push(`${names[pu.item]}:`);
      for (const l of wrapText(pu.does, COLS - 2)) power.push(`  ${l}`);
    }
    pages.push({ title: 'POWER-UPS', lines: power });
    if (g.belt?.length || g.tips?.length) {
      const belt: string[] = [];
      if (g.belt?.length) {
        for (const l of wrapText(
          `${this.bindingLabel('select')} cycles, ${this.bindingLabel('special')} uses:`,
          COLS,
        ))
          belt.push(l);
        for (const t of g.belt) {
          belt.push(fontText(`${t.name}${t.cost ? ` (${t.cost})` : ''}:`));
          for (const l of wrapText(t.does, COLS - 2)) belt.push(`  ${l}`);
        }
      }
      if (g.tips?.length) {
        if (belt.length) belt.push('');
        for (const tip of g.tips) for (const l of wrapText(`> ${tip}`, COLS)) belt.push(l);
      }
      pages.push({ title: g.belt?.length ? 'TOOL BELT' : 'TIPS', lines: belt });
    }
    return pages;
  }

  enter(): void {
    this.announce();
  }

  private announce(): void {
    const pg = this.pages[this.page];
    if (!pg) return;
    this.game.deps.announcer?.say(`${this.def.name}. ${pg.title}. ${pg.lines.join(' ')}`);
  }

  private flip(dir: -1 | 1): void {
    const n = this.pages.length;
    this.page = (this.page + dir + n) % n;
    this.scroll = 0;
    this.game.ctx.audio.sfx('select');
    this.announce();
  }

  update(input: InputFrame): void {
    this.t++;
    // Demo sprite: advance the walk cycle and cycle poses.
    this.demoFrame++;
    if (this.demo.anim === 'walk' && this.demoFrame % 6 === 0)
      this.demo.walkFrame = (this.demo.walkFrame + 1) % 3;
    if (this.demo.attackTimer > 0) this.demo.attackTimer--;
    if (this.demo.scratch.throwT) this.demo.scratch.throwT--;
    if (++this.poseT >= DEMO_FRAMES) {
      this.poseT = 0;
      this.poseIndex++;
      this.applyPose(this.currentPose());
    }
    if (this.t < 6) return;
    if (input.pressed('select') || input.pressed('attack')) {
      this.onBack();
      return;
    }
    if (input.pressed('right') || input.pressed('start') || input.pressed('jump')) this.flip(1);
    else if (input.pressed('left')) this.flip(-1);
    const lines = this.pages[this.page]?.lines.length ?? 0;
    if (input.pressed('down')) this.scroll = Math.min(Math.max(0, lines - ROWS), this.scroll + 3);
    if (input.pressed('up')) this.scroll = Math.max(0, this.scroll - 3);
  }

  render(r: Renderer): void {
    r.clear('#000');
    const assets = this.game.ctx.assets;
    const font = assets.sheet('font');
    const name = fontText(this.def.name);
    r.text(font, name, 128 - (name.length * 8) / 2, 8);
    const tag = fontText(this.def.guide.tagline).slice(0, COLS);
    r.text(font, tag, 128 - (tag.length * 8) / 2, 18);
    // Live demo: the hero stands on a short floor at the top left.
    const p = this.demo;
    const s = this.def.sprite(p, this.demoFrame, this.game.ctx.reduceFlashing);
    const sheet = assets.sheet(s.sheet, s.palette);
    const f = sheet.frames.get(s.frame);
    const w = f?.w ?? 16;
    const bw = toPx(p.body.w);
    const bodyX = DEMO_CENTER_X - (bw >> 1);
    const x = bodyX - (s.flip ? w - bw - s.offsetX : s.offsetX);
    const feet = toPx(p.body.y + p.body.h);
    const y = toPx(p.body.y) - s.offsetY + (DEMO_FLOOR_Y - feet);
    r.rect(16, DEMO_FLOOR_Y, 48, 2, '#c84c0c');
    r.sprite(sheet, s.frame, x, y, s.flip);
    // Page title and marker.
    const pg = this.pages[this.page];
    if (!pg) return;
    const title = `${pg.title}  ${this.page + 1}/${this.pages.length}`;
    r.text(font, title, 80, 40);
    r.text(font, '< >', 232, 40);
    const rows = pg.lines.slice(this.scroll, this.scroll + ROWS);
    rows.forEach((l, i) => r.text(font, l.slice(0, COLS), PAGE_X, TEXT_Y + i * 9));
    if (this.scroll + ROWS < pg.lines.length) r.text(font, 'MORE...', 192, 226);
    if ((this.t >> 5) % 2 === 0) r.text(font, 'B: BACK', 8, 226);
  }
}
