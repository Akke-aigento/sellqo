// WERKPLEK-1 — mag de huidige winkel naar deze adminroute?
//
// Zelfde regel als het menu en TrackGate (de `tracks` op de NavItems in sidebarConfig).
// Gebruik dit voor een link vanuit een gedeeld scherm naar een pagina die niet in elk
// pakket bestaat (bv. orderdetail → klant, productformulier → vertalingen). Zo leidt geen
// enkele knop naar de kaart "niet in je pakket".
import { useCallback } from 'react';
import { findTrackRule } from '@/components/admin/sidebar/sidebarConfig';
import { useTracks } from '@/hooks/useBusinessModules';

export function useRouteAllowed() {
  const { hasTrack } = useTracks();
  return useCallback((path: string): boolean => {
    const rule = findTrackRule(path.split(/[?#]/)[0]);
    if (!rule || rule.tracks.length === 0) return true;
    return rule.tracks.some(hasTrack);
  }, [hasTrack]);
}
