import { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { useInbox } from '@/hooks/useInbox';
import { InboxFilters, ConversationList, ConversationDetail } from '@/components/admin/inbox';
import { Card } from '@/components/ui/card';

export default function MessagesPage() {
  const {
    conversations,
    selectedConversation,
    selectedConversationId,
    setSelectedConversationId,
    isLoading,
    filters,
    setFilters,
    markConversationAsRead,
    unreadTotal,
  } = useInbox();

  // Count by channel
  const counts = useMemo(() => {
    const email = conversations.filter((c) => c.channel === 'email').length;
    const whatsapp = conversations.filter((c) => c.channel === 'whatsapp').length;
    const facebook = conversations.filter((c) => c.channel === 'facebook').length;
    const instagram = conversations.filter((c) => c.channel === 'instagram').length;
    return { email, whatsapp, facebook, instagram };
  }, [conversations]);

  return (
    <div className="h-[calc(100vh-4rem)]">
      <div className="p-6 pb-0">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          Klantgesprekken
        </h1>
        <p className="text-muted-foreground mt-1">
          Beheer alle communicatie met klanten via email en WhatsApp
        </p>
      </div>

      <div className="p-6 h-[calc(100%-5rem)]">
        <Card className="h-full flex overflow-hidden">
          {/* Left sidebar - Conversation list */}
          <div className="w-80 border-r flex flex-col shrink-0">
            <InboxFilters
              filters={filters}
              onFiltersChange={setFilters}
              emailCount={counts.email}
              whatsappCount={counts.whatsapp}
              facebookCount={counts.facebook}
              instagramCount={counts.instagram}
              unreadCount={unreadTotal}
            />
            <div className="flex-1 overflow-hidden">
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversationId}
                onSelect={setSelectedConversationId}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Right panel - Conversation detail */}
          <div className="flex-1 min-w-0">
            {selectedConversation ? (
              <ConversationDetail
                conversation={selectedConversation}
                onMarkAsRead={() => markConversationAsRead(selectedConversation.id)}
                onMessageSent={() => {}}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">Selecteer een gesprek</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Kies een gesprek uit de lijst om berichten te bekijken en te beantwoorden.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
