import { Mail, MessageSquare, Facebook, Instagram, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import type { SearchOptions, FilterChannel } from '@/hooks/useInbox';

interface AdvancedSearchFiltersProps {
  isOpen: boolean;
  searchOptions: SearchOptions;
  onSearchOptionsChange: (options: SearchOptions) => void;
  onClearSearch: () => void;
  hasActiveFolder: boolean;
}

const channelConfig: { id: FilterChannel; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'email', label: 'Email', icon: <Mail className="h-3.5 w-3.5" />, color: 'text-foreground' },
  { id: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare className="h-3.5 w-3.5" />, color: 'text-green-600' },
  { id: 'facebook', label: 'Facebook', icon: <Facebook className="h-3.5 w-3.5" />, color: 'text-blue-600' },
  { id: 'instagram', label: 'Instagram', icon: <Instagram className="h-3.5 w-3.5" />, color: 'text-pink-600' },
];

export function AdvancedSearchFilters({
  isOpen,
  searchOptions,
  onSearchOptionsChange,
  onClearSearch,
  hasActiveFolder,
}: AdvancedSearchFiltersProps) {
  const toggleChannel = (channelId: FilterChannel) => {
    const currentChannels = searchOptions.channels;
    const newChannels = currentChannels.includes(channelId)
      ? currentChannels.filter((c) => c !== channelId)
      : [...currentChannels, channelId];
    
    // Ensure at least one channel is selected
    if (newChannels.length === 0) return;
    
    onSearchOptionsChange({ ...searchOptions, channels: newChannels });
  };

  const toggleSearchIn = (field: keyof SearchOptions['searchIn']) => {
    const newSearchIn = { ...searchOptions.searchIn, [field]: !searchOptions.searchIn[field] };
    
    // Ensure at least one field is selected
    if (!newSearchIn.subject && !newSearchIn.content && !newSearchIn.sender) return;
    
    onSearchOptionsChange({ ...searchOptions, searchIn: newSearchIn });
  };

  const selectedChannelsCount = searchOptions.channels.length;
  const channelsLabel = selectedChannelsCount === 4 ? 'Alle' : `${selectedChannelsCount} kanalen`;

  return (
    <Collapsible open={isOpen}>
      <CollapsibleContent className="space-y-2 pt-2 animate-in slide-in-from-top-2 duration-200">
        {/* Row 1: Zoekbereik + Periode (2 kolommen) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Zoekbereik */}
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground">Zoek in</Label>
            <Select
              value={searchOptions.scope}
              onValueChange={(value: SearchOptions['scope']) =>
                onSearchOptionsChange({ ...searchOptions, scope: value })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current" className="text-xs">Huidige map</SelectItem>
                <SelectItem value="all" className="text-xs">Alle mappen</SelectItem>
                <SelectItem value="everywhere" className="text-xs">Overal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Periode */}
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground">Periode</Label>
            <Select
              value={searchOptions.period}
              onValueChange={(value: SearchOptions['period']) =>
                onSearchOptionsChange({ ...searchOptions, period: value })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week" className="text-xs">Week</SelectItem>
                <SelectItem value="month" className="text-xs">Maand</SelectItem>
                <SelectItem value="3months" className="text-xs">3 maanden</SelectItem>
                <SelectItem value="all" className="text-xs">Alles</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Kanalen als horizontale checkboxes */}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {channelConfig.map((ch) => (
            <div key={ch.id} className="flex items-center gap-1">
              <Checkbox
                id={`channel-${ch.id}`}
                checked={searchOptions.channels.includes(ch.id)}
                onCheckedChange={() => toggleChannel(ch.id)}
                className="h-3.5 w-3.5"
              />
              <Label
                htmlFor={`channel-${ch.id}`}
                className={`text-xs flex items-center gap-0.5 cursor-pointer ${ch.color}`}
              >
                {ch.icon}
                {ch.label}
              </Label>
            </div>
          ))}
        </div>

        {/* Row 3: Zoek op checkboxes */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Zoek op:</span>
          <div className="flex items-center gap-1">
            <Checkbox
              id="search-subject"
              checked={searchOptions.searchIn.subject}
              onCheckedChange={() => toggleSearchIn('subject')}
              className="h-3.5 w-3.5"
            />
            <Label htmlFor="search-subject" className="text-xs cursor-pointer">Onderwerp</Label>
          </div>
          <div className="flex items-center gap-1">
            <Checkbox
              id="search-content"
              checked={searchOptions.searchIn.content}
              onCheckedChange={() => toggleSearchIn('content')}
              className="h-3.5 w-3.5"
            />
            <Label htmlFor="search-content" className="text-xs cursor-pointer">Inhoud</Label>
          </div>
          <div className="flex items-center gap-1">
            <Checkbox
              id="search-sender"
              checked={searchOptions.searchIn.sender}
              onCheckedChange={() => toggleSearchIn('sender')}
              className="h-3.5 w-3.5"
            />
            <Label htmlFor="search-sender" className="text-xs cursor-pointer">Afzender</Label>
          </div>
        </div>

        {/* Clear button */}
        <div className="flex justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClearSearch}
          >
            <X className="h-3 w-3 mr-1" />
            Wissen
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
