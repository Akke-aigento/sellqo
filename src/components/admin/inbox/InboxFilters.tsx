import { Mail, MessageSquare, Search, Facebook, Instagram, Users } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import type { InboxFilters as FiltersType, FilterChannel } from '@/hooks/useInbox';

interface InboxFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  emailCount: number;
  whatsappCount: number;
  facebookCount: number;
  instagramCount: number;
  unreadCount: number;
}

export function InboxFilters({
  filters,
  onFiltersChange,
  emailCount,
  whatsappCount,
  facebookCount,
  instagramCount,
  unreadCount,
}: InboxFiltersProps) {
  const socialCount = whatsappCount + facebookCount + instagramCount;
  const totalCount = emailCount + socialCount;

  const getSocialLabel = () => {
    if (filters.channel === 'whatsapp') return 'WhatsApp';
    if (filters.channel === 'facebook') return 'Facebook';
    if (filters.channel === 'instagram') return 'Instagram';
    return 'Social';
  };

  const isSocialFilter = ['social', 'whatsapp', 'facebook', 'instagram'].includes(filters.channel);

  return (
    <div className="space-y-2 p-3 border-b">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoek in gesprekken..."
          className="pl-8 h-9 text-sm"
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        />
      </div>

      {/* Channel tabs with Social dropdown */}
      <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
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

      {/* Status tabs */}
      <Tabs
        value={filters.status}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, status: value as FiltersType['status'] })
        }
      >
        <TabsList className="w-full h-8">
          <TabsTrigger value="all" className="flex-1 text-xs px-2">
            Alle
          </TabsTrigger>
          <TabsTrigger value="unread" className="flex-1 text-xs px-2">
            Ongelezen
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 min-w-4 text-[10px] px-1">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unanswered" className="flex-1 text-xs px-1">
            Te beantw.
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
