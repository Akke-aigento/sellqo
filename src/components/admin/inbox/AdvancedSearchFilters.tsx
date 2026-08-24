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
import { useTranslation } from 'react-i18next';

interface AdvancedSearchFiltersProps {
  isOpen: boolean;
  searchOptions: SearchOptions;
  onSearchOptionsChange: (options: SearchOptions) => void;
  onClearSearch: () => void;
  hasActiveFolder: boolean;
}

// Alleen 'Email' is een gewoon woord; de andere drie zijn merknamen en
// blijven letterlijk. Daarom is `label` optioneel naast `labelKey`.
const channelConfig: { id: FilterChannel; label?: string; labelKey?: string; icon: React.ReactNode; color: string }[] = [
  { id: 'email', labelKey: 'admin.inbox.advancedSearchFilters.channels.email', icon: <Mail className="h-3.5 w-3.5" />, color: 'text-foreground' },
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
  const { t } = useTranslation();
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
            <Label className="text-xs text-muted-foreground">{t('admin.inbox.advancedSearchFilters.zoek_in')}</Label>
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
                <SelectItem value="current" className="text-xs">{t('admin.inbox.advancedSearchFilters.huidige_map')}</SelectItem>
                <SelectItem value="all" className="text-xs">{t('admin.inbox.advancedSearchFilters.alle_mappen')}</SelectItem>
                <SelectItem value="everywhere" className="text-xs">{t('admin.inbox.advancedSearchFilters.overal')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Periode */}
          <div className="space-y-0.5">
            <Label className="text-xs text-muted-foreground">{t('admin.inbox.advancedSearchFilters.periode')}</Label>
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
                <SelectItem value="week" className="text-xs">{t('admin.marketing.contentCalendar.week')}</SelectItem>
                <SelectItem value="month" className="text-xs">{t('admin.marketing.contentCalendar.maand')}</SelectItem>
                <SelectItem value="3months" className="text-xs">{t('admin.inbox.advancedSearchFilters.3_maanden')}</SelectItem>
                <SelectItem value="all" className="text-xs">{t('admin.marketing.mediaAssetsLibrary.folders.alles')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Kanalen als 2-koloms grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
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
                {ch.labelKey ? t(ch.labelKey) : ch.label}
              </Label>
            </div>
          ))}
        </div>

        {/* Row 3: Zoek op checkboxes als 2-koloms grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <div className="flex items-center gap-1">
            <Checkbox
              id="search-subject"
              checked={searchOptions.searchIn.subject}
              onCheckedChange={() => toggleSearchIn('subject')}
              className="h-3.5 w-3.5"
            />
            <Label htmlFor="search-subject" className="text-xs cursor-pointer text-muted-foreground">{t('admin.marketing.templateDialog.onderwerp')}</Label>
          </div>
          <div className="flex items-center gap-1">
            <Checkbox
              id="search-content"
              checked={searchOptions.searchIn.content}
              onCheckedChange={() => toggleSearchIn('content')}
              className="h-3.5 w-3.5"
            />
            <Label htmlFor="search-content" className="text-xs cursor-pointer text-muted-foreground">{t('admin.marketing.emailBlockPalette.inhoud')}</Label>
          </div>
          <div className="flex items-center gap-1">
            <Checkbox
              id="search-sender"
              checked={searchOptions.searchIn.sender}
              onCheckedChange={() => toggleSearchIn('sender')}
              className="h-3.5 w-3.5"
            />
            <Label htmlFor="search-sender" className="text-xs cursor-pointer text-muted-foreground">{t('admin.inbox.advancedSearchFilters.afzender')}</Label>
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
            {t('admin.inbox.advancedSearchFilters.wissen')}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
