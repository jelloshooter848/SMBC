/**
 * MOCKUPS ONLY (claude/mockups-0471): `?mock=title:A,back:B,start:C` picks a mock variant per
 * item. Never shipped; the owner picks one and it is rebuilt properly.
 */
const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
const pairs = (params.get('mock') ?? '').split(',').filter(Boolean);
export const MOCK: Record<string, string> = Object.fromEntries(
  pairs.map((p) => {
    const [k, v] = p.split(':');
    return [k ?? '', v ?? ''];
  }),
);
export const mock = (k: string): string => MOCK[k] ?? '';
