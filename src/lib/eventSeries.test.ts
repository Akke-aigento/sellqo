import { describe, expect, it } from 'vitest';
import { slugBase, uniqueSlug, weeklyDates } from './eventSeries';

describe('eventSeries', () => {
  it('builds a weekly series on the same weekday, across month ends', () => {
    expect(weeklyDates('2026-10-24', 3)).toEqual(['2026-10-24', '2026-10-31', '2026-11-07']);
  });
  it('caps a series at 52 weeks and rejects bad input', () => {
    expect(weeklyDates('2026-10-24', 100)).toHaveLength(52);
    expect(weeklyDates('24/10/2026', 3)).toEqual([]);
  });
  it('makes clean slugs, also from accents', () => {
    expect(slugBase('Fonske Crawl — Café Édition!')).toBe('fonske-crawl-cafe-edition');
    expect(slugBase('???')).toBe('event');
  });
  it('picks the first free slug', () => {
    expect(uniqueSlug('crawl', [])).toBe('crawl');
    expect(uniqueSlug('crawl', ['crawl', 'crawl-2'])).toBe('crawl-3');
  });
});
