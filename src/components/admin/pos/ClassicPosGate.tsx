// WERKPLEK-1 — de klassieke kassa (/admin/pos/:terminalId) bestaat enkel voor winkels met het
// webshopspoor. Een horecawinkel zonder webshop werkt met SellQo Kassa (/kassa); een oude
// link of bladwijzer gaat daar rechtstreeks naartoe (beslissing 24-10: /admin/pos uitfaseren).
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTracks } from '@/hooks/useBusinessModules';

export function ClassicPosGate({ children }: { children: ReactNode }) {
  const { hasTrack, ready } = useTracks();
  if (!ready) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!hasTrack('webshop')) return <Navigate to="/kassa" replace />;
  return <>{children}</>;
}
