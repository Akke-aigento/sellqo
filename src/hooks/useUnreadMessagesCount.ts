import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export function useUnreadMessagesCount() {
  const { currentTenant } = useTenant();
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUnreadCount = async () => {
    if (!currentTenant?.id) {
      setCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const { count: unreadCount, error } = await supabase
        .from('customer_messages')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('direction', 'inbound')
        .is('read_at', null);

      if (error) throw error;
      setCount(unreadCount || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    if (!currentTenant?.id) return;

    // Realtime subscription for updates
    const channel = supabase
      .channel('inbox-unread-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_messages',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id]);

  return { count, isLoading, refetch: fetchUnreadCount };
}
