import { useMemo, useState, useEffect, useCallback } from 'react';
import { MessageSquare, PanelLeftClose, PanelLeft, PenSquare } from 'lucide-react';
import { DndContext, DragOverlay, closestCenter, DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { useInbox } from '@/hooks/useInbox';
import { useInboxFolders } from '@/hooks/useInboxFolders';
import { useBulkInboxActions } from '@/hooks/useBulkInboxActions';
import { InboxFilters, ConversationList, ConversationDetail, FolderList, ComposeDialog } from '@/components/admin/inbox';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConversationDragOverlay } from '@/components/admin/inbox/ConversationDragOverlay';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Conversation } from '@/hooks/useInbox';

const TABLET_BREAKPOINT = 1024;

function useIsTablet() {
  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => {
    const check = () => setIsTablet(window.innerWidth < TABLET_BREAKPOINT);
    check();
    const mql = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);
    mql.addEventListener('change', check);
    return () => mql.removeEventListener('change', check);
  }, []);
  return isTablet;
}

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
    markConversationAsUnread,
    unreadTotal,
    archiveConversation,
    deleteConversation,
    restoreConversation,
    moveToFolder,
  } = useInbox();

  const { folders, archiveFolder, trashFolder } = useInboxFolders();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Auto-collapse sidebar on tablet and mobile
  useEffect(() => {
    if (isMobile || isTablet) {
      setIsSidebarCollapsed(true);
    }
  }, [isMobile, isTablet]);

  // Bulk selection hook
  const {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkArchive,
    bulkDelete,
    bulkRestore,
    bulkMoveToFolder,
    isLoading: isBulkLoading,
  } = useBulkInboxActions(conversations);

  // Handle conversation selection (switch to detail on mobile)
  const handleSelectConversation = useCallback((id: string | null) => {
    setSelectedConversationId(id);
    if (id && (isMobile || isTablet)) {
      setMobileView('detail');
    }
  }, [setSelectedConversationId, isMobile, isTablet]);

  // Handle back from detail on mobile
  const handleBack = useCallback(() => {
    setMobileView('list');
    setSelectedConversationId(null);
  }, [setSelectedConversationId]);

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
    counts['inbox'] = conversations.filter(c => c.messageStatus === 'active' && !c.folderId).length;
    if (archiveFolder) {
      counts[archiveFolder.id] = conversations.filter(c => c.messageStatus === 'archived').length;
    }
    if (trashFolder) {
      counts[trashFolder.id] = conversations.filter(c => c.messageStatus === 'deleted').length;
    }
    folders.filter(f => !f.is_system).forEach(folder => {
      counts[folder.id] = conversations.filter(c => c.folderId === folder.id).length;
    });
    return counts;
  }, [conversations, folders, archiveFolder, trashFolder]);

  const handleFolderSelect = (folderId: string | null) => {
    if (folderId === archiveFolder?.id) {
      setFilters({ ...filters, folderId: 'archived' });
    } else if (folderId === trashFolder?.id) {
      setFilters({ ...filters, folderId: 'deleted' });
    } else {
      setFilters({ ...filters, folderId });
    }
    setSelectedConversationId(null);
    if (isMobile || isTablet) setMobileView('list');
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const conversation = conversations.find(c => c.id === event.active.id);
    setActiveConversation(conversation || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveConversation(null);
    if (!over) return;
    const conversationId = active.id as string;
    const targetFolderId = over.id as string;
    if (targetFolderId === 'inbox') {
      moveToFolder({ conversationId, folderId: null });
    } else if (targetFolderId === archiveFolder?.id) {
      archiveConversation(conversationId);
    } else if (targetFolderId === trashFolder?.id) {
      deleteConversation(conversationId);
    } else {
      moveToFolder({ conversationId, folderId: targetFolderId });
    }
  };

  // Mobile: show only one panel at a time
  const isSinglePanel = isMobile || isTablet;
  const showList = !isSinglePanel || mobileView === 'list';
  const showDetail = !isSinglePanel || mobileView === 'detail';

  return (
    <div className="h-[calc(100vh-4rem)]">
      <div className={`${isSinglePanel ? 'px-3 py-2' : 'p-6 pb-0'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`${isSinglePanel ? 'text-lg' : 'text-2xl'} font-bold tracking-tight flex items-center gap-2`}>
              <MessageSquare className={`${isSinglePanel ? 'h-5 w-5' : 'h-6 w-6'}`} />
              {isSinglePanel ? 'Gesprekken' : 'Klantgesprekken'}
            </h1>
            {!isSinglePanel && (
              <p className="text-muted-foreground mt-1">
                Beheer alle communicatie met klanten via email en social media
              </p>
            )}
          </div>
          <Button onClick={() => setComposeOpen(true)} size={isSinglePanel ? 'sm' : 'default'}>
            <PenSquare className="h-4 w-4 mr-2" />
            {isSinglePanel ? 'Nieuw' : 'Nieuw bericht'}
          </Button>
        </div>

        <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} />
      </div>

      <div className={`${isSinglePanel ? 'px-0' : 'p-6'} h-[calc(100%-${isSinglePanel ? '3rem' : '5rem'})]`}>
        {/* On mobile: no Card wrapper, just a plain div for native inbox feel */}
        {isSinglePanel ? (
          <div className="h-full flex overflow-hidden">
            <DndContext
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {/* Folder sidebar hidden on mobile — folders accessible via filters */}

              {/* Conversation list */}
              {showList && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <InboxFilters
                    filters={filters}
                    onFiltersChange={setFilters}
                    emailCount={counts.email}
                    whatsappCount={counts.whatsapp}
                    facebookCount={counts.facebook}
                    instagramCount={counts.instagram}
                    unreadCount={unreadTotal}
                    folders={folders}
                    selectedFolderId={
                      filters.folderId === 'archived' ? archiveFolder?.id || null :
                      filters.folderId === 'deleted' ? trashFolder?.id || null :
                      filters.folderId
                    }
                    onFolderSelect={handleFolderSelect}
                    folderCounts={folderCounts}
                  />
                  <div className="flex-1 overflow-hidden">
                    <ConversationList
                      conversations={conversations}
                      selectedId={selectedConversationId}
                      onSelect={handleSelectConversation}
                      isLoading={isLoading}
                      selectedIds={selectedIds}
                      onToggleSelection={toggleSelection}
                      onSelectAll={selectAll}
                      onClearSelection={clearSelection}
                      onBulkArchive={bulkArchive}
                      onBulkDelete={bulkDelete}
                      onBulkRestore={bulkRestore}
                      onBulkMoveToFolder={bulkMoveToFolder}
                      currentFolder={filters.folderId}
                      isBulkLoading={isBulkLoading}
                      onArchiveConversation={archiveConversation}
                      onDeleteConversation={deleteConversation}
                    />
                  </div>
                </div>
              )}

              {/* Drag overlay */}
              <DragOverlay>
                {activeConversation && (
                  <ConversationDragOverlay conversation={activeConversation} />
                )}
              </DragOverlay>
            </DndContext>

            {/* Conversation detail */}
            {showDetail && (
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
                    onBack={handleBack}
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
            )}
          </div>
        ) : (
          <Card className="h-full flex overflow-hidden">
            <DndContext
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {/* Left sidebar - Folders */}
              <div className={`${isSidebarCollapsed ? 'w-12' : 'w-44'} min-w-0 border-r flex flex-col shrink-0 bg-muted/30 transition-all duration-200`}>
                <div className="p-1.5 border-b flex items-center justify-between shrink-0">
                  {!isSidebarCollapsed && (
                    <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide pl-1">Mappen</h3>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  >
                    {isSidebarCollapsed ? (
                      <PanelLeft className="h-3.5 w-3.5" />
                    ) : (
                      <PanelLeftClose className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <FolderList
                  selectedFolderId={
                    filters.folderId === 'archived' ? archiveFolder?.id || null :
                    filters.folderId === 'deleted' ? trashFolder?.id || null :
                    filters.folderId
                  }
                  onFolderSelect={handleFolderSelect}
                  folderCounts={folderCounts}
                  collapsed={isSidebarCollapsed}
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
                    onSelect={handleSelectConversation}
                    isLoading={isLoading}
                    selectedIds={selectedIds}
                    onToggleSelection={toggleSelection}
                    onSelectAll={selectAll}
                    onClearSelection={clearSelection}
                    onBulkArchive={bulkArchive}
                    onBulkDelete={bulkDelete}
                    onBulkRestore={bulkRestore}
                    onBulkMoveToFolder={bulkMoveToFolder}
                    currentFolder={filters.folderId}
                    isBulkLoading={isBulkLoading}
                    onArchiveConversation={archiveConversation}
                    onDeleteConversation={deleteConversation}
                  />
                </div>
              </div>

              {/* Drag overlay */}
              <DragOverlay>
                {activeConversation && (
                  <ConversationDragOverlay conversation={activeConversation} />
                )}
              </DragOverlay>
            </DndContext>

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
        )}
      </div>
    </div>
  );
}
