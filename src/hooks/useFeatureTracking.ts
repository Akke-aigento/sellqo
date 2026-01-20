import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

type ActionType = 'click' | 'view' | 'submit' | 'navigate';

interface TrackOptions {
  elementId?: string;
  metadata?: Record<string, unknown>;
}

export function useFeatureTracking() {
  const { currentTenant } = useTenant();
  const location = useLocation();
  const sessionId = useRef<string>(
    sessionStorage.getItem('tracking_session_id') || crypto.randomUUID()
  );

  useEffect(() => {
    sessionStorage.setItem('tracking_session_id', sessionId.current);
  }, []);

  const trackFeature = useCallback(
    async (featureName: string, actionType: ActionType, options?: TrackOptions) => {
      if (!currentTenant?.id) return;

      try {
        // Feature usage tracking - silent insert
        const { error } = await supabase.from('feature_usage_events').insert([{
          tenant_id: currentTenant.id,
          feature_name: featureName,
          page_path: location.pathname,
          action_type: actionType,
          element_id: options?.elementId || null,
          metadata: (options?.metadata || {}) as Record<string, string | number | boolean>,
          session_id: sessionId.current,
        }]);
        if (error) console.debug('Tracking insert error:', error);
      } catch (error) {
        console.debug('Feature tracking failed:', error);
      }
    },
    [currentTenant?.id, location.pathname]
  );

  const createTrackedHandler = useCallback(
    (featureName: string, handler?: () => void, options?: TrackOptions) => {
      return () => {
        trackFeature(featureName, 'click', options);
        handler?.();
      };
    },
    [trackFeature]
  );

  return {
    trackFeature,
    createTrackedHandler,
  };
}
