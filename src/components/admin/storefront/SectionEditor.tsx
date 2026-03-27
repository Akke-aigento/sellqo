import { useState, useMemo } from 'react';
import { Save, Search, X, Plus, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { HomepageSection, HeroContent, TextImageContent, NewsletterContent, TestimonialsContent, CategoriesGridContent, UspBarContent, CtaBannerContent } from '@/types/storefront';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import { VisualMediaPicker } from './visual-editor/VisualMediaPicker';

interface SectionEditorProps {
  section: HomepageSection;
  onSave: (section: HomepageSection) => void;
  onCancel: () => void;
}

export function SectionEditor({ section, onSave, onCancel }: SectionEditorProps) {
  const [formData, setFormData] = useState<HomepageSection>(section);
  const { categories } = useCategories();
  const { products } = useProducts();

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
              <Label>Afbeelding</Label>
              <VisualMediaPicker
                value={content.image_url || ''}
                onSelect={(url) => handleContentChange('image_url', url)}
                aspectRatio="video"
                placeholder="Klik om hero afbeelding te uploaden"
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
                <Select
                  value={content.button_link || ''}
                  onValueChange={(value) => handleContentChange('button_link', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer pagina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="/products">Alle Producten</SelectItem>
                    <SelectItem value="/cart">Winkelwagen</SelectItem>
                    <SelectItem value="/">Homepage</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={`/products?category=${cat.slug}`}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <FeaturedProductsEditor
            content={formData.content as any}
            onContentChange={handleContentChange}
          />
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
              <Label>Afbeelding</Label>
              <VisualMediaPicker
                value={content.image_url || ''}
                onSelect={(url) => handleContentChange('image_url', url)}
                aspectRatio="square"
                placeholder="Klik om afbeelding te uploaden"
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
                <Select
                  value={content.button_link || ''}
                  onValueChange={(value) => handleContentChange('button_link', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer pagina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="/products">Alle Producten</SelectItem>
                    <SelectItem value="/cart">Winkelwagen</SelectItem>
                    <SelectItem value="/">Homepage</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={`/products?category=${cat.slug}`}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <VisualMediaPicker
                value={(formData.content as any).poster_url || ''}
                onSelect={(url) => handleContentChange('poster_url', url)}
                aspectRatio="video"
                placeholder="Klik om poster afbeelding te uploaden"
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

      case 'external_reviews': {
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Weergave stijl</Label>
              <Select
                value={(formData.content as any).display_style || 'carousel'}
                onValueChange={(value) => handleContentChange('display_style', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="carousel">Carousel</SelectItem>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="list">Lijst</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Maximum aantal reviews</Label>
              <Select
                value={String((formData.content as any).max_reviews || 6)}
                onValueChange={(value) => handleContentChange('max_reviews', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 reviews</SelectItem>
                  <SelectItem value="6">6 reviews</SelectItem>
                  <SelectItem value="9">9 reviews</SelectItem>
                  <SelectItem value="12">12 reviews</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Alleen uitgelichte reviews</Label>
              <Switch
                checked={(formData.content as any).featured_only === true}
                onCheckedChange={(checked) => handleContentChange('featured_only', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Toon platform badges</Label>
              <Switch
                checked={(formData.content as any).show_platform_badges !== false}
                onCheckedChange={(checked) => handleContentChange('show_platform_badges', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Toon aggregate score</Label>
              <Switch
                checked={(formData.content as any).show_aggregate_score !== false}
                onCheckedChange={(checked) => handleContentChange('show_aggregate_score', checked)}
              />
            </div>
          </div>
        );
      }

      case 'testimonials': {
        const reviews = ((formData.content as TestimonialsContent).reviews || []);
        const addReview = () => {
          handleContentChange('reviews', [...reviews, { name: '', text: '', rating: 5 }]);
        };
        const updateReview = (idx: number, field: string, value: unknown) => {
          const updated = reviews.map((r, i) => i === idx ? { ...r, [field]: value } : r);
          handleContentChange('reviews', updated);
        };
        const removeReview = (idx: number) => {
          handleContentChange('reviews', reviews.filter((_, i) => i !== idx));
        };
        return (
          <div className="space-y-4">
            {reviews.map((review, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Review {idx + 1}</Label>
                  <Button variant="ghost" size="sm" onClick={() => removeReview(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Naam</Label>
                    <Input
                      value={review.name}
                      onChange={(e) => updateReview(idx, 'name', e.target.value)}
                      placeholder="Naam reviewer"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Beoordeling</Label>
                    <div className="flex gap-1 pt-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => updateReview(idx, 'rating', star)}
                          className="focus:outline-none"
                        >
                          <Star className={`h-5 w-5 ${star <= (review.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tekst</Label>
                  <Textarea
                    value={review.text}
                    onChange={(e) => updateReview(idx, 'text', e.target.value)}
                    rows={2}
                    placeholder="Wat zegt de klant..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Avatar (optioneel)</Label>
                  <Input
                    value={review.avatar_url || ''}
                    onChange={(e) => updateReview(idx, 'avatar_url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addReview} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Review toevoegen
            </Button>
          </div>
        );
      }

      case 'announcement': {
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tekst</Label>
              <Input
                value={(formData.content as any).text || ''}
                onChange={(e) => handleContentChange('text', e.target.value)}
                placeholder="Gratis verzending vanaf €50!"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Link URL (optioneel)</Label>
                <Input
                  value={(formData.content as any).link_url || ''}
                  onChange={(e) => handleContentChange('link_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>Link tekst (optioneel)</Label>
                <Input
                  value={(formData.content as any).link_text || ''}
                  onChange={(e) => handleContentChange('link_text', e.target.value)}
                  placeholder="Meer info →"
                />
              </div>
            </div>
          </div>
        );
      }

      case 'categories_grid': {
        const catContent = formData.content as CategoriesGridContent;
        const selectedCatIds = catContent.category_ids || [];
        const toggleCategory = (id: string) => {
          const next = selectedCatIds.includes(id)
            ? selectedCatIds.filter(cid => cid !== id)
            : [...selectedCatIds, id];
          handleContentChange('category_ids', next);
        };
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categorieën selecteren (laat leeg voor alle)</Label>
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {categories.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0">
                    <Checkbox
                      checked={selectedCatIds.includes(cat.id)}
                      onCheckedChange={() => toggleCategory(cat.id)}
                    />
                    <span className="text-sm">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kolommen</Label>
              <Select
                value={String(catContent.columns || 3)}
                onValueChange={(v) => handleContentChange('columns', parseInt(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 kolommen</SelectItem>
                  <SelectItem value="3">3 kolommen</SelectItem>
                  <SelectItem value="4">4 kolommen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Toon beschrijving</Label>
              <Switch
                checked={catContent.show_description === true}
                onCheckedChange={(checked) => handleContentChange('show_description', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Toon productaantal</Label>
              <Switch
                checked={catContent.show_product_count === true}
                onCheckedChange={(checked) => handleContentChange('show_product_count', checked)}
              />
            </div>
          </div>
        );
      }

      case 'usp_bar': {
        const uspContent = formData.content as UspBarContent;
        const items = uspContent.items || [];
        const addItem = () => {
          handleContentChange('items', [...items, { icon: 'check', title: '', description: '' }]);
        };
        const updateItem = (idx: number, field: string, value: string) => {
          const updated = items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
          handleContentChange('items', updated);
        };
        const removeItem = (idx: number) => {
          handleContentChange('items', items.filter((_, i) => i !== idx));
        };
        const iconOptions = [
          { value: 'truck', label: 'Verzending' },
          { value: 'refresh', label: 'Retour' },
          { value: 'shield', label: 'Veilig' },
          { value: 'lock', label: 'Beveiligd' },
          { value: 'credit_card', label: 'Betaling' },
          { value: 'award', label: 'Keurmerk' },
          { value: 'clock', label: 'Klok' },
          { value: 'heart', label: 'Hart' },
          { value: 'headphones', label: 'Support' },
          { value: 'check', label: 'Vinkje' },
        ];
        return (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">USP {idx + 1}</Label>
                  <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Icoon</Label>
                    <Select value={item.icon} onValueChange={(v) => updateItem(idx, 'icon', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {iconOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Titel</Label>
                    <Input
                      value={item.title}
                      onChange={(e) => updateItem(idx, 'title', e.target.value)}
                      placeholder="Gratis verzending"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Beschrijving (opt.)</Label>
                    <Input
                      value={item.description || ''}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      placeholder="Vanaf €50"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              USP toevoegen
            </Button>
          </div>
        );
      }

      case 'cta_banner': {
        const ctaContent = formData.content as CtaBannerContent;
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Achtergrond Afbeelding (optioneel)</Label>
              <VisualMediaPicker
                value={ctaContent.background_image || ''}
                onSelect={(url) => handleContentChange('background_image', url)}
                aspectRatio="video"
                placeholder="Klik om achtergrondafbeelding te uploaden"
              />
            </div>
            <div className="space-y-2">
              <Label>Achtergrondkleur (als geen afbeelding)</Label>
              <Input
                type="color"
                value={ctaContent.background_color || '#000000'}
                onChange={(e) => handleContentChange('background_color', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Knop Tekst</Label>
                <Input
                  value={ctaContent.button_text || ''}
                  onChange={(e) => handleContentChange('button_text', e.target.value)}
                  placeholder="Bekijk Aanbiedingen"
                />
              </div>
              <div className="space-y-2">
                <Label>Knop Link</Label>
                <Select
                  value={ctaContent.button_link || ''}
                  onValueChange={(value) => handleContentChange('button_link', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer pagina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="/products">Alle Producten</SelectItem>
                    <SelectItem value="/cart">Winkelwagen</SelectItem>
                    <SelectItem value="/">Homepage</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={`/products?category=${cat.slug}`}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

// Inline product picker for Featured Products section
function FeaturedProductsEditor({ content, onContentChange }: {
  content: { product_ids?: string[]; max_products?: number; show_prices?: boolean };
  onContentChange: (key: string, value: unknown) => void;
}) {
  const { products = [] } = useProducts();
  const [search, setSearch] = useState('');
  const selectedIds: string[] = content.product_ids || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p: any) => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
  }, [products, search]);

  const toggleProduct = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(pid => pid !== id)
      : [...selectedIds, id];
    onContentChange('product_ids', next);
  };

  const removeProduct = (id: string) => {
    onContentChange('product_ids', selectedIds.filter(pid => pid !== id));
  };

  const selectedProducts = products.filter((p: any) => selectedIds.includes(p.id));

  return (
    <div className="space-y-4">
      {/* Selected products */}
      {selectedProducts.length > 0 && (
        <div className="space-y-2">
          <Label>Geselecteerde producten ({selectedProducts.length})</Label>
          <div className="flex flex-wrap gap-2">
            {selectedProducts.map((p: any) => (
              <span key={p.id} className="inline-flex items-center gap-1 bg-muted text-sm rounded-full px-3 py-1">
                {p.name}
                <button type="button" onClick={() => removeProduct(p.id)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Product search */}
      <div className="space-y-2">
        <Label>Producten zoeken</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek op naam of SKU..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Product list */}
      <div className="border rounded-md max-h-60 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3">Geen producten gevonden</p>
        ) : (
          filtered.map((product: any) => (
            <label
              key={product.id}
              className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
            >
              <Checkbox
                checked={selectedIds.includes(product.id)}
                onCheckedChange={() => toggleProduct(product.id)}
              />
              {product.images?.[0] && (
                <img src={product.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{product.name}</p>
                {product.sku && <p className="text-xs text-muted-foreground">{product.sku}</p>}
              </div>
              <span className="text-sm text-muted-foreground">&euro;{Number(product.price).toFixed(2)}</span>
            </label>
          ))
        )}
      </div>

      {/* Settings */}
      <div className="space-y-2">
        <Label>Maximum aantal producten</Label>
        <Select
          value={String(content.max_products || 8)}
          onValueChange={(value) => onContentChange('max_products', parseInt(value))}
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
          checked={content.show_prices !== false}
          onCheckedChange={(checked) => onContentChange('show_prices', checked)}
        />
      </div>
    </div>
  );
}
