import { useEffect, useState } from 'react';
import { Activity, Mail, MousePointerClick, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

interface ActivityItem {
  id: string;
  type: 'opened' | 'clicked' | 'delivered' | 'bounced';
  email: string;
  campaign_name?: string;
  timestamp: string;
}

export function RealtimeActivityFeed() {
  const { currentTenant } = useTenant();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!currentTenant?.id) return;

    // Fetch initial recent activity
    const fetchRecentActivity = async () => {
      const { data } = await supabase
        .from('campaign_sends')
        .select(`
          id,
          email,
          status,
          opened_at,
          clicked_at,
          delivered_at,
          campaign:email_campaigns(name)
        `)
        .not('opened_at', 'is', null)
        .order('opened_at', { ascending: false })
        .limit(10);

      if (data) {
        const mapped: ActivityItem[] = data.map((send: any) => ({
          id: send.id,
          type: send.clicked_at ? 'clicked' : 'opened',
          email: send.email,
          campaign_name: send.campaign?.name,
          timestamp: send.clicked_at || send.opened_at,
        }));
        setActivities(mapped);
      }
    };

    fetchRecentActivity();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('campaign-activity')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaign_sends',
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;

          // Determine what changed
          let activityType: 'opened' | 'clicked' | 'delivered' | null = null;
          let timestamp: string | null = null;

          if (newData.opened_at && !oldData.opened_at) {
            activityType = 'opened';
            timestamp = newData.opened_at;
          } else if (newData.clicked_at && !oldData.clicked_at) {
            activityType = 'clicked';
            timestamp = newData.clicked_at;
          } else if (newData.delivered_at && !oldData.delivered_at) {
            activityType = 'delivered';
            timestamp = newData.delivered_at;
          }

          if (activityType && timestamp) {
            setActivities((prev) => [
              {
                id: newData.id,
                type: activityType,
                email: newData.email,
                timestamp: timestamp,
              },
              ...prev.slice(0, 9),
            ]);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'opened':
        return <Mail className="h-3 w-3 text-purple-500" />;
      case 'clicked':
        return <MousePointerClick className="h-3 w-3 text-orange-500" />;
      case 'delivered':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      default:
        return <Activity className="h-3 w-3" />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'opened':
        return 'opende';
      case 'clicked':
        return 'klikte op een link in';
      case 'delivered':
        return 'ontving';
      default:
        return type;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base">Live Activiteit</CardTitle>
          <CardDescription>Realtime email interacties</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Live' : 'Verbinden...'}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nog geen activiteit</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id + activity.timestamp}
                className="flex items-start gap-3 text-sm animate-in slide-in-from-top-2 duration-300"
              >
                <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="truncate">
                    <span className="font-medium">{activity.email}</span>{' '}
                    <span className="text-muted-foreground">
                      {getActivityLabel(activity.type)}
                    </span>
                    {activity.campaign_name && (
                      <span className="font-medium"> "{activity.campaign_name}"</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.timestamp), {
                      addSuffix: true,
                      locale: nl,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
