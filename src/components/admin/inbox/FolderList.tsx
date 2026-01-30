import { useState } from 'react';
import { Inbox, Archive, Trash2, Folder, Plus, MoreHorizontal, Trash } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useInboxFolders, type InboxFolder } from '@/hooks/useInboxFolders';

interface FolderListProps {
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  folderCounts: Record<string, number>;
  collapsed?: boolean;
}

const iconMap: Record<string, typeof Inbox> = {
  inbox: Inbox,
  archive: Archive,
  'trash-2': Trash2,
  folder: Folder,
};

function FolderIcon({ icon }: { icon: string }) {
  const Icon = iconMap[icon] || Folder;
  return <Icon className="h-4 w-4 shrink-0" />;
}

interface DroppableFolderProps {
  folderId: string;
  isActive: boolean;
  onClick: () => void;
  icon: string;
  name: string;
  count: number;
  collapsed: boolean;
  isSystem?: boolean;
  onDelete?: () => void;
}

function DroppableFolder({ 
  folderId, 
  isActive, 
  onClick, 
  icon, 
  name, 
  count, 
  collapsed,
  isSystem = true,
  onDelete 
}: DroppableFolderProps) {
  const { isOver, setNodeRef } = useDroppable({ id: folderId });

  const content = (
    <div
      ref={setNodeRef}
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm',
        isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
        isOver && 'bg-primary/20 border-2 border-primary border-dashed',
        collapsed && 'justify-center px-1'
      )}
      onClick={onClick}
    >
      <FolderIcon icon={icon} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{name}</span>
          {count > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 text-xs shrink-0">
              {count}
            </Badge>
          )}
          {!isSystem && onDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                  <Trash className="h-4 w-4 mr-2" />
                  Verwijderen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </>
      )}
      {collapsed && count > 0 && (
        <Badge variant="secondary" className="h-4 min-w-4 text-[10px] absolute -top-1 -right-1 px-1">
          {count}
        </Badge>
      )}
    </div>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="right">
          {name} {count > 0 && `(${count})`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

export function FolderList({ selectedFolderId, onFolderSelect, folderCounts, collapsed = false }: FolderListProps) {
  const { folders, archiveFolder, trashFolder, customFolders, createFolder, deleteFolder } = useInboxFolders();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder.mutateAsync({ name: newFolderName.trim() });
    setNewFolderName('');
    setIsCreateOpen(false);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Weet je zeker dat je deze map wilt verwijderen? Berichten worden teruggeplaatst in de inbox.')) return;
    await deleteFolder.mutateAsync(folderId);
    if (selectedFolderId === folderId) {
      onFolderSelect(null);
    }
  };

  const inboxCount = folderCounts['inbox'] || 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-1.5 space-y-0.5">
        {/* Inbox */}
        <DroppableFolder
          folderId="inbox"
          isActive={selectedFolderId === null}
          onClick={() => onFolderSelect(null)}
          icon="inbox"
          name="Inbox"
          count={inboxCount}
          collapsed={collapsed}
        />

        {/* Archive folder */}
        {archiveFolder && (
          <DroppableFolder
            folderId={archiveFolder.id}
            isActive={selectedFolderId === archiveFolder.id}
            onClick={() => onFolderSelect(archiveFolder.id)}
            icon={archiveFolder.icon}
            name={archiveFolder.name}
            count={folderCounts[archiveFolder.id] || 0}
            collapsed={collapsed}
          />
        )}

        {/* Trash folder */}
        {trashFolder && (
          <DroppableFolder
            folderId={trashFolder.id}
            isActive={selectedFolderId === trashFolder.id}
            onClick={() => onFolderSelect(trashFolder.id)}
            icon={trashFolder.icon}
            name={trashFolder.name}
            count={folderCounts[trashFolder.id] || 0}
            collapsed={collapsed}
          />
        )}

        {/* Divider if there are custom folders */}
        {customFolders.length > 0 && (
          <div className="border-t my-2" />
        )}

        {/* Custom folders */}
        {customFolders.map((folder) => (
          <DroppableFolder
            key={folder.id}
            folderId={folder.id}
            isActive={selectedFolderId === folder.id}
            onClick={() => onFolderSelect(folder.id)}
            icon={folder.icon}
            name={folder.name}
            count={folderCounts[folder.id] || 0}
            collapsed={collapsed}
            isSystem={false}
            onDelete={() => handleDeleteFolder(folder.id)}
          />
        ))}
      </div>

      {/* Create new folder button */}
      {!collapsed && (
        <div className="p-1.5 border-t shrink-0">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs h-8">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Nieuwe map
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nieuwe map aanmaken</DialogTitle>
                <DialogDescription>
                  Maak een aangepaste map om je gesprekken te organiseren.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="folder-name">Mapnaam</Label>
                  <Input
                    id="folder-name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Bijv. VIP Klanten, Retour, Support"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Annuleren
                </Button>
                <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || createFolder.isPending}>
                  {createFolder.isPending ? 'Aanmaken...' : 'Map aanmaken'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {collapsed && (
        <div className="p-1.5 border-t shrink-0 flex justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Nieuwe map</TooltipContent>
          </Tooltip>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nieuwe map aanmaken</DialogTitle>
                <DialogDescription>
                  Maak een aangepaste map om je gesprekken te organiseren.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="folder-name-collapsed">Mapnaam</Label>
                  <Input
                    id="folder-name-collapsed"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Bijv. VIP Klanten, Retour, Support"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Annuleren
                </Button>
                <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || createFolder.isPending}>
                  {createFolder.isPending ? 'Aanmaken...' : 'Map aanmaken'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
