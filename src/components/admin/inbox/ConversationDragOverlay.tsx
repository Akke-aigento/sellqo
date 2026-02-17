import { Mail, MessageSquare, Facebook, Instagram } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Conversation, ConversationChannel } from '@/hooks/useInbox';

interface ConversationDragOverlayProps {
  conversation: Conversation;
}

export function ConversationDragOverlay({ conversation }: ConversationDragOverlayProps) {
  const { customer, channel } = conversation;

  const getChannelIcon = (ch: ConversationChannel) => {
    switch (ch) {
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

  const ChannelIcon = getChannelIcon(channel);

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

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 w-64 opacity-90 cursor-grabbing">
      <div className="flex gap-3 items-center">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm truncate">
              {cleanName || 'Onbekend'}
            </span>
            <ChannelIcon className="h-3 w-3 text-muted-foreground shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {conversation.lastMessage?.subject || 'Geen onderwerp'}
          </p>
        </div>
      </div>
    </div>
  );
}
