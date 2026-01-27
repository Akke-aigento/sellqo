import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { HomepageSection, HeroContent, TextImageContent } from '@/types/storefront';
import { cn } from '@/lib/utils';

interface QuickEditPanelProps {
  section: HomepageSection;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<HomepageSection>) => void;
}

export function QuickEditPanel({ section, isOpen, onClose, onUpdate }: QuickEditPanelProps) {
  const updateContent = (key: string, value: unknown) => {
    onUpdate({
      content: { ...section.content, [key]: value },
    });
  };

  const updateSettings = (key: string, value: unknown) => {
    onUpdate({
      settings: { ...section.settings, [key]: value },
    });
  };

  const renderSectionSettings = () => {
    switch (section.section_type) {
      case 'hero':
        const heroContent = section.content as HeroContent;
        return (
          <>
            <div className="space-y-2">
              <Label>Button Tekst</Label>
              <Input
                value={heroContent.button_text || ''}
                onChange={(e) => updateContent('button_text', e.target.value)}
                placeholder="Bekijk collectie"
              />
            </div>
            <div className="space-y-2">
              <Label>Button Link</Label>
              <Input
                value={heroContent.button_link || ''}
                onChange={(e) => updateContent('button_link', e.target.value)}
                placeholder="/shop"
              />
            </div>
            <div className="space-y-2">
              <Label>Tekst Uitlijning</Label>
              <Select
                value={heroContent.text_alignment || 'center'}
                onValueChange={(v) => updateContent('text_alignment', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Links</SelectItem>
                  <SelectItem value="center">Gecentreerd</SelectItem>
                  <SelectItem value="right">Rechts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Overlay Opacity: {Math.round((heroContent.overlay_opacity ?? 0.4) * 100)}%</Label>
              <Slider
                value={[(heroContent.overlay_opacity ?? 0.4) * 100]}
                onValueChange={([v]) => updateContent('overlay_opacity', v / 100)}
                min={0}
                max={100}
                step={5}
              />
            </div>
          </>
        );

      case 'text_image':
        const textImageContent = section.content as TextImageContent;
        return (
          <>
            <div className="space-y-2">
              <Label>Afbeelding Positie</Label>
              <Select
                value={textImageContent.image_position || 'right'}
                onValueChange={(v) => updateContent('image_position', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Links</SelectItem>
                  <SelectItem value="right">Rechts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Button Tekst</Label>
              <Input
                value={textImageContent.button_text || ''}
                onChange={(e) => updateContent('button_text', e.target.value)}
                placeholder="Lees meer"
              />
            </div>
            <div className="space-y-2">
              <Label>Button Link</Label>
              <Input
                value={textImageContent.button_link || ''}
                onChange={(e) => updateContent('button_link', e.target.value)}
                placeholder="/about"
              />
            </div>
          </>
        );

      default:
        return (
          <p className="text-sm text-muted-foreground">
            Geen extra instellingen beschikbaar voor dit sectietype.
          </p>
        );
    }
  };

  return (
    <div
      className={cn(
        'fixed top-0 right-0 h-full w-80 bg-background border-l shadow-xl z-50',
        'transform transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold capitalize">
          {section.section_type.replace('_', ' ')} Instellingen
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-65px)]">
        <div className="p-4 space-y-6">
          {/* Common settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Algemeen</h4>
            <div className="flex items-center justify-between">
              <Label>Zichtbaar</Label>
              <Switch
                checked={section.is_visible}
                onCheckedChange={(checked) => onUpdate({ is_visible: checked })}
              />
            </div>
          </div>

          {/* Background settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Achtergrond</h4>
            <div className="space-y-2">
              <Label>Achtergrondkleur</Label>
              <Input
                type="color"
                value={section.settings.background_color || '#ffffff'}
                onChange={(e) => updateSettings('background_color', e.target.value)}
                className="h-10 w-full"
              />
            </div>
          </div>

          {/* Section-specific settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Sectie Opties</h4>
            {renderSectionSettings()}
          </div>

          {/* Spacing settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Spacing</h4>
            <div className="space-y-2">
              <Label>Padding Boven</Label>
              <Select
                value={section.settings.padding_top || '0'}
                onValueChange={(v) => updateSettings('padding_top', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Geen</SelectItem>
                  <SelectItem value="1rem">Klein</SelectItem>
                  <SelectItem value="2rem">Medium</SelectItem>
                  <SelectItem value="4rem">Groot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Padding Onder</Label>
              <Select
                value={section.settings.padding_bottom || '0'}
                onValueChange={(v) => updateSettings('padding_bottom', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Geen</SelectItem>
                  <SelectItem value="1rem">Klein</SelectItem>
                  <SelectItem value="2rem">Medium</SelectItem>
                  <SelectItem value="4rem">Groot</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
