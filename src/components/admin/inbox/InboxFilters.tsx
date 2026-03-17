import { useState } from 'react';
import { Mail, MessageSquare, Search, Facebook, Instagram, Users, X, ChevronDown, Filter, Inbox, Archive, Trash2, FolderOpen, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { AdvancedSearchFilters } from './AdvancedSearchFilters';
import type { InboxFilters as FiltersType, FilterChannel, SearchOptions } from '@/hooks/useInbox';
import type { InboxFolder } from '@/hooks/useInboxFolders';

interface InboxFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  emailCount: number;
  whatsappCount: number;
  facebookCount: number;
  instagramCount: number;
  unreadCount: number;
  // Mobile folder props (optional - only used on mobile)
  folders?: InboxFolder[];
  selectedFolderId?: string | null;
  onFolderSelect?: (folderId: string | null) => void;
  folderCounts?: Record<string, number>;
  onCreateFolder?: (name: string) => void;
}

export function InboxFilters({
  filters,
  onFiltersChange,
  emailCount,
  whatsappCount,
  facebookCount,
  instagramCount,
  unreadCount,
  folders,
  selectedFolderId,
  onFolderSelect,
  folderCounts,
  onCreateFolder,
}: InboxFiltersProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const socialCount = whatsappCount + facebookCount + instagramCount;
  const totalCount = emailCount + socialCount;

  const hasActiveFolder = filters.folderId !== null;
  const isSearchActive = filters.search.length > 0;

  const getSocialLabel = () => {
    if (filters.channel === 'whatsapp') return 'WhatsApp';
    if (filters.channel === 'facebook') return 'Facebook';
    if (filters.channel === 'instagram') return 'Instagram';
    return 'Social';
  };

  const isSocialFilter = ['social', 'whatsapp', 'facebook', 'instagram'].includes(filters.channel);

  const getStatusLabel = () => {
    if (filters.status === 'unread') return 'Ongelezen';
    if (filters.status === 'unanswered') return 'Te beantw.';
    return 'Alle';
  };

  const getSelectedFolderLabel = () => {
    if (!selectedFolderId) return 'Inbox';
    const folder = folders?.find(f => f.id === selectedFolderId);
    if (folder?.name === 'Gearchiveerd') return 'Archief';
    if (folder?.name === 'Prullenbak') return 'Prullenbak';
    return folder?.name || 'Inbox';
  };

  const handleSearchChange = (value: string) => {
    if (value && !filters.search) {
      onFiltersChange({
        ...filters,
        search: value,
        searchOptions: {
          scope: hasActiveFolder ? 'current' : 'all',
          channels: ['email', 'whatsapp', 'facebook', 'instagram'],
          searchIn: { subject: true, content: true, sender: true },
          period: 'all',
        },
      });
    } else {
      onFiltersChange({ ...filters, search: value });
    }
  };

  const handleClearSearch = () => {
    onFiltersChange({
      ...filters,
      search: '',
      searchOptions: {
        scope: hasActiveFolder ? 'current' : 'all',
        channels: ['email', 'whatsapp', 'facebook', 'instagram'],
        searchIn: { subject: true, content: true, sender: true },
        period: 'all',
      },
    });
  };

  const handleSearchOptionsChange = (options: SearchOptions) => {
    onFiltersChange({ ...filters, searchOptions: options });
  };

  const systemFolders = folders?.filter(f => f.is_system) || [];
  const customFolders = folders?.filter(f => !f.is_system) || [];
  const inboxFolder = systemFolders.find(f => f.name === 'Inbox');
  const archiveFolder = systemFolders.find(f => f.name === 'Gearchiveerd');
  const trashFolder = systemFolders.find(f => f.name === 'Prullenbak');

  return (
    <div className="space-y-2 p-3 border-b">
      {/* Search row with status dropdown */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek in gesprekken..."
            className="pl-8 pr-8 h-9 text-sm"
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {isSearchActive && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status filter dropdown (replaces the old tabs) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 px-2.5 shrink-0">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">{getStatusLabel()}</span>
              {filters.status === 'unread' && unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 min-w-4 text-[10px] px-1">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onFiltersChange({ ...filters, status: 'all' })}>
              Alle berichten
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFiltersChange({ ...filters, status: 'unread' })}>
              Ongelezen
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-auto h-5 min-w-5 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFiltersChange({ ...filters, status: 'unanswered' })}>
              Te beantwoorden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Advanced search filters (visible when searching) */}
      <AdvancedSearchFilters
        isOpen={isSearchActive}
        searchOptions={filters.searchOptions}
        onSearchOptionsChange={handleSearchOptionsChange}
        onClearSearch={handleClearSearch}
        hasActiveFolder={hasActiveFolder}
      />

      {/* Folder selector + Channel tabs row (hidden when searching) */}
      {!isSearchActive && (
        <div className="flex items-center gap-1.5">
          {/* Mobile folder dropdown (only shown when folders prop is provided) */}
          {folders && onFolderSelect && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium bg-muted text-foreground border border-border">
                  <FolderOpen className="h-3 w-3 mr-1" />
                  {getSelectedFolderLabel()}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => onFolderSelect(null)}>
                  <Inbox className="h-4 w-4 mr-2" />
                  Inbox
                  {folderCounts?.['inbox'] !== undefined && (
                    <Badge variant="secondary" className="ml-auto h-5 min-w-5 text-xs">
                      {folderCounts['inbox']}
                    </Badge>
                  )}
                </DropdownMenuItem>
                {archiveFolder && (
                  <DropdownMenuItem onClick={() => onFolderSelect(archiveFolder.id)}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archief
                    {folderCounts?.[archiveFolder.id] !== undefined && (
                      <Badge variant="secondary" className="ml-auto h-5 min-w-5 text-xs">
                        {folderCounts[archiveFolder.id]}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                )}
                {trashFolder && (
                  <DropdownMenuItem onClick={() => onFolderSelect(trashFolder.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Prullenbak
                    {folderCounts?.[trashFolder.id] !== undefined && (
                      <Badge variant="secondary" className="ml-auto h-5 min-w-5 text-xs">
                        {folderCounts[trashFolder.id]}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                )}
                {customFolders.length > 0 && <DropdownMenuSeparator />}
                {customFolders.map(folder => (
                  <DropdownMenuItem key={folder.id} onClick={() => onFolderSelect(folder.id)}>
                    <FolderOpen className="h-4 w-4 mr-2" style={{ color: folder.color }} />
                    {folder.name}
                    {folderCounts?.[folder.id] !== undefined && (
                      <Badge variant="secondary" className="ml-auto h-5 min-w-5 text-xs">
                        {folderCounts[folder.id]}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Channel tabs */}
          <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5 flex-1">
            <button
              onClick={() => onFiltersChange({ ...filters, channel: 'all' })}
              className={`flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1 text-xs font-medium transition-all ${
                filters.channel === 'all'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Alle
              <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-[10px] px-1">
                {totalCount}
              </Badge>
            </button>
            <button
              onClick={() => onFiltersChange({ ...filters, channel: 'email' })}
              className={`flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1 text-xs font-medium transition-all ${
                filters.channel === 'email'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mail className="h-3 w-3 mr-0.5" />
              Email
              <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-[10px] px-1">
                {emailCount}
              </Badge>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1 text-xs font-medium transition-all ${
                    isSocialFilter
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users className="h-3 w-3 mr-0.5" />
                  {getSocialLabel()}
                  <Badge variant="secondary" className="ml-1 h-4 min-w-4 text-[10px] px-1">
                    {socialCount}
                  </Badge>
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onFiltersChange({ ...filters, channel: 'social' })}>
                  <Users className="h-4 w-4 mr-2" />
                  Alle Social
                  <Badge variant="secondary" className="ml-auto h-5 min-w-5 text-xs">
                    {socialCount}
                  </Badge>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFiltersChange({ ...filters, channel: 'whatsapp' })}>
                  <MessageSquare className="h-4 w-4 mr-2 text-green-600" />
                  WhatsApp
                  <Badge variant="secondary" className="ml-auto h-5 min-w-5 text-xs">
                    {whatsappCount}
                  </Badge>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFiltersChange({ ...filters, channel: 'facebook' })}>
                  <Facebook className="h-4 w-4 mr-2 text-blue-600" />
                  Facebook
                  <Badge variant="secondary" className="ml-auto h-5 min-w-5 text-xs">
                    {facebookCount}
                  </Badge>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFiltersChange({ ...filters, channel: 'instagram' })}>
                  <Instagram className="h-4 w-4 mr-2 text-pink-600" />
                  Instagram
                  <Badge variant="secondary" className="ml-auto h-5 min-w-5 text-xs">
                    {instagramCount}
                  </Badge>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
    </div>
  );
}
