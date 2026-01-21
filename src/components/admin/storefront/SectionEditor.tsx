import { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { HomepageSection, HeroContent, TextImageContent, NewsletterContent } from '@/types/storefront';
import { useCategories } from '@/hooks/useCategories';

interface SectionEditorProps {
  section: HomepageSection;
  onSave: (section: HomepageSection) => void;
  onCancel: () => void;
}

export function SectionEditor({ section, onSave, onCancel }: SectionEditorProps) {
  const [formData, setFormData] = useState<HomepageSection>(section);
  const { categories } = useCategories();

  const handleContentChange = (key: string, value: unknown) => {
    setFormData({
      ...formData,
      content: {
        ...formData.content,
        [key]: value,
      },
    });
  };

  const handleSave = () => {
    onSave(formData);
  };

  const renderContentFields = () => {
    switch (section.section_type) {
      case 'hero': {
        const content = formData.content as HeroContent;
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Afbeelding URL</Label>
              <Input
                value={content.image_url || ''}
                onChange={(e) => handleContentChange('image_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Knop Tekst</Label>
                <Input
                  value={content.button_text || ''}
                  onChange={(e) => handleContentChange('button_text', e.target.value)}
                  placeholder="Shop Nu"
                />
              </div>
              <div className="space-y-2">
                <Label>Knop Link</Label>
                <Input
                  value={content.button_link || ''}
                  onChange={(e) => handleContentChange('button_link', e.target.value)}
                  placeholder="/products"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tekst Uitlijning</Label>
              <Select
                value={content.text_alignment || 'center'}
                onValueChange={(value) => handleContentChange('text_alignment', value)}
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
          </div>
        );
      }

      case 'featured_products': {
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Maximum aantal producten</Label>
              <Select
                value={String((formData.content as any).max_products || 8)}
                onValueChange={(value) => handleContentChange('max_products', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 producten</SelectItem>
                  <SelectItem value="6">6 producten</SelectItem>
                  <SelectItem value="8">8 producten</SelectItem>
                  <SelectItem value="12">12 producten</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Toon prijzen</Label>
              <Switch
                checked={(formData.content as any).show_prices !== false}
                onCheckedChange={(checked) => handleContentChange('show_prices', checked)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Tip: Markeer producten als "uitgelicht" in het productbeheer om ze hier te tonen.
            </p>
          </div>
        );
      }

      case 'collection': {
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categorie</Label>
              <Select
                value={(formData.content as any).category_id || ''}
                onValueChange={(value) => handleContentChange('category_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer categorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Maximum aantal producten</Label>
              <Select
                value={String((formData.content as any).max_products || 6)}
                onValueChange={(value) => handleContentChange('max_products', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 producten</SelectItem>
                  <SelectItem value="6">6 producten</SelectItem>
                  <SelectItem value="8">8 producten</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Toon "Bekijk alles" link</Label>
              <Switch
                checked={(formData.content as any).show_view_all !== false}
                onCheckedChange={(checked) => handleContentChange('show_view_all', checked)}
              />
            </div>
          </div>
        );
      }

      case 'text_image': {
        const content = formData.content as TextImageContent;
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tekst</Label>
              <Textarea
                value={content.text || ''}
                onChange={(e) => handleContentChange('text', e.target.value)}
                rows={4}
                placeholder="Vertel je verhaal..."
              />
            </div>
            <div className="space-y-2">
              <Label>Afbeelding URL</Label>
              <Input
                value={content.image_url || ''}
                onChange={(e) => handleContentChange('image_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Afbeelding Positie</Label>
              <Select
                value={content.image_position || 'right'}
                onValueChange={(value) => handleContentChange('image_position', value)}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Knop Tekst (optioneel)</Label>
                <Input
                  value={content.button_text || ''}
                  onChange={(e) => handleContentChange('button_text', e.target.value)}
                  placeholder="Lees meer"
                />
              </div>
              <div className="space-y-2">
                <Label>Knop Link</Label>
                <Input
                  value={content.button_link || ''}
                  onChange={(e) => handleContentChange('button_link', e.target.value)}
                  placeholder="/about"
                />
              </div>
            </div>
          </div>
        );
      }

      case 'newsletter': {
        const content = formData.content as NewsletterContent;
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Heading</Label>
              <Input
                value={content.heading || ''}
                onChange={(e) => handleContentChange('heading', e.target.value)}
                placeholder="Blijf op de hoogte"
              />
            </div>
            <div className="space-y-2">
              <Label>Beschrijving</Label>
              <Textarea
                value={content.description || ''}
                onChange={(e) => handleContentChange('description', e.target.value)}
                rows={2}
                placeholder="Ontvang als eerste onze nieuwste aanbiedingen..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Knop Tekst</Label>
                <Input
                  value={content.button_text || ''}
                  onChange={(e) => handleContentChange('button_text', e.target.value)}
                  placeholder="Aanmelden"
                />
              </div>
              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={content.placeholder || ''}
                  onChange={(e) => handleContentChange('placeholder', e.target.value)}
                  placeholder="je@email.com"
                />
              </div>
            </div>
          </div>
        );
      }

      case 'video': {
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Video URL</Label>
              <Input
                value={(formData.content as any).video_url || ''}
                onChange={(e) => handleContentChange('video_url', e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
              <p className="text-xs text-muted-foreground">
                Ondersteunt YouTube, Vimeo en directe video links
              </p>
            </div>
            <div className="space-y-2">
              <Label>Poster Afbeelding (optioneel)</Label>
              <Input
                value={(formData.content as any).poster_url || ''}
                onChange={(e) => handleContentChange('poster_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Autoplay</Label>
              <Switch
                checked={(formData.content as any).autoplay === true}
                onCheckedChange={(checked) => handleContentChange('autoplay', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Loop</Label>
              <Switch
                checked={(formData.content as any).loop === true}
                onCheckedChange={(checked) => handleContentChange('loop', checked)}
              />
            </div>
          </div>
        );
      }

      default:
        return (
          <p className="text-muted-foreground">
            Geen specifieke instellingen voor dit sectietype.
          </p>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Common fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Titel</Label>
          <Input
            value={formData.title || ''}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Sectie titel"
          />
        </div>
        <div className="space-y-2">
          <Label>Subtitel (optioneel)</Label>
          <Input
            value={formData.subtitle || ''}
            onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
            placeholder="Extra beschrijving"
          />
        </div>
      </div>

      {/* Section-specific fields */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-4">Inhoud</h4>
        {renderContentFields()}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Annuleren
        </Button>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Opslaan
        </Button>
      </div>
    </div>
  );
}
