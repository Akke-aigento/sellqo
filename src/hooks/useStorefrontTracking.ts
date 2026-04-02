import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface TrackingConfig {
  tenantId: string;
  storefrontCustomerId?: string | null;
}

interface TrackableEvent {
  tenant_id: string;
  event_type: string;
  session_id: string;
  storefront_customer_id?: string;
  event_data?: Record<string, unknown>;
  page_url?: string;
  referrer_url?: string;
}

const FLUSH_INTERVAL = 5000;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function useStorefrontTracking(config: TrackingConfig) {
  const location = useLocation();
  const queue = useRef<TrackableEvent[]>([]);
  const pageEnteredAt = useRef<number>(Date.now());
  const lastPath = useRef<string>('');

  const sessionId = useRef<string>(
    sessionStorage.getItem('sf_tracking_session') || (() => {
      const id = crypto.randomUUID();
      sessionStorage.setItem('sf_tracking_session', id);
      return id;
    })()
  );

  const flush = useCallback(async () => {
    if (queue.current.length === 0 || !SUPABASE_URL) return;
    const events = [...queue.current];
    queue.current = [];

    try {
      await fetch(`${SUPABASE_URL}/functions/v1/track-storefront-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        keepalive: true,
      });
    } catch {
      // Silent fail — tracking should never block UX
    }
  }, []);

  const trackEvent = useCallback(
    (eventType: string, eventData?: Record<string, unknown>) => {
      if (!config.tenantId) return;

      const event: TrackableEvent = {
        tenant_id: config.tenantId,
        event_type: eventType,
        session_id: sessionId.current,
        page_url: window.location.pathname,
        referrer_url: document.referrer || undefined,
        event_data: eventData,
      };

      if (config.storefrontCustomerId) {
        event.storefront_customer_id = config.storefrontCustomerId;
      }

      queue.current.push(event);
    },
    [config.tenantId, config.storefrontCustomerId]
  );

  // Auto page_view tracking
  useEffect(() => {
    if (!config.tenantId) return;

    // Send time_on_page for previous page
    if (lastPath.current && lastPath.current !== location.pathname) {
      const duration = Math.round((Date.now() - pageEnteredAt.current) / 1000);
      if (duration > 0) {
        trackEvent('page_view', {
          page_url: lastPath.current,
          duration_seconds: duration,
          is_exit: true,
        });
      }
    }

    lastPath.current = location.pathname;
    pageEnteredAt.current = Date.now();

    trackEvent('page_view', { page_url: location.pathname });
  }, [location.pathname, config.tenantId, trackEvent]);

  // Flush interval + beforeunload
  useEffect(() => {
    const interval = setInterval(flush, FLUSH_INTERVAL);

    const handleUnload = () => {
      const duration = Math.round((Date.now() - pageEnteredAt.current) / 1000);
      if (duration > 0 && lastPath.current) {
        trackEvent('page_view', {
          page_url: lastPath.current,
          duration_seconds: duration,
          is_exit: true,
        });
      }
      flush();
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      flush();
    };
  }, [flush, trackEvent]);

  return { trackEvent };
}
