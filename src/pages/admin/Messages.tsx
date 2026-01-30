import { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { useInbox } from '@/hooks/useInbox';
import { useInboxFolders } from '@/hooks/useInboxFolders';
import { InboxFilters, ConversationList, ConversationDetail, FolderList } from '@/components/admin/inbox';
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
    archiveConversation,
    deleteConversation,
    restoreConversation,
    moveToFolder,
  } = useInbox();

  const { folders, archiveFolder, trashFolder } = useInboxFolders();

  // Count by channel
  const counts = useMemo(() => {
    const email = conversations.filter((c) => c.channel === 'email').length;
    const whatsapp = conversations.filter((c) => c.channel === 'whatsapp').length;
    const facebook = conversations.filter((c) => c.channel === 'facebook').length;
    const instagram = conversations.filter((c) => c.channel === 'instagram').length;
    return { email, whatsapp, facebook, instagram };
  }, [conversations]);

  // Count by folder
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Inbox count (active messages without folder)
    counts['inbox'] = conversations.filter(c => c.messageStatus === 'active' && !c.folderId).length;
    
    // Archive count
    if (archiveFolder) {
      counts[archiveFolder.id] = conversations.filter(c => c.messageStatus === 'archived').length;
    }
    
    // Trash count
    if (trashFolder) {
      counts[trashFolder.id] = conversations.filter(c => c.messageStatus === 'deleted').length;
    }
    
    // Custom folder counts
    folders.filter(f => !f.is_system).forEach(folder => {
      counts[folder.id] = conversations.filter(c => c.folderId === folder.id).length;
    });
    
    return counts;
  }, [conversations, folders, archiveFolder, trashFolder]);

  const handleFolderSelect = (folderId: string | null) => {
    // Map system folder IDs to filter values
    if (folderId === archiveFolder?.id) {
      setFilters({ ...filters, folderId: 'archived' });
    } else if (folderId === trashFolder?.id) {
      setFilters({ ...filters, folderId: 'deleted' });
    } else {
      setFilters({ ...filters, folderId });
    }
    setSelectedConversationId(null);
  };

  // Get current folder display name
  const getCurrentFolderName = () => {
    if (filters.folderId === null) return 'Inbox';
    if (filters.folderId === 'archived') return 'Gearchiveerd';
    if (filters.folderId === 'deleted') return 'Prullenbak';
    const folder = folders.find(f => f.id === filters.folderId);
    return folder?.name || 'Inbox';
  };

  return (
    <div className="h-[calc(100vh-4rem)]">
      <div className="p-6 pb-0">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          Klantgesprekken
        </h1>
        <p className="text-muted-foreground mt-1">
          Beheer alle communicatie met klanten via email en social media
        </p>
      </div>

      <div className="p-6 h-[calc(100%-5rem)]">
        <Card className="h-full flex overflow-hidden">
          {/* Left sidebar - Folders */}
          <div className="w-44 min-w-44 border-r flex flex-col shrink-0 bg-muted/30">
            <FolderList
              selectedFolderId={
                filters.folderId === 'archived' ? archiveFolder?.id || null :
                filters.folderId === 'deleted' ? trashFolder?.id || null :
                filters.folderId
              }
              onFolderSelect={handleFolderSelect}
              folderCounts={folderCounts}
            />
          </div>

          {/* Middle - Conversation list */}
          <div className="w-72 min-w-72 border-r flex flex-col shrink-0 overflow-hidden">
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
                onArchive={() => archiveConversation(selectedConversation.id)}
                onDelete={() => deleteConversation(selectedConversation.id)}
                onRestore={() => restoreConversation(selectedConversation.id)}
                onMoveToFolder={(folderId) => moveToFolder({ conversationId: selectedConversation.id, folderId })}
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
