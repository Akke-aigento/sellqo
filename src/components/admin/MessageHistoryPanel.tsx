import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useMessageHistory, CustomerMessage } from '@/hooks/useCustomerMessages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mail,
  Send,
  Inbox,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  MessageSquare,
} from 'lucide-react';

interface MessageHistoryPanelProps {
  entityType: 'order' | 'quote' | 'customer';
  entityId: string;
  compact?: boolean;
  maxItems?: number;
}

const STATUS_CONFIG: Record<CustomerMessage['delivery_status'], { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Concept', icon: Clock, variant: 'secondary' },
  sending: { label: 'Verzenden...', icon: Clock, variant: 'secondary' },
  sent: { label: 'Verzonden', icon: Send, variant: 'default' },
  delivered: { label: 'Afgeleverd', icon: CheckCircle2, variant: 'default' },
  opened: { label: 'Geopend', icon: Eye, variant: 'default' },
  failed: { label: 'Mislukt', icon: XCircle, variant: 'destructive' },
};

export function MessageHistoryPanel({
  entityType,
  entityId,
  compact = false,
  maxItems,
}: MessageHistoryPanelProps) {
  const { data: messages = [], isLoading } = useMessageHistory(entityType, entityId);

  const displayMessages = maxItems ? messages.slice(0, maxItems) : messages;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className={compact ? 'pb-2' : undefined}>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Berichtgeschiedenis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (messages.length === 0) {
    return (
      <Card>
        <CardHeader className={compact ? 'pb-2' : undefined}>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Berichtgeschiedenis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
            <Mail className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Nog geen berichten verstuurd</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Berichtgeschiedenis
          </span>
          <Badge variant="secondary" className="font-normal">
            {messages.length} bericht{messages.length !== 1 ? 'en' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className={compact ? 'h-[200px]' : 'h-[300px]'}>
          <div className="space-y-3 pr-4">
            {displayMessages.map((message) => (
              <MessageItem key={message.id} message={message} compact={compact} />
            ))}
            {maxItems && messages.length > maxItems && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                +{messages.length - maxItems} meer berichten
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function MessageItem({ message, compact }: { message: CustomerMessage; compact: boolean }) {
  const statusConfig = STATUS_CONFIG[message.delivery_status];
  const StatusIcon = statusConfig.icon;
  const DirectionIcon = message.direction === 'outbound' ? Send : Inbox;

  return (
    <div className="relative pl-6 pb-3 border-l-2 border-muted last:pb-0">
      {/* Timeline dot */}
      <div className="absolute left-0 top-0 -translate-x-1/2 w-3 h-3 rounded-full bg-background border-2 border-primary" />
      
      <div className="space-y-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <DirectionIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">{message.subject}</span>
          </div>
          <Badge variant={statusConfig.variant} className="flex-shrink-0 text-xs">
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {message.direction === 'outbound' ? 'Naar' : 'Van'}: {message.to_email}
          </span>
          <span>•</span>
          <span>
            {format(new Date(message.created_at), 'd MMM yyyy HH:mm', { locale: nl })}
          </span>
        </div>

        {/* Preview (non-compact only) */}
        {!compact && message.body_text && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {message.body_text.substring(0, 150)}
            {message.body_text.length > 150 ? '...' : ''}
          </p>
        )}

        {/* Error message */}
        {message.delivery_status === 'failed' && message.error_message && (
          <p className="text-xs text-destructive mt-1">
            Fout: {message.error_message}
          </p>
        )}
      </div>
    </div>
  );
}
