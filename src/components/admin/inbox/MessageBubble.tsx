import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Check, CheckCheck, Mail, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InboxMessage } from '@/hooks/useInbox';

interface MessageBubbleProps {
  message: InboxMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const ChannelIcon = message.channel === 'whatsapp' ? MessageSquare : Mail;

  // Get status check icons for outbound messages
  const getStatusIcon = () => {
    if (!isOutbound) return null;
    
    if (message.channel === 'whatsapp') {
      if (message.whatsapp_status === 'read') {
        return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />;
      }
      if (message.whatsapp_status === 'delivered') {
        return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
      }
      return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
    }
    
    // Email status
    if (message.status === 'delivered' || message.status === 'opened') {
      return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
    }
    return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  // Parse HTML content safely
  const getBodyContent = () => {
    if (message.body_text) return message.body_text;
    if (message.body_html) {
      return message.body_html.replace(/<[^>]*>/g, '');
    }
    return '';
  };

  return (
    <div
      className={cn(
        'flex gap-2 max-w-[80%]',
        isOutbound ? 'ml-auto flex-row-reverse' : 'mr-auto'
      )}
    >
      <div
        className={cn(
          'rounded-2xl px-4 py-2.5',
          isOutbound
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted rounded-tl-sm'
        )}
      >
        {/* Subject line for emails */}
        {message.channel === 'email' && message.subject && (
          <p className={cn('text-xs font-medium mb-1', isOutbound ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
            {message.subject}
          </p>
        )}

        {/* Message body */}
        <p className="text-sm whitespace-pre-wrap break-words">{getBodyContent()}</p>

        {/* Footer with time and status */}
        <div
          className={cn(
            'flex items-center gap-1.5 mt-1.5 text-xs',
            isOutbound ? 'text-primary-foreground/70 justify-end' : 'text-muted-foreground'
          )}
        >
          <ChannelIcon className="h-3 w-3" />
          <span>{format(new Date(message.created_at), 'HH:mm', { locale: nl })}</span>
          {getStatusIcon()}
        </div>
      </div>
    </div>
  );
}
