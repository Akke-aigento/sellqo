import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { initDeepLinks } from '@/native/deepLinks';

/**
 * Registreert de native deep-link-listener, app-breed en één keer.
 *
 * Hoort binnen BrowserRouter te staan (het gebruikt useNavigate) en náást
 * ScrollToTop, niet in useAuth: een deep link kan binnenkomen terwijl niemand
 * is ingelogd — denk aan een betaalretour die de app koud opstart.
 *
 * Rendert niets. Op web doet initDeepLinks niets.
 */
export function DeepLinkListener() {
  const navigate = useNavigate();

  useEffect(() => initDeepLinks(navigate), [navigate]);

  return null;
}
