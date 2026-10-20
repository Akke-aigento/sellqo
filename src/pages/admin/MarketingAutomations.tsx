import { Navigate, useLocation } from 'react-router-dom';
import { marketingAutomationsTarget } from '@/lib/marketing/marketingTabs';

/**
 * MAIL-UX-1 — Automatiseringen is een tabblad van Marketing → E-mail geworden.
 * Oude links (meldingen, bladwijzers, AI-coach) naar /admin/marketing/automations komen hier
 * binnen en gaan door naar /admin/marketing?tab=automations, mét hun query (bv. ?trigger=).
 */
export default function MarketingAutomationsRedirect() {
  const { search } = useLocation();
  return <Navigate to={marketingAutomationsTarget(search)} replace />;
}
