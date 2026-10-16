// MARKETING-2 — de AI Content Hub (/admin/marketing/ai) bestaat niet meer als aparte plek.
// Oude links, meldingen en de terugkeer uit de Stripe-checkout voor AI-credits
// (create-ai-credits-checkout: success_url/cancel_url) komen hier binnen en gaan naar de nieuwe
// plek, met hun parameters (purchase, credits, session_id, product).

import { Navigate, useLocation } from 'react-router-dom';
import { aiHubTarget } from '@/lib/marketing/aiHubTarget';

export function AIHubRedirect() {
  const { search } = useLocation();
  return <Navigate to={aiHubTarget(search)} replace />;
}
