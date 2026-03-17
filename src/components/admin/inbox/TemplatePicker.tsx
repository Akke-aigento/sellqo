import { useState } from 'react';
import { FileText, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';

interface TemplatePickerProps {
  onSelect: (body: string) => void;
}

export function TemplatePicker({ onSelect }: TemplatePickerProps) {
  const { templates, isLoading, incrementUsage } = useMessageTemplates();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.body.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (template: typeof templates[0]) => {
    onSelect(template.body);
    incrementUsage.mutate(template.id);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <FileText className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Sjablonen</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Zoek sjabloon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="max-h-64">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground text-center">Laden...</div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              {templates.length === 0 ? 'Nog geen sjablonen aangemaakt' : 'Geen resultaten'}
            </div>
          ) : (
            filtered.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelect(template)}
                className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{template.name}</span>
                  {template.shortcut && (
                    <span className="text-xs text-muted-foreground ml-2">/{template.shortcut}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{template.body}</p>
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
