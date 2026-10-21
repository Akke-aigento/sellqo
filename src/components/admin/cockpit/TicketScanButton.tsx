import { Link } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useTracks } from '@/hooks/useBusinessModules';
import { useNavItemVisibility } from '@/components/admin/sidebar/useNavItemVisibility';
import { findNavItems } from '@/components/admin/sidebar/sidebarConfig';
import { cn } from '@/lib/utils';

/** Mag deze gebruiker bij deze winkel tickets scannen? Zelfde regels als het zijbalk-item. */
function useCanScanTickets(): boolean {
  // Bewust `tracks` en niet `hasTrack`: hasTrack is altijd true voor een platformadmin in
  // beheerweergave, waardoor de knop dan bij elke winkel verscheen. Alleen het echte
  // events-spoor van de winkel telt (events-pakket, events-add-on of ontgrendeling).
  const { tracks, ready } = useTracks();
  const { isItemBlocked } = useNavItemVisibility();
  const item = findNavItems(['ticket-checkin'])[0];
  return ready && !!item && tracks.includes('events') && !isItemBlocked(item);
}

/**
 * DASH-2a/2b — grote "Tickets scannen"-knop voor winkels met het events-spoor, altijd
 * zichtbaar (ook buiten eventdagen). Staat sinds DASH-2b in de eventhero.
 */
export function TicketScanButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const allowed = useCanScanTickets();
  const item = findNavItems(['ticket-checkin'])[0];
  if (!allowed || !item) return null;

  return (
    <Button
      asChild
      size="lg"
      className={cn('h-14 w-full gap-3 rounded-xl bg-[#FF6B33] text-base font-bold text-white hover:bg-[#F25A20]', className)}
    >
      <Link to={item.url}>
        <ScanLine className="h-5 w-5" aria-hidden="true" />
        {t('admin.cockpit.scan_tickets')}
      </Link>
    </Button>
  );
}
