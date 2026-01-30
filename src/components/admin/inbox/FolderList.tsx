import { useState } from 'react';
import { Inbox, Archive, Trash2, Folder, Plus, MoreHorizontal, Pencil, Trash } from 'lucide-react';
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
import { useInboxFolders, type InboxFolder } from '@/hooks/useInboxFolders';

interface FolderListProps {
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  folderCounts: Record<string, number>;
}

const iconMap: Record<string, typeof Inbox> = {
  inbox: Inbox,
  archive: Archive,
  'trash-2': Trash2,
  folder: Folder,
};

function FolderIcon({ icon }: { icon: string }) {
  const Icon = iconMap[icon] || Folder;
  return <Icon className="h-4 w-4" />;
}

export function FolderList({ selectedFolderId, onFolderSelect, folderCounts }: FolderListProps) {
  const { folders, inboxFolder, archiveFolder, trashFolder, customFolders, createFolder, deleteFolder } = useInboxFolders();
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

  const renderFolder = (folder: InboxFolder, isActive: boolean) => {
    const count = folderCounts[folder.id] || 0;
    
    return (
      <div
        key={folder.id}
        className={cn(
          'group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
          isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
        )}
        onClick={() => onFolderSelect(folder.id)}
      >
        <FolderIcon icon={folder.icon} />
        <span className="flex-1 text-sm truncate">{folder.name}</span>
        {count > 0 && (
          <Badge variant="secondary" className="h-5 min-w-5 text-xs">
            {count}
          </Badge>
        )}
        {!folder.is_system && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}>
                <Trash className="h-4 w-4 mr-2" />
                Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  // Calculate inbox count (null folder_id = inbox)
  const inboxCount = folderCounts['inbox'] || 0;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Mappen</h3>
      </div>
      
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {/* Inbox (null folder = inbox) */}
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
            selectedFolderId === null ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
          )}
          onClick={() => onFolderSelect(null)}
        >
          <Inbox className="h-4 w-4" />
          <span className="flex-1 text-sm">Inbox</span>
          {inboxCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 text-xs">
              {inboxCount}
            </Badge>
          )}
        </div>

        {/* Archive folder */}
        {archiveFolder && renderFolder(archiveFolder, selectedFolderId === archiveFolder.id)}

        {/* Trash folder */}
        {trashFolder && renderFolder(trashFolder, selectedFolderId === trashFolder.id)}

        {/* Divider if there are custom folders */}
        {customFolders.length > 0 && (
          <div className="border-t my-2" />
        )}

        {/* Custom folders */}
        {customFolders.map((folder) => renderFolder(folder, selectedFolderId === folder.id))}
      </div>

      {/* Create new folder button */}
      <div className="p-2 border-t">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start">
              <Plus className="h-4 w-4 mr-2" />
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
    </div>
  );
}
