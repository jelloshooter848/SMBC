// Tile fixes applied after conversion, so a regenerated map keeps them.
//
// The original Crossover data (levelDataSmb.xml) differs from the NES levels in many places on
// purpose (wider gaps for the classic hero, helper ground, extra enemies), and our maps keep those.
// A few one-tile differences have no reason behind them: compared against the NES maps cell by cell
// (the Chapter 1 finishing pass, 0.4.21), the owner chose to match the NES there, in all play. Each entry is
// one cell of one generated map: `from` is what the original data gives (a mismatch is reported
// and the cell left alone, so a changed source can't be patched blindly), `to` is the NES tile.
// Ids are unprefixed: they only touch SMB1's maps, never The Lost Levels' (`ll-...`).

export const NES_FIXES = [
  // 1-3: the starting ground ends at column 15; the original data adds column 16.
  { id: '1-3', x: 16, y: 13, from: '#', to: '.', why: "matches the NES; Crossover's data slip" },
  { id: '1-3', x: 16, y: 14, from: '#', to: '.', why: "matches the NES; Crossover's data slip" },
  // 2-4: the upper wall by the lifts spans columns 93-98; the original data starts it at 92.
  { id: '2-4', x: 92, y: 2, from: '%', to: '.', why: "matches the NES; Crossover's data slip" },
  { id: '2-4', x: 92, y: 3, from: '%', to: '.', why: "matches the NES; Crossover's data slip" },
  { id: '2-4', x: 92, y: 4, from: '%', to: '.', why: "matches the NES; Crossover's data slip" },
  // 4-2: the warp room's ceiling ends at column 218; the original data adds a brick at 219.
  { id: '4-2', x: 219, y: 2, from: '=', to: '.', why: "matches the NES; Crossover's data slip" },
  // 5-3: two coins over the first lift (85, 86); the original data adds a third at 87.
  { id: '5-3', x: 87, y: 5, from: '$', to: '.', why: "matches the NES; Crossover's data slip" },
  // 8-4's water section: open water above the exit pipe; the original data fills the cell.
  { id: '8-4-water', x: 68, y: 6, from: '#', to: '.', why: "matches the NES; Crossover's data slip" },
];

/** Applies the fixes for map `id` to a MapBuilder; returns how many cells changed. */
export function applyNesFixes(id, builder) {
  let n = 0;
  for (const f of NES_FIXES) {
    if (f.id !== id) continue;
    const had = builder.rows[f.y]?.[f.x];
    if (had !== f.from) {
      console.warn(`${id}: NES fix at ${f.x},${f.y} expected '${f.from}' but found '${had}'; left alone`);
      continue;
    }
    builder.set(f.x, f.y, f.to);
    n++;
  }
  return n;
}
