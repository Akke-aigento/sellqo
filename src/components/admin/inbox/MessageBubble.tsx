import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Check, CheckCheck, Mail, MessageSquare, ShoppingBag, Store, Paperclip, Facebook, Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessageAttachments } from './MessageAttachments';
import type { InboxMessage, MessageChannel } from '@/hooks/useInbox';

interface MessageContextData {
  marketplace?: 'bol_com' | 'amazon' | null;
  bol_order_id?: string | null;
  has_attachments?: boolean;
  attachment_count?: number;
}

interface MessageBubbleProps {
  message: InboxMessage;
}

// Channel icon mapping
const getChannelIcon = (channel: MessageChannel) => {
  switch (channel) {
    case 'whatsapp':
      return MessageSquare;
    case 'facebook':
      return Facebook;
    case 'instagram':
      return Instagram;
    default:
      return Mail;
  }
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const ChannelIcon = getChannelIcon(message.channel);
  
  // Extract marketplace info from context_data
  const contextData = (message as any).context_data as MessageContextData | undefined;
  const marketplace = contextData?.marketplace;
  const hasAttachments = contextData?.has_attachments || false;
  const attachmentCount = contextData?.attachment_count || 0;

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

  // Parse HTML content safely with proper fallback handling
  const getBodyContent = () => {
    // Prefer plain text if available and not empty
    if (message.body_text && message.body_text.trim()) {
      return message.body_text.trim();
    }
    
    // Strip HTML but handle empty/placeholder results
    if (message.body_html) {
      const stripped = message.body_html.replace(/<[^>]*>/g, '').trim();
      // Check for actual content (not placeholder text)
      if (stripped && 
          !stripped.includes('Geen inhoud') && 
          !stripped.includes('niet beschikbaar') &&
          stripped.length > 0) {
        return stripped;
      }
    }
    
    // Fallback for empty messages
    return '(Geen inhoud beschikbaar)';
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
        {/* Marketplace badge */}
        {marketplace && (
          <div className={cn(
            'flex items-center gap-1 mb-1.5',
            isOutbound ? 'text-primary-foreground/80' : ''
          )}>
            {marketplace === 'bol_com' ? (
              <>
                <ShoppingBag className="h-3 w-3 text-orange-500" />
                <span className="text-xs font-medium text-orange-600">Bol.com</span>
              </>
            ) : marketplace === 'amazon' ? (
              <>
                <Store className="h-3 w-3 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Amazon</span>
              </>
            ) : null}
          </div>
        )}

        {/* Subject line for emails */}
        {message.channel === 'email' && message.subject && (
          <p className={cn('text-xs font-medium mb-1', isOutbound ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
            {message.subject}
          </p>
        )}

        {/* Message body */}
        <p className="text-sm whitespace-pre-wrap break-words">{getBodyContent()}</p>

        {/* Attachments */}
        {(hasAttachments || attachmentCount > 0) && (
          <MessageAttachments 
            messageId={message.id} 
            isOutbound={isOutbound}
          />
        )}

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
