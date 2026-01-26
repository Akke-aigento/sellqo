import { Mail, MessageSquare, Search } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { InboxFilters as FiltersType } from '@/hooks/useInbox';

interface InboxFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  emailCount: number;
  whatsappCount: number;
  unreadCount: number;
}

export function InboxFilters({
  filters,
  onFiltersChange,
  emailCount,
  whatsappCount,
  unreadCount,
}: InboxFiltersProps) {
  return (
    <div className="space-y-3 p-4 border-b">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoek in gesprekken..."
          className="pl-9"
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        />
      </div>

      {/* Channel tabs */}
      <Tabs
        value={filters.channel}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, channel: value as FiltersType['channel'] })
        }
      >
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            Alle
            <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-xs">
              {emailCount + whatsappCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex-1">
            <Mail className="h-3.5 w-3.5 mr-1" />
            Email
            <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-xs">
              {emailCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex-1">
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            WhatsApp
            <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-xs">
              {whatsappCount}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Status tabs */}
      <Tabs
        value={filters.status}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, status: value as FiltersType['status'] })
        }
      >
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            Alle
          </TabsTrigger>
          <TabsTrigger value="unread" className="flex-1">
            Ongelezen
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unanswered" className="flex-1">
            Te beantwoorden
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
