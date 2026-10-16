// SOCIAL-5 — rekenwerk voor de tab "Resultaten" in de Social planning.
// Pure functies (getest in src/test/socialResults.test.ts); de cijfers zelf komen uit
// social_posts.engagement_data, gevuld door de edge functie social-insights-sync.

export interface PostMetrics {
  reach?: number;
  views?: number;
  likes?: number;
  comments?: number;
  saved?: number;
  shares?: number;
  total_interactions?: number;
  follows?: number;
  profile_visits?: number;
  replies?: number;
  avg_watch_time_ms?: number;
}

export interface EngagementData {
  media_id?: string;
  permalink?: string | null;
  fetched_at?: string;
  source?: 'insights' | 'basic';
  matched?: boolean;
  low_volume?: boolean;
  metrics?: PostMetrics;
}

export interface MeasuredPost {
  id: string;
  media_type: string;
  posted_at: string;
  post_text?: string | null;
  image_urls?: string[] | null;
  engagement_data: EngagementData | null;
}

export type Daypart = 'morning' | 'midday' | 'afternoon' | 'evening' | 'late';
export const DAYPARTS: Daypart[] = ['morning', 'midday', 'afternoon', 'evening', 'late'];

/** Ochtend 5–10 u, middag 11–13 u, namiddag 14–17 u, avond 18–21 u, laat 22–4 u. */
export function daypartOf(hour: number): Daypart {
  if (hour >= 5 && hour <= 10) return 'morning';
  if (hour >= 11 && hour <= 13) return 'midday';
  if (hour >= 14 && hour <= 17) return 'afternoon';
  if (hour >= 18 && hour <= 21) return 'evening';
  return 'late';
}

/** Interacties: total_interactions als Instagram die geeft, anders de som van de delen. */
export function interactionsOf(m: PostMetrics | undefined): number | null {
  if (!m) return null;
  if (typeof m.total_interactions === 'number') return m.total_interactions;
  const parts = [m.likes, m.comments, m.saved, m.shares].filter((v): v is number => typeof v === 'number');
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

/** Interactiegraad in procent (interacties / bereik). Zonder bereik: null. */
export function engagementRate(m: PostMetrics | undefined): number | null {
  const reach = m?.reach;
  const inter = interactionsOf(m);
  if (!reach || reach <= 0 || inter === null) return null;
  return (inter / reach) * 100;
}

export function hasMetrics(p: MeasuredPost): boolean {
  const m = p.engagement_data?.metrics;
  return !!m && Object.keys(m).length > 0;
}

export interface Bucket<K extends string | number> {
  key: K;
  posts: number;
  /** Gemiddelde interactiegraad (%), enkel over posts met bereik. */
  avgRate: number | null;
  avgReach: number | null;
  avgInteractions: number | null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function bucket<K extends string | number>(key: K, posts: MeasuredPost[]): Bucket<K> {
  const ms = posts.map((p) => p.engagement_data?.metrics);
  return {
    key,
    posts: posts.length,
    avgRate: avg(ms.map(engagementRate).filter((v): v is number => v !== null)),
    avgReach: avg(ms.map((m) => m?.reach).filter((v): v is number => typeof v === 'number')),
    avgInteractions: avg(ms.map(interactionsOf).filter((v): v is number => v !== null)),
  };
}

/** Score om te rangschikken: interactiegraad als die er is, anders gemiddelde interacties. */
export function bucketScore(b: Bucket<string | number>, mode: 'rate' | 'interactions'): number {
  return (mode === 'rate' ? b.avgRate : b.avgInteractions) ?? -1;
}

export interface ResultsSummary {
  measured: number;
  /** true als geen enkele post bereik heeft: enkel likes en reacties (nog niet opnieuw gekoppeld). */
  basicOnly: boolean;
  mode: 'rate' | 'interactions';
  overall: Bucket<'all'>;
  byDaypart: Bucket<Daypart>[];
  /** 1 = maandag … 7 = zondag. */
  byWeekday: Bucket<number>[];
  byType: Bucket<string>[];
  top: MeasuredPost[];
}

/** Minimum aantal posts in een vak voor we het "beste" noemen. */
export const MIN_POSTS_PER_BUCKET = 3;

export function summarize(all: MeasuredPost[]): ResultsSummary {
  const posts = all.filter(hasMetrics);
  const withReach = posts.filter((p) => typeof p.engagement_data?.metrics?.reach === 'number');
  const mode: 'rate' | 'interactions' = withReach.length > 0 ? 'rate' : 'interactions';

  const group = <K extends string | number>(keyOf: (p: MeasuredPost) => K, keys: K[]) =>
    keys.map((k) => bucket(k, posts.filter((p) => keyOf(p) === k)));

  const byDaypart = group((p) => daypartOf(new Date(p.posted_at).getHours()), DAYPARTS);
  const byWeekday = group((p) => ((new Date(p.posted_at).getDay() + 6) % 7) + 1, [1, 2, 3, 4, 5, 6, 7]);
  const types = [...new Set(posts.map((p) => p.media_type))].sort();
  const byType = group((p) => p.media_type, types);

  const score = (p: MeasuredPost) => {
    const m = p.engagement_data?.metrics;
    return (mode === 'rate' ? engagementRate(m) : interactionsOf(m)) ?? -1;
  };
  const top = [...posts].sort((a, b) => score(b) - score(a)).slice(0, 5);

  return {
    measured: posts.length,
    basicOnly: posts.length > 0 && withReach.length === 0,
    mode,
    overall: bucket('all', posts),
    byDaypart,
    byWeekday,
    byType,
    top,
  };
}

/** Het beste vak met genoeg posts, of null. */
export function bestBucket<K extends string | number>(buckets: Bucket<K>[], mode: 'rate' | 'interactions'): Bucket<K> | null {
  const eligible = buckets.filter((b) => b.posts >= MIN_POSTS_PER_BUCKET && bucketScore(b, mode) >= 0);
  if (!eligible.length) return null;
  return eligible.reduce((best, b) => (bucketScore(b, mode) > bucketScore(best, mode) ? b : best));
}

export interface FollowerPoint {
  captured_on: string;
  followers_count: number | null;
}

/** Groei van het aantal volgers tussen de oudste en de nieuwste meting. */
export function followerGrowth(points: FollowerPoint[]): { current: number | null; delta: number | null; since: string | null } {
  const valid = points.filter((p) => typeof p.followers_count === 'number').sort((a, b) => a.captured_on.localeCompare(b.captured_on));
  if (!valid.length) return { current: null, delta: null, since: null };
  const first = valid[0];
  const last = valid[valid.length - 1];
  return {
    current: last.followers_count,
    delta: valid.length > 1 ? (last.followers_count! - first.followers_count!) : null,
    since: valid.length > 1 ? first.captured_on : null,
  };
}
