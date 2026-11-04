// HORECA-INSTELLINGEN-1 — gedeelde schermen (Kassa-instellingen, posten, QR aan tafel, …) linken naar
// "de plek waar je dat regelt". Voor horeca-only is dat sinds deze batch Mijn zaak of Personeel; voor
// elke andere zaak blijft de link precies zoals hij was.
import { useCallback } from 'react';
import { useTracks } from '@/hooks/useBusinessModules';
import { isHorecaOnly } from '@/lib/tracks';
import { resolveLegacyHref } from '@/lib/mijnZaak';

export function useHorecaHref(): (href: string) => string {
  const { hasTrack } = useTracks();
  const only = isHorecaOnly(hasTrack);
  return useCallback((href: string) => (only ? resolveLegacyHref(href) : href), [only]);
}
