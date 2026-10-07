// Scratch only (not in the repo): composes the SMB Crossover REMIX title-screen mockups.
import { it } from 'vitest';
import { Layer, spr, text, ctext, textW, logoWord, stamp, hash, bayer, HEROES, frameSize } from './lib';

const OUT = __dirname;
const VERSION = 'V0.5.0';
const MENU = ['START GAME', 'CUSTOM LEVELS', 'OPTIONS', 'DEV MODE'];
const MADE = 'MADE BY JELLOSHOOTER848';
const BASED1 = 'BASED ON SUPER MARIO BROS.';
const BASED2 = 'CROSSOVER BY EXPLODING RABBIT';
const FAN = 'UNOFFICIAL FAN PROJECT';

function menu(L: Layer, y: number, step: number, x = 88, color = '#fcfcfc', sel = 0, cursor = '#fcfcfc') {
  MENU.forEach((m, i) => {
    if (i === sel) text(L, '>', x - 12, y + i * step, cursor);
    text(L, m, x, y + i * step, i === 3 ? '#bcbcbc' : color);
  });
}

function hero(L: Layer, i: number, x: number, y: number, found: boolean, rim?: string) {
  const h = HEROES[i]!;
  if (found) return spr(L, h.sheet, h.frame, x, y, { pal: h.pal });
  if (rim)
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const)
      spr(L, h.sheet, h.frame, x + dx, y + dy, { pal: h.pal, map: () => rim });
  return spr(L, h.sheet, h.frame, x, y, { pal: h.pal, map: () => '#000000' });
}

// ===================================================================== A: block logo over SMB scene
function mockupA(): Layer {
  const L = new Layer(256, 240, '#5c94fc');
  // far parallax layer: hills and clouds (decor sheet)
  spr(L, 'decor', 'hill-big', -16, 178);
  spr(L, 'decor', 'hill-small', 204, 186);
  spr(L, 'decor', 'cloud-1', 212, 6);
  spr(L, 'decor', 'cloud-2', 4, 92);
  spr(L, 'decor', 'cloud-1', 214, 104);
  spr(L, 'decor', 'bush-1', 96, 192);
  // ground: two rows of the overworld ground tile
  for (let x = 0; x < 256; x += 16) {
    spr(L, 'tiles', 'ground', x, 208);
    spr(L, 'tiles', 'ground', x, 224);
  }
  // a few blocks for flavour, as a "shelf" the SMB tag sits on
  // --- logo
  const tag = new Layer(58, 22, '#000000');
  tag.rect(1, 1, 56, 20, '#f83800');
  tag.rect(2, 2, 54, 1, '#fca044');
  tag.rect(2, 19, 54, 1, '#a81000');
  const smb = logoWord('SMB', { sx: 2, sy: 2, grad: ['#fcfcfc'], outline: '#000000' });
  tag.paste(smb, 29 - Math.floor(smb.w / 2), 11 - Math.floor(smb.h / 2));
  L.paste(tag, 18, 8);
  const cross = logoWord('CROSSOVER', {
    sx: 3,
    sy: 4,
    adv: 8,
    grad: ['#f8d878', '#f8b800', '#fca044', '#e45c10'],
    hi: '#fcfcfc',
    lo: '#a81000',
    extrude: '#a81000',
    depth: 3,
    outline: '#000000',
  });
  L.paste(cross, Math.round(128 - cross.w / 2) + 1, 30);
  const remix = stamp('REMIX', '#f83800', '#fcfcfc', 2);
  const rl = new Layer(remix.w + 2, remix.h + 2);
  rl.paste(remix, 1, 1);
  rl.outline('#000000');
  // drop shadow
  const sh = new Layer(rl.w, rl.h);
  for (let y = 0; y < rl.h; y++) for (let x = 0; x < rl.w; x++) if (rl.get(x, y)) sh.set(x, y, '#000000');
  L.paste(sh, 160 + 2, 72 + 2, 0.2);
  L.paste(rl, 160, 72, 0.2);
  text(L, 'CHAPTER 1', 22, 70, '#fcfcfc', '#000000');
  // --- menu
  menu(L, 96, 12, 80);
  // --- credits on the sky
  ctext(L, MADE, 148, '#f8d878', '#000000');
  ctext(L, BASED1, 160, '#fcfcfc');
  ctext(L, BASED2, 169, '#fcfcfc');
  // --- heroes lined up on the ground (4 freed, 4 to find)
  const found = [true, true, true, true, false, false, false, false];
  HEROES.forEach((_, i) => {
    const x = 36 + i * 24;
    hero(L, i, x, 176, found[i]!);
    if (!found[i]) text(L, '?', x + 4, 178, '#fcfcfc');
  });
  // --- footer on the ground
  text(L, FAN, 4, 228, '#fcfcfc', '#000000');
  text(L, VERSION, 252 - textW(VERSION), 228, '#fcfcfc', '#000000');
  return L;
}


// ===================================================================== B: SMB3-style stage
function curtainColor(u: number, y: number): string {
  // u: 0 at the outer edge .. 1 at the inner edge; three folds
  const s = Math.sin(u * Math.PI * 2 * 3 + y * 0.01);
  if (s > 0.6) return '#f83800';
  if (s > -0.4) return '#a81000';
  return '#503000';
}
function mockupB(): Layer {
  const L = new Layer(256, 240, '#000000');
  const FLOOR = 188;
  const found = [true, true, true, true, false, false, false, false];
  const hx = (i: number) => 43 + i * 22;
  // spotlights (dithered cones from lamps hidden in the valance)
  HEROES.forEach((_, i) => {
    if (!found[i]) return;
    const cx = hx(i) + 8;
    const ax = cx + (cx - 128) * 0.25;
    for (let y = 14; y < FLOOR; y++) {
      const t = (y - 14) / (FLOOR - 14);
      const mid = ax + (cx - ax) * t;
      const half = 3 + 9 * t;
      for (let x = Math.floor(mid - half); x <= Math.ceil(mid + half); x++) {
        const edge = Math.abs(x - mid) / half;
        const dens = 0.25 + 0.3 * t - (edge > 0.75 ? 0.2 : 0);
        if (bayer(x, y) < dens) L.set(x, y, '#404040');
      }
    }
  });
  // floor: two rows of checks, a wooden lip, then the black apron with footlights
  for (let r = 0; r < 2; r++)
    for (let x = -8; x < 256; x += 16) {
      const x0 = x + (r ? 8 : 0);
      for (let y = 0; y < 5; y++)
        for (let i = 0; i < 16; i++) L.set(x0 + i, FLOOR + r * 5 + y, ((x0 + i) >> 4) % 2 === r % 2 ? '#fcd8a8' : '#c84c0c');
    }
  // pools of light on the floor
  HEROES.forEach((_, i) => {
    if (!found[i]) return;
    const cx = hx(i) + 8;
    for (let y = FLOOR; y < FLOOR + 10; y++)
      for (let x = cx - 14; x <= cx + 14; x++) {
        const e = ((x - cx) / 14) ** 2 + ((y - FLOOR - 4) / 5) ** 2;
        if (e > 1) continue;
        const c = L.hex(x, y);
        L.set(x, y, c === '#c84c0c' ? '#fca044' : '#fcfcfc');
      }
  });
  L.rect(0, FLOOR + 10, 256, 2, '#ac7c00');
  L.rect(0, FLOOR + 12, 256, 1, '#503000');
  for (let x = 12; x < 256; x += 24) {
    L.rect(x, FLOOR + 13, 8, 2, '#7c7c7c');
    L.rect(x + 2, FLOOR + 15, 4, 1, '#f8d878');
  }
  // the cast: freed heroes under the lights, the rest waiting in the dark
  HEROES.forEach((_, i) => {
    hero(L, i, hx(i), FLOOR - 32 + 1, found[i]!, '#404040');
  });
  // side curtains, gathered by a gold tie-back
  const TIE = 112;
  for (let y = 0; y < FLOOR + 2; y++) {
    const e =
      y < TIE ? 40 - 22 * (y / TIE) ** 1.6 : 18 + 16 * ((y - TIE) / (FLOOR - TIE)) ** 0.8;
    for (let x = 0; x < e; x++) {
      const c = x >= e - 1 ? '#fca044' : curtainColor(x / e, y);
      L.set(x, y, c);
      L.set(255 - x, y, c);
    }
  }
  for (const side of [0, 1])
    for (let y = TIE - 3; y < TIE + 3; y++)
      for (let x = 0; x < 22; x++) {
        const xx = side ? 255 - x : x;
        L.set(xx, y, y === TIE - 3 ? '#f8d878' : y === TIE + 2 ? '#ac7c00' : '#f8b800');
      }
  // valance with swags and a gold fringe
  for (let x = 0; x < 256; x++) {
    const sw = Math.sin((Math.PI * (x % 32)) / 32);
    const yb = 9 + Math.round(5 * sw);
    for (let y = 0; y < yb; y++) {
      const shade = y > yb - 3 ? '#503000' : Math.abs((x % 32) - 16) < 3 && y < yb - 4 ? '#f83800' : '#a81000';
      L.set(x, y, shade);
    }
    L.set(x, yb, '#f8b800');
    L.set(x, yb + 1, x % 3 === 0 ? '#f8b800' : '#ac7c00');
    if (x % 3 === 0) L.set(x, yb + 2, '#ac7c00');
  }
  // banner
  const BW = 224;
  const BH = 54;
  const ban = new Layer(256, 80);
  const bx = 16;
  const by = 4;
  for (const side of [0, 1]) {
    // tails behind the body
    const tx = side ? bx + BW - 18 : 2;
    for (let y = 0; y < 44; y++)
      for (let x = 0; x < 30; x++) {
        const notch = side ? x > 30 - 1 - (8 - Math.abs(y - 22) * (8 / 22)) : x < 8 - Math.abs(y - 22) * (8 / 22);
        if (notch) continue;
        ban.set(tx + x - (side ? -4 : 0), by + 14 + y, y < 2 ? '#fcd8a8' : '#f8b878');
      }
    // fold triangle
    for (let y = 0; y < 8; y++)
      for (let x = 0; x <= y; x++) ban.set(side ? bx + BW - 1 - x + 0 : bx + x, by + BH + y - 0, '#ac7c00');
  }
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++)
      ban.set(bx + x, by + y, y === 0 ? '#fcfcfc' : y >= BH - 3 ? '#f8b878' : '#fcd8a8');
  ban.outline('#000000');
  L.paste(ban, 0, 18);
  const smb = logoWord('SMB', { sx: 2, sy: 2, grad: ['#f83800'], outline: '#000000' });
  L.paste(smb, Math.round(128 - smb.w / 2), 24);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 66; k++) {
      const x = side < 0 ? 128 - 34 - k : 128 + 34 + k;
      L.set(x, 31, '#c84c0c');
      L.set(x, 32, '#c84c0c');
    }
    const dx = side < 0 ? 128 - 102 : 128 + 102;
    for (let j = -3; j <= 3; j++) for (let i = -(3 - Math.abs(j)); i <= 3 - Math.abs(j); i++) L.set(dx + i, 31 + j, '#f83800');
  }
  const cross = logoWord('CROSSOVER', {
    sx: 3,
    sy: 3,
    grad: ['#f83800', '#f83800', '#a81000'],
    hi: '#fca044',
    extrude: '#503000',
    depth: 2,
    outline: '#000000',
  });
  L.paste(cross, Math.round(128 - cross.w / 2) + 1, 42);
  // REMIX ribbon hanging under the banner
  const rib = new Layer(120, 30);
  for (const side of [0, 1])
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < 16; x++) {
        const notch = side ? x > 15 - (5 - Math.abs(y - 9) * (5 / 9)) : x < 5 - Math.abs(y - 9) * (5 / 9);
        if (notch) continue;
        rib.set(side ? 104 + x : x, 8 + y, '#a81000');
      }
  for (let y = 0; y < 22; y++) for (let x = 10; x < 110; x++) rib.set(x, y + 2, y === 0 ? '#fca044' : y > 19 ? '#a81000' : '#f83800');
  const rw = logoWord('REMIX', { sx: 2, sy: 2, grad: ['#fcfcfc'], lo: '#fcd8a8', outline: '#000000' });
  rib.paste(rw, 60 - Math.floor(rw.w / 2), 13 - Math.floor(rw.h / 2));
  rib.outline('#000000');
  L.paste(rib, 68, 72);
  // menu, credits
  menu(L, 102, 11, 88);
  ctext(L, MADE, 145, '#f8d878');
  ctext(L, BASED1, FLOOR + 19, '#fcfcfc');
  ctext(L, BASED2, FLOOR + 29, '#fcfcfc');
  text(L, FAN, 4, 231, '#7c7c7c');
  text(L, VERSION, 252 - textW(VERSION), 231, '#7c7c7c');
  return L;
}

// ===================================================================== C: the wand's rift
const RX = 128;
const RY = 50;
const RAX = 126;
const RAY = 44;
function riftEdge(th: number): number {
  const n = 34;
  const t = ((th + Math.PI) / (2 * Math.PI)) * n;
  const k = Math.floor(t);
  const f = t - k;
  const amp = (j: number) => {
    const jj = ((j % n) + n) % n;
    return (jj % 2 ? 0.1 : -0.06) + 0.08 * hash(jj, 3, 11);
  };
  return 1 + amp(k) * (1 - f) + amp(k + 1) * f;
}
function shardWorld(i: number, W: number, H: number, found: boolean): Layer {
  const S = new Layer(W, H, '#000000');
  const g = H - 8;
  const groundRow = (frame: string, pal?: string) => {
    for (let x = -8; x < W; x += 16) spr(S, 'tiles', frame, x, g, { pal });
  };
  switch (i) {
    case 0: // Link: palace ruins under a pale sky
      S.rect(0, 0, W, H, '#3cbcfc');
      spr(S, 'decor', 'ruin-pillar', 22, g - 48);
      spr(S, 'decor', 'ruin-pillar-broken', -6, g - 32);
      groundRow('ground');
      spr(S, 'link', 'idle', 10, g - 32);
      break;
    case 1: // Mega Man: station window and girders
      S.rect(0, 0, W, H, '#0000bc');
      spr(S, 'station', 'window', -6, 2);
      for (let x = -4; x < W; x += 16) spr(S, 'station', 'girder', x, g);
      spr(S, 'megaman', 'idle', 10, g - 32);
      break;
    case 2: // Samus: Chozo statue in the caverns
      spr(S, 'zebes', 'chozo-0', 10, g - 32);
      groundRow('ground@cavern', 'tiles-cavern');
      spr(S, 'samus', 'idle', 4, g - 32);
      break;
    case 3: // Simon: stained glass and candles
      spr(S, 'crypt', 'stained-glass', 2, -4);
      spr(S, 'crypt', 'candle-0', 26, g - 18);
      groundRow('ground@crypt', 'tiles-crypt');
      spr(S, 'simon', 'idle', 10, g - 32);
      break;
    case 4: // Ryu: the moon over the rooftops
      S.rect(0, 0, W, H, '#0000bc');
      spr(S, 'ninja', 'cut-moon', -18, -24);
      groundRow('ground@ninja-night', 'tiles-ninja-night');
      spr(S, 'ryu', 'idle', 10, g - 32);
      break;
    case 5: // Bill: jungle palms
      spr(S, 'decor', 'palm', 6, g - 48, { pal: 'decor-jungle' });
      groundRow('ground@contra-jungle', 'tiles-contra-jungle');
      spr(S, 'bill', 'idle', 10, g - 32);
      break;
    case 6: { // Sophia III: the cavern garage
      groundRow('ground@cavern', 'tiles-cavern');
      const f = frameSize('sophia', 'idle');
      spr(S, 'sophia', 'idle', Math.round(W / 2 - f.w / 2), g - f.h, { pal: found ? 'sophia' : 'sophia~silhouette' });
      break;
    }
  }
  if (!found) {
    // closed shard: the world is only a dim, static-washed glimpse; the hero a silhouette
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = S.get(x, y)!;
        const lum = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;
        const nz = hash(x, y, i * 13 + 5);
        let o = lum > 0.45 && bayer(x, y) < 0.5 ? '#404040' : '#000000';
        if (nz < 0.04) o = '#7c7c7c';
        if ((y + i * 3) % 11 === 0 && nz < 0.4) o = '#404040';
        S.set(x, y, o);
      }
    const hh = HEROES[i + 2];
    const sil = (sh: string, fr: string, x: number, y: number, pal: string) => {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const)
        spr(S, sh, fr, x + dx, y + dy, { pal, map: () => '#7c7c7c' });
      spr(S, sh, fr, x, y, { pal, map: () => '#000000' });
    };
    if (hh) sil(hh.sheet, hh.frame, 10, g - 32, hh.pal);
    else {
      const f = frameSize('sophia', 'idle');
      sil('sophia', 'idle', Math.round(W / 2 - f.w / 2), g - f.h, 'sophia');
    }
    text(S, '?', 14, 6, '#bcbcbc');
  }
  return S;
}
function mockupC(): Layer {
  const L = new Layer(256, 240, '#000000');
  // stars and a faint nebula
  for (let y = 0; y < 240; y++)
    for (let x = 0; x < 256; x++) {
      const n = Math.sin(x * 0.045 + Math.sin(y * 0.05) * 2) + Math.sin(y * 0.07 - x * 0.02);
      if (n > 1.2 && bayer(x, y) < (n - 1.2) * 0.9) L.set(x, y, '#0000bc');
      const h = hash(x, y, 1);
      if (h < 0.006) L.set(x, y, h < 0.002 ? '#fcfcfc' : h < 0.004 ? '#a4e4fc' : '#9878f8');
    }
  // cracks in space leading out of the rift
  for (let k = 0; k < 10; k++) {
    const th = (k / 10) * Math.PI * 2 + 0.3;
    let x = RX + Math.cos(th) * RAX * 0.8;
    let y = RY + Math.sin(th) * RAY * 0.5;
    let dir = th;
    for (let s = 0; s < 60; s++) {
      dir += (hash(k, s, 4) - 0.5) * 0.9;
      x += Math.cos(dir) * 2;
      y += Math.sin(dir) * 2;
      L.set(x, y, s < 20 ? '#a4e4fc' : '#2038ec');
      if (s % 7 === 3) L.set(x + 1, y, '#9878f8');
    }
  }
  // the rift itself: a jagged, eye-shaped tear with a white-hot rim and a swirling inside
  for (let y = 0; y < 132; y++)
    for (let x = 0; x < 256; x++) {
      const u = (x - RX) / RAX;
      if (Math.abs(u) >= 1) continue;
      const hh = (1 - u * u) ** 0.7 * riftEdge(u * 3);
      const w = (y - RY) / RAY / hh;
      const v = Math.abs(w);
      if (v > 1.12) continue;
      if (v > 1) {
        if (bayer(x, y) < (1.12 - v) * 4) L.set(x, y, '#d800cc');
        continue;
      }
      const sw = Math.sin(u * 14 + w * 3 - v * 6);
      const p = v + 0.06 * sw;
      const d = bayer(x, y);
      let c: string;
      if (p < 0.55) c = sw > 0.6 && d < 0.5 ? '#2038ec' : '#0000bc';
      else if (p < 0.72) c = d < (p - 0.55) * 6 ? '#9878f8' : '#2038ec';
      else if (p < 0.84) c = sw > 0 ? '#d800cc' : '#9878f8';
      else if (p < 0.93) c = d < 0.6 ? '#3cbcfc' : '#a4e4fc';
      else c = '#fcfcfc';
      L.set(x, y, c);
    }
  // wand sparks on the rim
  spr(L, 'smb3', 'wand-blast-0', 6, 40);
  spr(L, 'smb3', 'wand-blast-1', 236, 30);
  // shards flying out of the rift, one per hidden hero's world
  const found = [true, true, true, true, false, false, false];
  const W = 30;
  const H = 46;
  for (let i = 0; i < 7; i++) {
    const skew = (i - 3) * 2;
    const BW = W + Math.abs(skew) + 2;
    const sx = 6 + i * 35;
    const sy = 96 + [5, 1, 3, -1, 3, 1, 5][i]!;
    const world = shardWorld(i, BW, H, found[i]!);
    const a = skew > 0 ? 0 : -skew;
    const b = skew > 0 ? skew : 0;
    const left = (y: number) => Math.round(a + (b - a) * (y / (H - 1)));
    const inside = (x: number, y: number) => y >= 0 && y < H && x >= left(y) && x < left(y) + W;
    const frame = new Layer(BW, H);
    frame.clipFrom(world, 0, 0, inside);
    // bright border on the shard's edge
    for (let y = 0; y < H; y++)
      for (let x = 0; x < BW; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        if (edge) frame.set(x, y, found[i] ? '#fcfcfc' : '#7c7c7c');
      }
    frame.outline('#000000');
    L.paste(frame, sx, sy);
  }
  // logo over the rift
  const smb = logoWord('SMB', { sx: 2, sy: 2, grad: ['#fcfcfc'], lo: '#a4e4fc', outline: '#000000' });
  L.paste(smb, Math.round(128 - smb.w / 2), 8);
  const cross = logoWord('CROSSOVER', {
    sx: 3,
    sy: 4,
    grad: ['#fcfcfc', '#a4e4fc', '#3cbcfc', '#2038ec'],
    extrude: '#d800cc',
    depth: 3,
    outline: '#000000',
  });
  L.paste(cross, Math.round(128 - cross.w / 2) + 1, 26);
  // REMIX: a glitchy chromatic stamp
  const rm = new Layer(100, 30);
  const word = (c: string, ox: number) => {
    const m = logoWord('REMIX', { sx: 2, sy: 3, grad: [c] });
    rm.paste(m, 4 + ox, 6);
  };
  word('#3cbcfc', -2);
  word('#d800cc', 2);
  const core = logoWord('REMIX', { sx: 2, sy: 3, grad: ['#fcfcfc', '#fcfcfc', '#f878f8'], outline: '#000000' });
  rm.paste(core, 2, 4);
  // glitch slices: shove two rows sideways
  for (const [row, sh] of [
    [13, 2],
  ] as const) {
    const line: (ReturnType<Layer['get']>)[] = [];
    for (let x = 0; x < rm.w; x++) line.push(rm.get(x, row));
    for (let x = 0; x < rm.w; x++) {
      const c = line[x - sh];
      if (c) rm.set(x, row, c);
    }
  }
  rm.outline('#000000');
  L.paste(rm, 156, 72);
  text(L, 'CHAPTER 1', 30, 74, '#a4e4fc', '#000000');
  // Mario and Luigi watch from floating blocks beside the menu
  spr(L, 'tiles', 'used', 20, 184);
  spr(L, 'tiles', 'used', 220, 184);
  spr(L, 'mario', 'big-idle', 20, 152);
  spr(L, 'mario', 'big-idle', 220, 152, { pal: 'luigi', flip: true });
  // menu and credits
  menu(L, 146, 11, 88, '#fcfcfc', 0, '#f878f8');
  ctext(L, MADE, 196, '#f8d878');
  ctext(L, BASED1, 208, '#a4e4fc');
  ctext(L, BASED2, 217, '#a4e4fc');
  text(L, FAN, 4, 230, '#7c7c7c');
  text(L, VERSION, 252 - textW(VERSION), 230, '#7c7c7c');
  return L;
}

// ===================================================================== small logo "SMBC REMIX"
function smallLogo(): Layer {
  // variant 1: a 2x block "SMBC" with a tilted REMIX tab (about 100x30)
  const v1 = new Layer(112, 34);
  const w = logoWord('SMBC', {
    sx: 2,
    sy: 3,
    grad: ['#f8d878', '#f8b800', '#e45c10'],
    hi: '#fcfcfc',
    extrude: '#a81000',
    depth: 2,
    outline: '#000000',
  });
  v1.paste(w, 0, 2);
  const tab = new Layer(44, 13, '#f83800');
  tab.rect(0, 0, 44, 1, '#fca044');
  text(tab, 'REMIX', 3, 3, '#fcfcfc');
  const tl = new Layer(46, 15);
  tl.paste(tab, 1, 1);
  tl.outline('#000000');
  v1.paste(tl, 62, 18, 0.15);
  // variant 2: one text line, 8px tall, for HUD bars / page header
  const v2 = new Layer(92, 12);
  text(v2, 'SMBC', 1, 2, '#fcfcfc');
  v2.rect(36, 0, 46, 11, '#f83800');
  text(v2, 'REMIX', 40, 2, '#fcfcfc');
  v2.outline('#000000');
  // sheet: each variant on a dark and on a sky background
  const L = new Layer(256, 104, '#000000');
  L.rect(128, 0, 128, 104, '#5c94fc');
  for (const [ox, label, col] of [
    [0, 'ON DARK', '#7c7c7c'],
    [128, 'ON SKY', '#fcfcfc'],
  ] as const) {
    text(L, label, ox + 8, 4, col);
    L.paste(v1, ox + 8, 18);
    L.paste(v2, ox + 8, 62);
    text(L, 'ICON', ox + 8, 82, col);
    // 16x16 favicon-ish mark: "S" block with a red REMIX corner
    const ic = new Layer(16, 16, '#e45c10');
    ic.rect(0, 0, 16, 1, '#f8d878');
    ic.rect(0, 15, 16, 1, '#a81000');
    text(ic, 'S', 4, 2, '#fcfcfc');
    ic.rect(9, 10, 7, 6, '#f83800');
    text(ic, 'R', 9, 10, '#fcfcfc');
    const icl = new Layer(18, 18);
    icl.paste(ic, 1, 1);
    icl.outline('#000000');
    L.paste(icl, ox + 48, 79);
  }
  return L;
}

it('mockups', () => {
  const a = mockupA();
  a.save(`${OUT}/mockup-a-1x.png`);
  a.save(`${OUT}/mockup-a.png`, 3);
  const b = mockupB();
  b.save(`${OUT}/mockup-b-1x.png`);
  b.save(`${OUT}/mockup-b.png`, 3);
  const c = mockupC();
  c.save(`${OUT}/mockup-c-1x.png`);
  c.save(`${OUT}/mockup-c.png`, 3);
  const sl = smallLogo();
  sl.save(`${OUT}/logo-small-1x.png`);
  sl.save(`${OUT}/logo-small.png`, 3);
  const ov = new Layer(256 * 3 + 16, 240, '#202020');
  ov.paste(a, 0, 0);
  ov.paste(b, 264, 0);
  ov.paste(c, 528, 0);
  ov.save(`${OUT}/overview.png`, 2);
});
