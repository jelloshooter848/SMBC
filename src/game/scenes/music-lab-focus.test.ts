import { describe, expect, it } from 'vitest';
import { LEAVE_EDITOR_HELP, focusAfterAnswer, openLayer, panelMarkup, tabTarget } from './music-lab';

/*
 * Pre-0.5.0 items 258, 260, 261 and 267 (break-it review), tests first: Music Lab's focus rules
 * as pure functions, and its panel markup as text, so they are tested without a DOM.
 */

describe('267: where Tab goes', () => {
  const panel = 'panel';
  const stops = ['help', 'back', 'play', 'textarea'];

  it('inside the list, the browser moves on (null)', () => {
    expect(tabTarget(stops, 'back', panel, false)).toBeNull();
    expect(tabTarget(stops, 'play', panel, true)).toBeNull();
    expect(tabTarget(stops, 'help', panel, false)).toBeNull();
    expect(tabTarget(stops, 'textarea', panel, true)).toBeNull();
  });

  it('Tab on the last comes round to the first; Shift+Tab on the first to the last', () => {
    expect(tabTarget(stops, 'textarea', panel, false)).toBe('help');
    expect(tabTarget(stops, 'help', panel, true)).toBe('textarea');
  });

  it('from the panel itself, or from outside it (the page), Tab goes to the first, Shift+Tab to the last', () => {
    expect(tabTarget(stops, panel, panel, false)).toBe('help');
    expect(tabTarget(stops, panel, panel, true)).toBe('textarea');
    expect(tabTarget(stops, 'body', panel, false)).toBe('help');
    expect(tabTarget(stops, null, panel, true)).toBe('textarea');
  });

  it('one control (the help page’s Close): Tab stays on it', () => {
    expect(tabTarget(['close'], 'close', panel, false)).toBe('close');
    expect(tabTarget(['close'], 'close', panel, true)).toBe('close');
  });

  it('nothing to reach: nothing done', () => {
    expect(tabTarget([], 'body', panel, false)).toBeNull();
  });
});

describe('260: what stays live', () => {
  it('a question, else the open help page, else everything', () => {
    expect(openLayer(true, false)).toBe('question');
    expect(openLayer(true, true)).toBe('question');
    expect(openLayer(false, true)).toBe('help');
    expect(openLayer(false, false)).toBeNull();
  });
});

describe('258: focus after a question', () => {
  it('clearing: back on Clear song library while it shows, else the text', () => {
    expect(focusAfterAnswer('clear', true)).toBe('clear');
    expect(focusAfterAnswer('clear', false)).toBe('text');
  });

  it('adding a shared song: the text', () => {
    expect(focusAfterAnswer('add', true)).toBe('text');
    expect(focusAfterAnswer('add', false)).toBe('text');
  });
});

describe('261 and Go to error: the panel markup', () => {
  const html = panelMarkup();
  const help = html.slice(html.indexOf('<section class="help-page"'), html.indexOf('</section>'));
  const said = LEAVE_EDITOR_HELP.replace(/&/g, '&amp;');

  it('the help page says how to leave the text', () => {
    expect(help).toContain(`<p>${said}</p>`);
  });

  it('the text box is described by the status line and the leaving text', () => {
    expect(html).toMatch(/<textarea[^>]*aria-describedby="music-lab-status music-lab-keys"/);
    expect(html).toContain(`id="music-lab-keys">${said}</span>`);
  });

  it('Go to error sits beside the status line, not in it', () => {
    expect(html).toMatch(
      /<p class="status" id="music-lab-status"><\/p>\s*<button[^>]*data-act="go-to-error"/,
    );
  });
});
