import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Mail, MessageSquare, Check, ShoppingBag, Store, Facebook, Instagram, Pin, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Conversation, ConversationChannel } from '@/hooks/useInbox';

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const { customer, lastMessage, unreadCount, channel, isPinned, snoozedUntil } = conversation;
  const isUnread = unreadCount > 0;
  const isSnoozed = snoozedUntil && new Date(snoozedUntil) > new Date();
  const isReplied = lastMessage.direction === 'inbound' && lastMessage.replied_at;
  
  // Check for marketplace source
  const contextData = (lastMessage as any).context_data as { marketplace?: string } | undefined;
  const marketplace = contextData?.marketplace;

  // Get channel icon based on conversation channel
  const getChannelIcon = (ch: ConversationChannel) => {
    switch (ch) {
      case 'whatsapp':
        return MessageSquare;
      case 'facebook':
        return Facebook;
      case 'instagram':
        return Instagram;
      case 'social':
      case 'mixed':
        return MessageSquare; // Default for mixed social
      default:
        return Mail;
    }
  };

  const ChannelIcon = getChannelIcon(channel);

  // Channel color mapping
  const getChannelColor = (ch: ConversationChannel) => {
    switch (ch) {
      case 'whatsapp': return 'text-green-500';
      case 'facebook': return 'text-blue-500';
      case 'instagram': return 'text-pink-500';
      default: return 'text-muted-foreground';
    }
  };

  const cleanName = (customer?.name || '')
    .replace(/<[^>]*>/g, '')
    .trim();

  const initials = cleanName
    ? cleanName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  // Get preview text
  const previewText = lastMessage.body_text || 
    lastMessage.body_html?.replace(/<[^>]*>/g, '').slice(0, 100) || 
    lastMessage.subject;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 border-b transition-colors hover:bg-muted/50',
        isSelected && 'bg-muted',
        isUnread && 'bg-primary/5'
      )}
    >
      <div className="space-y-1">
        {/* Row 1: Channel icon + sender name + time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ChannelIcon className={cn('h-4 w-4 shrink-0', getChannelColor(channel))} />
            <span className={cn('text-sm font-medium truncate', isUnread && 'font-semibold')}>
              {cleanName || 'Onbekend'}
            </span>
            {isUnread && (
              <span className="h-2 w-2 bg-destructive rounded-full shrink-0" />
            )}
            {marketplace === 'bol_com' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <ShoppingBag className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                </TooltipTrigger>
                <TooltipContent>Bol.com bericht</TooltipContent>
              </Tooltip>
            )}
            {marketplace === 'amazon' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Store className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                </TooltipTrigger>
                <TooltipContent>Amazon bericht</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            {isPinned && <Pin className="h-3 w-3 text-primary" />}
            {isSnoozed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Clock className="h-3 w-3 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent>Gesnoozed</TooltipContent>
              </Tooltip>
            )}
            <span>
              {formatDistanceToNow(new Date(lastMessage.created_at), {
                addSuffix: false,
                locale: nl,
              })}
            </span>
            {isReplied && <Check className="h-3.5 w-3.5 text-green-500" />}
          </div>
        </div>

        {/* Row 3: Subject full width */}
        <p className={cn('text-xs truncate', isUnread ? 'text-foreground font-medium' : 'text-muted-foreground')}>
          {lastMessage.subject || '(Geen onderwerp)'}
        </p>

        {/* Row 4: Preview text full width */}
        <p className="text-xs text-muted-foreground truncate">
          {lastMessage.direction === 'outbound' && (
            <span className="inline-flex items-center gap-0.5 mr-1">
              <Check className="h-3 w-3" />
            </span>
          )}
          {previewText || '(Geen inhoud)'}
        </p>
      </div>
    </button>
  );
}
