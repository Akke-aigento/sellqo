import { useEffect, useRef, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Mail, MessageSquare, Facebook, Instagram, ArrowLeft, PanelRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageBubble } from './MessageBubble';
import { ReplyComposer } from './ReplyComposer';
import { ConversationActions } from './ConversationActions';
import { CustomerInfoPanel } from './CustomerInfoPanel';
import type { Conversation, MessageStatus } from '@/hooks/useInbox';

interface ConversationDetailProps {
  conversation: Conversation;
  onMarkAsRead: () => void;
  onMessageSent: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onMoveToFolder?: (folderId: string | null) => void;
  onPin?: (pinned: boolean) => void;
  onSnooze?: (until: Date) => void;
  onBack?: () => void;
}

export function ConversationDetail({
  conversation,
  onMarkAsRead,
  onMessageSent,
  onArchive,
  onDelete,
  onRestore,
  onMoveToFolder,
  onPin,
  onSnooze,
  onBack,
}: ConversationDetailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);

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

  const { customer, channel } = conversation;
  const messages = conversation.messages || [];
  
  const initials = customer?.name
    ? customer.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  // Get channel icon
  const getChannelIcon = () => {
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
  
  const ChannelIcon = getChannelIcon();
  
  // Find linked order from any message in conversation
  const linkedOrderId = useMemo(() => {
    if (!messages || messages.length === 0) return null;
    return messages.find(m => m.order_id)?.order_id || null;
  }, [messages]);

  // Group messages by date - with safety check
  const messagesByDate = useMemo(() => {
    if (!messages || messages.length === 0) return {};
    return messages.reduce((acc, msg) => {
      const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (!acc[date]) acc[date] = [];
      acc[date].push(msg);
      return acc;
    }, {} as Record<string, typeof messages>);
  }, [messages]);

  // Sort dates and reverse messages within each day
  const sortedDates = Object.keys(messagesByDate).sort();

  // Determine conversation status
  const conversationStatus: MessageStatus = conversation.messageStatus || 'active';
  const isArchived = conversationStatus === 'archived';
  const isDeleted = conversationStatus === 'deleted';

  // Handle creating a customer from conversation
  const handleCreateCustomer = async () => {
    if (!customer?.email) return;
    
    setIsCreatingCustomer(true);
    try {
      const nameParts = (customer.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      await createCustomer.mutateAsync({
        email: customer.email,
        first_name: firstName,
        last_name: lastName,
        phone: customer.phone || undefined,
        customer_type: 'prospect',
      });
      
      toast({
        title: 'Klant aangemaakt',
        description: `${customer.name || customer.email} is toegevoegd als prospect.`,
      });
      
      onMessageSent();
    } catch (error) {
      console.error('Failed to create customer:', error);
      toast({
        title: 'Fout',
        description: 'Kon klant niet aanmaken.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingCustomer(false);
    }
  };
  
  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className={`${isMobile ? 'p-3' : 'p-4'} border-b flex items-center gap-3`}>
          {onBack && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Avatar className={`${isMobile ? 'h-8 w-8' : 'h-10 w-10'}`}>
            <AvatarFallback className={isMobile ? 'text-xs' : ''}>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold truncate">{customer?.name || 'Onbekend'}</h2>
              <ChannelIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              {isArchived && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded">Gearchiveerd</span>
              )}
              {isDeleted && (
                <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">Prullenbak</span>
              )}
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
          <div className="flex items-center gap-1 sm:gap-2">
            {linkedOrderId && !isMobile && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/admin/orders/${linkedOrderId}`}>
                  <Package className="h-4 w-4 mr-1" />
                  Bestelling
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            )}
            {!isMobile && (customer?.id ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/admin/customers/${customer.id}`}>
                  <User className="h-4 w-4 mr-1" />
                  Klantprofiel
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            ) : customer?.email && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCreateCustomer}
                disabled={isCreatingCustomer}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                {isCreatingCustomer ? 'Aanmaken...' : 'Maak klant aan'}
              </Button>
            ))}
            {/* Customer info sidebar toggle */}
            {customer?.id && (
              <Button
                variant={showCustomerInfo ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowCustomerInfo(!showCustomerInfo)}
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            )}
            {/* Conversation actions dropdown */}
            <ConversationActions
              conversationStatus={conversationStatus}
              isPinned={conversation.isPinned}
              onArchive={onArchive || (() => {})}
              onDelete={onDelete || (() => {})}
              onRestore={onRestore || (() => {})}
              onMoveToFolder={onMoveToFolder || (() => {})}
              onPin={onPin}
              onSnooze={onSnooze}
            />
          </div>
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

        {/* Reply composer - only show for active conversations */}
        {!isDeleted && (
          <ReplyComposer conversation={conversation} onSent={onMessageSent} />
        )}
        
        {/* Deleted conversation notice */}
        {isDeleted && (
          <div className="p-4 border-t bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground">
              Dit gesprek bevindt zich in de prullenbak.{' '}
              <button 
                onClick={onRestore} 
                className="text-primary underline hover:no-underline"
              >
                Terugzetten naar inbox
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Customer info sidebar */}
      <CustomerInfoPanel
        conversation={conversation}
        open={showCustomerInfo}
        onOpenChange={setShowCustomerInfo}
      />
    </div>
  );
}
