// MEDIA-3 + SOCIAL-SEC-1 (16-10-2026) — gedeelde, pure helpers voor contentverzoeken.
//
// De afrekening, rolcontrole en limieten zitten in de RPC's request_social_content en
// request_social_regenerate (migratie 20261016210000). De app toont enkel de kost en vertaalt
// de foutsleutels die de RPC's teruggeven.

export type SocialContentKind = 'post' | 'story' | 'reel';

export const SOCIAL_CONTENT_KINDS: readonly SocialContentKind[] = ['post', 'story', 'reel'];

/** Zelfde bedragen als de RPC's. Een reel is duurder: video, muziekvoorstel, meer werk. */
export const SOCIAL_CONTENT_COST: Record<SocialContentKind, number> = { post: 10, story: 10, reel: 25 };

/** Maximaal aantal beelden per verzoek (check in de tabel en de RPC). */
export const SOCIAL_CONTENT_MAX_ASSETS = 10;

/** Kost van "Opnieuw maken" voor een bestaande post: reel 25, de rest 10. */
export function regenerateCost(mediaType: string | null | undefined): number {
  return mediaType === 'reel' ? SOCIAL_CONTENT_COST.reel : SOCIAL_CONTENT_COST.post;
}

/** Kost van een contentverzoek per soort; onbekende soort = post. */
export function contentRequestCost(kind: string | null | undefined): number {
  return SOCIAL_CONTENT_COST[(kind as SocialContentKind)] ?? SOCIAL_CONTENT_COST.post;
}

export type SocialRpcErrorCode =
  | 'no_access'
  | 'no_pipeline'
  | 'not_found'
  | 'invalid_state'
  | 'invalid_input'
  | 'rate_limit'
  | 'insufficient_credits'
  | 'guard_forbidden'
  | 'unknown';

const KNOWN: readonly SocialRpcErrorCode[] = [
  'no_access', 'no_pipeline', 'not_found', 'invalid_state', 'invalid_input',
  'rate_limit', 'insufficient_credits', 'guard_forbidden',
];

/**
 * Zet een fout van een van de social-RPC's om naar een vaste code. De RPC's geven als
 * message 'social_<code>'; PostgREST levert die in error.message. Rechtenfouten van PostgREST
 * zelf (42501 zonder onze sleutel, bv. "permission denied for function") tellen als no_access.
 */
export function socialRpcErrorCode(err: unknown): SocialRpcErrorCode {
  const e = (err ?? {}) as { message?: unknown; code?: unknown };
  const message = typeof e.message === 'string' ? e.message : String(err ?? '');
  const m = message.match(/social_([a-z_]+)/);
  if (m && (KNOWN as readonly string[]).includes(m[1])) return m[1] as SocialRpcErrorCode;
  if (e.code === '42501' || /permission denied/i.test(message)) return 'no_access';
  return 'unknown';
}

/** i18n-key voor een foutcode (namespace admin.socialContent.errors). */
export function socialRpcErrorKey(code: SocialRpcErrorCode): string {
  return `admin.socialContent.errors.${code}`;
}

/** Beelden die mee kunnen in een verzoek: enkel echte bibliotheekrijen, uniek, max 10. */
export function pickRequestAssetIds(ids: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!id || out.includes(id)) continue;
    out.push(id);
  }
  return out.slice(0, SOCIAL_CONTENT_MAX_ASSETS);
}

/** Gewenste datum: leeg = geen voorkeur; anders vandaag t/m +90 dagen (zoals de RPC). */
export function isValidWantedFor(value: string, today: Date = new Date()): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((d.getTime() - base) / 86_400_000);
  return diff >= 0 && diff <= 90;
}

export interface TagCount {
  tag: string;
  count: number;
}

/** Tags van de getoonde beelden, meest gebruikte eerst, dan alfabetisch. Hoofdletterongevoelig ontdubbeld. */
export function collectTags(assets: { tags?: string[] | null }[], limit = 30): TagCount[] {
  const counts = new Map<string, TagCount>();
  for (const a of assets) {
    const seen = new Set<string>();
    for (const raw of a.tags ?? []) {
      const tag = raw?.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = counts.get(key);
      if (cur) cur.count++;
      else counts.set(key, { tag, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

/** Heeft dit beeld alle gekozen tags (EN-filter, hoofdletterongevoelig)? Geen keuze = altijd. */
export function matchesTags(assetTags: string[] | null | undefined, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const have = new Set((assetTags ?? []).map((t) => t.trim().toLowerCase()));
  return selected.every((t) => have.has(t.toLowerCase()));
}
