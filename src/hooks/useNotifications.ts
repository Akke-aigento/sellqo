import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import type { Notification, NotificationCategory } from '@/types/notification';
import { useToast } from '@/hooks/use-toast';

export function useNotifications() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const typedData = (data || []).map(n => ({
        ...n,
        category: n.category as NotificationCategory,
        priority: n.priority as Notification['priority'],
        data: (n.data || {}) as Record<string, unknown>,
      }));

      setNotifications(typedData);
      setUnreadCount(typedData.filter(n => !n.read_at).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!currentTenant?.id) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          // Toast wordt afgehandeld door useGlobalNotificationListener
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications(prev =>
            prev.map(n => (n.id === updated.id ? updated : n))
          );
          // Recalculate unread
          setNotifications(prev => {
            setUnreadCount(prev.filter(n => !n.read_at).length);
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setNotifications(prev => prev.filter(n => n.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, toast]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!currentTenant?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('tenant_id', currentTenant.id)
        .is('read_at', null);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const notification = notifications.find(n => n.id === id);
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notification && !notification.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const deleteAllRead = async () => {
    if (!currentTenant?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('tenant_id', currentTenant.id)
        .not('read_at', 'is', null);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => !n.read_at));
    } catch (error) {
      console.error('Error deleting read notifications:', error);
    }
  };

  const filterByCategory = (category: NotificationCategory | 'all') => {
    if (category === 'all') return notifications;
    return notifications.filter(n => n.category === category);
  };

  const getUnreadByCategory = () => {
    const counts: Record<string, number> = {};
    notifications
      .filter(n => !n.read_at)
      .forEach(n => {
        counts[n.category] = (counts[n.category] || 0) + 1;
      });
    return counts;
  };

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    filterByCategory,
    getUnreadByCategory,
    refetch: fetchNotifications,
  };
}
