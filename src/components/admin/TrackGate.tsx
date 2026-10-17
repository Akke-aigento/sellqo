// TRACKS-1 — bewaakt elke adminpagina op het spoor van de winkel.
// Dezelfde regels als het menu: de `tracks` op de NavItems in sidebarConfig. Wie een URL
// intikt buiten zijn pakket (bv. /admin/keuken zonder horeca), krijgt de uitlegkaart
// in plaats van de pagina. Platformadmins in beheerweergave zien alles.
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { findTrackRule } from '@/components/admin/sidebar/sidebarConfig';
import { useTracks } from '@/hooks/useBusinessModules';
import { ModuleOffCard } from '@/components/admin/ModuleOffCard';

export function TrackGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { hasTrack, ready } = useTracks();
  const rule = findTrackRule(pathname);

  if (!rule || rule.tracks.length === 0) return <>{children}</>;
  if (!ready) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (rule.tracks.some(hasTrack)) return <>{children}</>;
  return <ModuleOffCard module={rule.tracks[0]} />;
}
