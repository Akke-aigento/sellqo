import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import { useNotificationSound } from './useNotificationSound';
import { useQueryClient } from '@tanstack/react-query';

interface NotificationPayload {
  id: string;
  tenant_id: string;
  category: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  action_url: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Global notification listener that plays sounds and shows toasts
 * for ALL notification types across the entire admin area.
 * 
 * This should be used in AdminLayout to ensure notifications work
 * on every admin page, not just the Messages page.
 */
export function useGlobalNotificationListener() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { playSound, enabled: soundEnabled } = useNotificationSound();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!currentTenant?.id) return;

    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        (payload) => {
          const notification = payload.new as NotificationPayload;
          
          // Play sound for all new notifications
          playSound();
          
          // Invalidate notifications query to update badge counts
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          
          // Show toast with notification details
          toast({
            title: notification.title,
            description: notification.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, toast, playSound, queryClient]);
}
