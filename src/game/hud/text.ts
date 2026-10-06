/** Characters the bitmap font can draw (besides letters, digits and space). */
const FONT_MARKS = new Set(['-', '.', '!', '?', ',', '×', '©', '>', '$', ':', '/', '%', '+', '(', ')', "'"]);

/** Upper-case a string and drop anything the font has no glyph for. */
export function fontText(text: string): string {
  let out = '';
  for (const ch of text.toUpperCase()) {
    if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === ' ' || FONT_MARKS.has(ch)) out += ch;
    else if (ch === '’' || ch === '`') out += "'";
    else if (ch === '–' || ch === '—') out += '-';
    else if (ch === '&') out += '+';
  }
  return out;
}

/** Break text into lines of at most `cols` characters on spaces (a single long word is cut). */
export function wrapText(text: string, cols: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n').map((t) => fontText(t))) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (w.length > cols) {
        if (line) {
          lines.push(line);
          line = '';
        }
        lines.push(w.slice(0, cols));
        w = w.slice(cols);
      }
      if (!line) line = w;
      else if (line.length + 1 + w.length <= cols) line += ` ${w}`;
      else {
        lines.push(line);
        line = w;
      }
    }
    lines.push(line);
  }
  // Collapse a trailing empty line left by a terminating newline.
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}
