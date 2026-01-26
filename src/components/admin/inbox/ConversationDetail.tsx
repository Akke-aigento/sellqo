import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Mail, MessageSquare, User, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageBubble } from './MessageBubble';
import { ReplyComposer } from './ReplyComposer';
import type { Conversation } from '@/hooks/useInbox';

interface ConversationDetailProps {
  conversation: Conversation;
  onMarkAsRead: () => void;
  onMessageSent: () => void;
}

export function ConversationDetail({
  conversation,
  onMarkAsRead,
  onMessageSent,
}: ConversationDetailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark as read when viewing
  useEffect(() => {
    if (conversation.unreadCount > 0) {
      onMarkAsRead();
    }
  }, [conversation.id, conversation.unreadCount, onMarkAsRead]);

  // Scroll to bottom when conversation changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation.id]);

  const { customer, messages, channel } = conversation;
  const initials = customer?.name
    ? customer.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const ChannelIcon = channel === 'whatsapp' ? MessageSquare : Mail;

  // Group messages by date
  const messagesByDate = messages.reduce((acc, msg) => {
    const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {} as Record<string, typeof messages>);

  // Sort dates and reverse messages within each day
  const sortedDates = Object.keys(messagesByDate).sort();
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-4">
        <Avatar className="h-10 w-10">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold truncate">{customer?.name || 'Onbekend'}</h2>
            <ChannelIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {customer?.email && (
              <span className="truncate">{customer.email}</span>
            )}
            {customer?.phone && (
              <>
                <span>•</span>
                <span>{customer.phone}</span>
              </>
            )}
          </div>
        </div>
        {customer?.id && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/admin/customers/${customer.id}`}>
              <User className="h-4 w-4 mr-1" />
              Klantprofiel
              <ExternalLink className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center gap-4 my-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground px-2">
                  {format(new Date(date), 'd MMMM yyyy', { locale: nl })}
                </span>
                <Separator className="flex-1" />
              </div>

              {/* Messages for this date */}
              <div className="space-y-3">
                {messagesByDate[date]
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Reply composer */}
      <ReplyComposer conversation={conversation} onSent={onMessageSent} />
    </div>
  );
}
