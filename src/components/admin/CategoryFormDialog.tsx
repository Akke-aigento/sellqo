import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, X, Globe, Image as ImageIcon } from 'lucide-react';
import { useImageUpload } from '@/hooks/useImageUpload';
import type { Category } from '@/types/product';
import { SEO_LANGUAGES, type SEOLanguage } from '@/types/seo';

const categorySchema = z.object({
  name: z.string().min(1, 'Naam is verplicht').max(100, 'Naam mag maximaal 100 tekens zijn'),
  slug: z.string().min(1, 'Slug is verplicht').max(100, 'Slug mag maximaal 100 tekens zijn')
    .regex(/^[a-z0-9-]+$/, 'Slug mag alleen kleine letters, cijfers en streepjes bevatten'),
  description: z.string().max(500, 'Beschrijving mag maximaal 500 tekens zijn').optional(),
  parent_id: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().optional(),
  image_url: z.string().url('Ongeldige URL').optional().or(z.literal('')),
  // Multi-language SEO fields
  meta_title_nl: z.string().max(60, 'Max 60 tekens').optional().or(z.literal('')),
  meta_title_en: z.string().max(60, 'Max 60 tekens').optional().or(z.literal('')),
  meta_title_de: z.string().max(60, 'Max 60 tekens').optional().or(z.literal('')),
  meta_title_fr: z.string().max(60, 'Max 60 tekens').optional().or(z.literal('')),
  meta_description_nl: z.string().max(160, 'Max 160 tekens').optional().or(z.literal('')),
  meta_description_en: z.string().max(160, 'Max 160 tekens').optional().or(z.literal('')),
  meta_description_de: z.string().max(160, 'Max 160 tekens').optional().or(z.literal('')),
  meta_description_fr: z.string().max(160, 'Max 160 tekens').optional().or(z.literal('')),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  parentId?: string | null;
  categories: Category[];
  onSubmit: (data: CategoryFormData) => Promise<void>;
  isLoading?: boolean;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  parentId,
  categories,
  onSubmit,
  isLoading,
}: CategoryFormDialogProps) {
  const isEditing = !!category;
  const [activeTab, setActiveTab] = useState('general');
  const [seoLang, setSeoLang] = useState<SEOLanguage>('nl');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, uploading } = useImageUpload();

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      parent_id: null,
      is_active: true,
      sort_order: 0,
      image_url: '',
      meta_title_nl: '',
      meta_title_en: '',
      meta_title_de: '',
      meta_title_fr: '',
      meta_description_nl: '',
      meta_description_en: '',
      meta_description_de: '',
      meta_description_fr: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (category) {
        form.reset({
          name: category.name,
          slug: category.slug,
          description: category.description || '',
          parent_id: category.parent_id || null,
          is_active: category.is_active ?? true,
          sort_order: category.sort_order ?? 0,
          image_url: category.image_url || '',
          // @ts-expect-error - New fields from migration
          meta_title_nl: category.meta_title_nl || '',
          // @ts-expect-error - New fields from migration
          meta_title_en: category.meta_title_en || '',
          // @ts-expect-error - New fields from migration
          meta_title_de: category.meta_title_de || '',
          // @ts-expect-error - New fields from migration
          meta_title_fr: category.meta_title_fr || '',
          // @ts-expect-error - New fields from migration
          meta_description_nl: category.meta_description_nl || '',
          // @ts-expect-error - New fields from migration
          meta_description_en: category.meta_description_en || '',
          // @ts-expect-error - New fields from migration
          meta_description_de: category.meta_description_de || '',
          // @ts-expect-error - New fields from migration
          meta_description_fr: category.meta_description_fr || '',
        });
      } else {
        form.reset({
          name: '',
          slug: '',
          description: '',
          parent_id: parentId || null,
          is_active: true,
          sort_order: 0,
          image_url: '',
          meta_title_nl: '',
          meta_title_en: '',
          meta_title_de: '',
          meta_title_fr: '',
          meta_description_nl: '',
          meta_description_en: '',
          meta_description_de: '',
          meta_description_fr: '',
        });
      }
      setActiveTab('general');
    }
  }, [open, category, parentId, form]);

  // Auto-generate slug from name
  const watchName = form.watch('name');
  useEffect(() => {
    if (!isEditing && watchName) {
      const slug = watchName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      form.setValue('slug', slug);
    }
  }, [watchName, isEditing, form]);

  const handleSubmit = async (data: CategoryFormData) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = await uploadImage(file);
    if (url) {
      form.setValue('image_url', url);
    }
  };

  const removeImage = () => {
    form.setValue('image_url', '');
  };

  // Filter out current category and its children from parent options
  const getAvailableParents = (cats: Category[], excludeId?: string): Category[] => {
    return cats.filter(c => c.id !== excludeId).map(c => ({
      ...c,
      children: c.children ? getAvailableParents(c.children, excludeId) : [],
    }));
  };

  const flattenCategories = (cats: Category[], prefix = ''): { id: string; label: string }[] => {
    return cats.flatMap(c => [
      { id: c.id, label: prefix + c.name },
      ...(c.children ? flattenCategories(c.children, prefix + '— ') : []),
    ]);
  };

  const availableParents = flattenCategories(getAvailableParents(categories, category?.id));
  
  const currentImageUrl = form.watch('image_url');


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Categorie bewerken' : 'Nieuwe categorie'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">Algemeen</TabsTrigger>
                <TabsTrigger value="image" className="flex items-center gap-1">
                  <ImageIcon className="h-4 w-4" />
                  Afbeelding
                </TabsTrigger>
                <TabsTrigger value="seo" className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  SEO
                </TabsTrigger>
              </TabsList>

              {/* General Tab */}
              <TabsContent value="general" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Naam *</FormLabel>
                      <FormControl>
                        <Input placeholder="Bijv. Elektronica" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug *</FormLabel>
                      <FormControl>
                        <Input placeholder="elektronica" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beschrijving</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Beschrijf de categorie..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parent_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hoofdcategorie</FormLabel>
                      <Select
                        value={field.value || 'none'}
                        onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Geen (hoofdcategorie)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Geen (hoofdcategorie)</SelectItem>
                          {availableParents.map((parent) => (
                            <SelectItem key={parent.id} value={parent.id}>
                              {parent.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center gap-4">
                  <FormField
                    control={form.control}
                    name="sort_order"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Sorteervolgorde</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 pt-6">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Actief</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Image Tab */}
              <TabsContent value="image" className="space-y-4 mt-4">
                <div className="space-y-4">
                  {/* Image Preview */}
                  {currentImageUrl && (
                    <div className="relative inline-block">
                      <img
                        src={currentImageUrl}
                        alt="Categorie afbeelding"
                        className="w-48 h-48 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={removeImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Upload Button */}
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {currentImageUrl ? 'Afbeelding vervangen' : 'Afbeelding uploaden'}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      JPG, PNG, WebP of GIF. Max 5MB.
                    </p>
                  </div>

                  {/* URL Input as fallback */}
                  <FormField
                    control={form.control}
                    name="image_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Of plak een URL</FormLabel>
                        <FormControl>
                          <Input 
                            type="url"
                            placeholder="https://..."
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Je kunt ook een directe URL naar een afbeelding invoeren
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* SEO Tab */}
              <TabsContent value="seo" className="space-y-4 mt-4">
                {/* Language Selector */}
                <div className="flex gap-2">
                  {SEO_LANGUAGES.map((lang) => (
                    <Button
                      key={lang.code}
                      type="button"
                      variant={seoLang === lang.code ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSeoLang(lang.code as SEOLanguage)}
                      className="gap-1"
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.code.toUpperCase()}</span>
                    </Button>
                  ))}
                </div>

                {seoLang === 'nl' && (
                  <>
                    <FormField
                      control={form.control}
                      name="meta_title_nl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meta titel (Nederlands)</FormLabel>
                          <FormControl>
                            <Input placeholder="SEO titel in Nederlands..." {...field} value={field.value || ''} />
                          </FormControl>
                          <FormDescription>{(field.value || '').length}/60 tekens</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="meta_description_nl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meta beschrijving (Nederlands)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="SEO beschrijving in Nederlands..." rows={3} className="resize-none" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormDescription>{(field.value || '').length}/160 tekens</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                {seoLang === 'en' && (
                  <>
                    <FormField
                      control={form.control}
                      name="meta_title_en"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meta titel (English)</FormLabel>
                          <FormControl>
                            <Input placeholder="SEO title in English..." {...field} value={field.value || ''} />
                          </FormControl>
                          <FormDescription>{(field.value || '').length}/60 tekens</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="meta_description_en"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meta beschrijving (English)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="SEO description in English..." rows={3} className="resize-none" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormDescription>{(field.value || '').length}/160 tekens</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                {seoLang === 'de' && (
                  <>
                    <FormField
                      control={form.control}
                      name="meta_title_de"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meta titel (Deutsch)</FormLabel>
                          <FormControl>
                            <Input placeholder="SEO Titel auf Deutsch..." {...field} value={field.value || ''} />
                          </FormControl>
                          <FormDescription>{(field.value || '').length}/60 tekens</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="meta_description_de"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meta beschrijving (Deutsch)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="SEO Beschreibung auf Deutsch..." rows={3} className="resize-none" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormDescription>{(field.value || '').length}/160 tekens</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                {seoLang === 'fr' && (
                  <>
                    <FormField
                      control={form.control}
                      name="meta_title_fr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meta titel (Français)</FormLabel>
                          <FormControl>
                            <Input placeholder="Titre SEO en français..." {...field} value={field.value || ''} />
                          </FormControl>
                          <FormDescription>{(field.value || '').length}/60 tekens</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="meta_description_fr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meta beschrijving (Français)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Description SEO en français..." rows={3} className="resize-none" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormDescription>{(field.value || '').length}/160 tekens</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* SEO Preview */}
                <div className="p-4 bg-muted rounded-lg space-y-1">
                  <p className="text-sm font-medium text-primary">
                    {form.watch(`meta_title_${seoLang}` as 'meta_title_nl') || form.watch('name') || 'Categorie titel'}
                  </p>
                  <p className="text-xs text-green-600">
                    https://jouwwinkel.nl/categorie/{form.watch('slug') || 'categorie-slug'}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {form.watch(`meta_description_${seoLang}` as 'meta_description_nl') || form.watch('description') || 'Beschrijving van de categorie...'}
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading || uploading}>
                {(isLoading || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Opslaan' : 'Toevoegen'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}