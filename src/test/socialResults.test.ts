// SOCIAL-5 — rekenwerk voor de tab "Resultaten": interactiegraad, dagdelen, beste vak, volgers.
import { describe, expect, it } from 'vitest';
import {
  bestBucket, daypartOf, engagementRate, followerGrowth, interactionsOf, scoreOf, summarize, type MeasuredPost,
} from '@/lib/social/results';

const at = (iso: string) => new Date(iso).toISOString();
const post = (id: string, localIso: string, metrics: Record<string, number>, media_type = 'image', tags?: Record<string, string>): MeasuredPost => ({
  id, media_type, posted_at: at(localIso), engagement_data: { source: 'insights', metrics }, content_tags: tags ?? null,
});

describe('social results', () => {
  it('dagdelen volgen de grenzen uit POSTTIJDEN', () => {
    expect([5, 10, 11, 13, 14, 17, 18, 21, 22, 3].map(daypartOf)).toEqual(
      ['morning', 'morning', 'midday', 'midday', 'afternoon', 'afternoon', 'evening', 'evening', 'late', 'late'],
    );
  });

  it('interacties: total_interactions gaat voor, anders de som', () => {
    expect(interactionsOf({ total_interactions: 9, likes: 100 })).toBe(9);
    expect(interactionsOf({ likes: 3, comments: 1, saved: 2 })).toBe(6);
    expect(interactionsOf({ reach: 10 })).toBeNull();
  });

  it('interactiegraad enkel met bereik', () => {
    expect(engagementRate({ reach: 200, total_interactions: 10 })).toBe(5);
    expect(engagementRate({ likes: 10 })).toBeNull();
    expect(engagementRate({ reach: 0, likes: 1 })).toBeNull();
  });

  it('beste dagdeel pas vanaf 3 posts, en top op interactiegraad', () => {
    const posts = [
      post('a', '2026-10-19T20:30:00', { reach: 100, likes: 10 }),
      post('b', '2026-10-20T20:10:00', { reach: 100, likes: 8 }),
      post('c', '2026-10-21T19:45:00', { reach: 100, likes: 6 }),
      post('d', '2026-10-22T08:30:00', { reach: 100, likes: 2, saved: 10 }),
      { id: 'e', media_type: 'image', posted_at: at('2026-10-23T12:00:00'), engagement_data: null },
    ];
    const s = summarize(posts);
    expect(s.measured).toBe(4);
    expect(s.mode).toBe('score');
    expect(bestBucket(s.byDaypart, s.mode)?.key).toBe('evening'); // ochtend heeft maar 1 post
    expect(s.top[0].id).toBe('d');
    expect(s.byWeekday.find((b) => b.key === 1)?.posts).toBe(1);
  });

  it('zonder bereik: modus interacties en basicOnly', () => {
    const s = summarize([post('a', '2026-10-19T20:30:00', { likes: 4, comments: 1 })]);
    expect(s.mode).toBe('interactions');
    expect(s.basicOnly).toBe(true);
  });

  it('volgersgroei tussen oudste en nieuwste meting', () => {
    expect(followerGrowth([
      { captured_on: '2026-10-20', followers_count: 130 },
      { captured_on: '2026-10-16', followers_count: 100 },
      { captured_on: '2026-10-18', followers_count: null },
    ])).toEqual({ current: 130, delta: 30, since: '2026-10-16' });
    expect(followerGrowth([])).toEqual({ current: null, delta: null, since: null });
  });

  it('score: bewaren, delen en volgen wegen zwaarder dan likes', () => {
    expect(scoreOf({ reach: 100, likes: 10 })).toBe(10);
    expect(scoreOf({ reach: 100, saved: 2, shares: 1, follows: 1, comments: 1 })).toBe(16);
    expect(scoreOf({ likes: 5 })).toBeNull();
  });

  it('48-uursmeting gaat voor op de laatste meting', () => {
    const p: MeasuredPost = {
      id: 'x', media_type: 'image', posted_at: at('2026-10-19T20:30:00'),
      engagement_data: { metrics: { reach: 100, likes: 50 } },
      engagement_48h: { metrics: { reach: 100, likes: 10 } },
    };
    expect(summarize([p]).overall.avgScore).toBe(10);
  });

  it('per label gerangschikt, ongelabelde posts tellen niet mee', () => {
    const s = summarize([
      post('a', '2026-10-19T20:30:00', { reach: 100, likes: 5 }, 'image', { format: 'Productfoto', hook: 'vraag' }),
      post('b', '2026-10-20T20:30:00', { reach: 100, saved: 10 }, 'image', { format: 'strip' }),
      post('c', '2026-10-21T20:30:00', { reach: 100, likes: 1 }),
    ]);
    expect(s.byTag.format?.map((b) => b.key)).toEqual(['strip', 'productfoto']);
    expect(s.byTag.hook?.[0].posts).toBe(1);
    expect(s.byTag.pillar).toBeUndefined();
  });
});
