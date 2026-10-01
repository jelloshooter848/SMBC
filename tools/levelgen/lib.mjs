// Small helper DSL for authoring .map files from coordinates. The generated .map is the
// source of truth that gets committed; this just keeps placement exact.
export class MapBuilder {
  constructor(width, header) {
    this.width = width;
    this.header = header;
    this.rows = Array.from({ length: 15 }, () => Array(width).fill('.'));
    this.entities = [];
    this.zones = [];
    this.decor = [];
  }
  set(x, y, ch) {
    if (x < 0 || x >= this.width || y < 0 || y > 14) throw new Error(`out of bounds ${x},${y}`);
    this.rows[y][x] = ch;
  }
  fill(x0, y0, x1, y1, ch) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, ch);
  }
  /** Ground rows 13-14 across [x0, x1]. */
  ground(x0, x1, ch = '#') {
    this.fill(x0, 13, x1, 14, ch);
  }
  /** Vertical pipe, left column x, `h` tiles tall, standing on row 13. */
  pipe(x, h, groundRow = 13) {
    const top = groundRow - h;
    this.set(x, top, '[');
    this.set(x + 1, top, ']');
    for (let y = top + 1; y < groundRow; y++) {
      this.set(x, y, '{');
      this.set(x + 1, y, '}');
    }
    return top;
  }
  /** Row of chars at row y from x0. */
  row(x0, y, str) {
    for (let i = 0; i < str.length; i++) if (str[i] !== ' ') this.set(x0 + i, y, str[i]);
  }
  /** Stair rising to the right: columns x..x+n-1 with heights 1..n (hard blocks). */
  stairUp(x, n, groundRow = 13, ch = 'B') {
    for (let i = 0; i < n; i++) this.fill(x + i, groundRow - (i + 1), x + i, groundRow - 1, ch);
  }
  stairDown(x, n, groundRow = 13, ch = 'B') {
    for (let i = 0; i < n; i++) this.fill(x + i, groundRow - (n - i), x + i, groundRow - 1, ch);
  }
  column(x, h, groundRow = 13, ch = 'B') {
    this.fill(x, groundRow - h, x, groundRow - 1, ch);
  }
  /** Flagpole: base block at (x, groundRow-1), shaft above, ball at top. */
  flagpole(x, groundRow = 13) {
    this.set(x, groundRow - 1, 'B');
    for (let y = groundRow - 2; y >= 2; y--) this.set(x, y, '!');
    this.set(x, 1, 'o');
  }
  entity(type, x, y, props) {
    this.entities.push({ type, x, y, props });
  }
  zone(line) {
    this.zones.push(line);
  }
  dec(kind, x, y) {
    this.decor.push(`${kind} ${x} ${y}`);
  }
  toString() {
    const out = [];
    for (const [k, v] of Object.entries(this.header)) out.push(`${k}: ${v}`);
    out.push('', '[tiles]');
    const ruler = [];
    for (let s = 0; s * 16 < this.width; s++) ruler.push(String(s * 16).padEnd(16));
    out.push(`;; ${ruler.join(' ').trimEnd()}`);
    for (const r of this.rows) {
      const groups = [];
      for (let s = 0; s < this.width; s += 16) groups.push(r.slice(s, s + 16).join(''));
      out.push(groups.join(' '));
    }
    if (this.entities.length) {
      out.push('', '[entities]');
      for (const e of this.entities) {
        const props = e.props
          ? ' ' +
            Object.entries(e.props)
              .map(([k, v]) => `${k}=${v}`)
              .join(' ')
          : '';
        out.push(`${e.type} ${e.x} ${e.y}${props}`);
      }
    }
    if (this.zones.length) out.push('', '[zones]', ...this.zones);
    if (this.decor.length) out.push('', '[decor]', ...this.decor);
    return out.join('\n') + '\n';
  }
}

/** Standard SMB1 overworld background: hills, bushes and clouds repeat every 48 columns. */
export function overworldDecor(b, width) {
  for (let base = 0; base < width; base += 48) {
    const d = (kind, x, y) => x < width && b.dec(kind, x, y);
    d('hill-big', base + 0, 12);
    d('cloud-1', base + 8, 3);
    d('bush-3', base + 11, 12);
    d('hill-small', base + 16, 12);
    d('cloud-1', base + 19, 2);
    d('bush-1', base + 23, 12);
    d('cloud-3', base + 27, 3);
    d('cloud-2', base + 36, 2);
    d('bush-2', base + 41, 12);
  }
}
