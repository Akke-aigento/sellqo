import { Link } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useTracks } from '@/hooks/useBusinessModules';
import { useNavItemVisibility } from '@/components/admin/sidebar/useNavItemVisibility';
import { findNavItems } from '@/components/admin/sidebar/sidebarConfig';

/**
 * DASH-2a — grote "Tickets scannen"-knop bovenaan voor winkels met het events-spoor,
 * altijd (ook buiten eventdagen). Zichtbaar onder dezelfde regels als het zijbalk-item
 * ticket-checkin. Dat kind-item heeft zelf geen `tracks` (die staan op de parent
 * event-dashboard), dus het spoor checken we hier apart.
 */
export function TicketScanButton() {
  const { t } = useTranslation();
  // Bewust `tracks` en niet `hasTrack`: hasTrack is altijd true voor een platformadmin in
  // beheerweergave, waardoor de knop dan bij elke winkel verscheen. Alleen het echte
  // events-spoor van de winkel telt (events-pakket, events-add-on of ontgrendeling).
  const { tracks, ready } = useTracks();
  const { isItemBlocked } = useNavItemVisibility();
  const item = findNavItems(['ticket-checkin'])[0];

  if (!ready || !item || !tracks.includes('events') || isItemBlocked(item)) return null;

  return (
    <Button asChild size="lg" className="h-14 w-full gap-3 text-base font-semibold md:w-auto md:self-start md:px-8">
      <Link to={item.url}>
        <ScanLine className="h-5 w-5" aria-hidden="true" />
        {t('admin.cockpit.scan_tickets')}
      </Link>
    </Button>
  );
}
