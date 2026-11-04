// UREN-1b — het themaschema van de standaardshop (presets met hun woordenschat), één keer per winkel opgehaald.
// Faalt het ophalen, dan `undefined`: wie het gebruikt, toont dan niets (nooit een valse tip).
import { useQuery } from '@tanstack/react-query';
import { shopOrigin } from '@/lib/shopOrigin';
import type { ThemeSchema } from '@/components/admin/storefront/schema/schemaTypes';

export function useThemeSchema(slug: string | undefined) {
  return useQuery({
    queryKey: ['theme-schema', slug],
    enabled: !!slug,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const r = await fetch(`${shopOrigin(slug!)}/theme/schema.json`, { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as ThemeSchema;
    },
  });
}

/** Is dit thema (preset-id) een horecathema? Onbekend = nee. */
export function isHorecaPreset(schema: ThemeSchema | undefined, presetId: unknown): boolean {
  return !!schema?.presets?.some((p) => p.id === presetId && p.vocabulary === 'horeca');
}
