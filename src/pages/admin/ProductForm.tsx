import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowLeft, 
  Save, 
  Loader2,
  Upload,
  X,
  GripVertical,
  Star
} from 'lucide-react';
import { useProduct, useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import type { ProductFormData } from '@/types/product';

const productSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht').max(200, 'Naam mag maximaal 200 tekens zijn'),
  slug: z.string().min(1, 'Slug is verplicht').regex(/^[a-z0-9-]+$/, 'Slug mag alleen kleine letters, cijfers en streepjes bevatten'),
  description: z.string().max(5000, 'Beschrijving mag maximaal 5000 tekens zijn').optional().default(''),
  short_description: z.string().max(500, 'Korte beschrijving mag maximaal 500 tekens zijn').optional().default(''),
  price: z.coerce.number().min(0, 'Prijs moet 0 of hoger zijn'),
  compare_at_price: z.coerce.number().min(0).nullable().optional(),
  cost_price: z.coerce.number().min(0).nullable().optional(),
  sku: z.string().max(100).optional().default(''),
  barcode: z.string().max(100).optional().default(''),
  stock: z.coerce.number().int().min(0, 'Voorraad moet 0 of hoger zijn').default(0),
  track_inventory: z.boolean().default(true),
  allow_backorder: z.boolean().default(false),
  low_stock_threshold: z.coerce.number().int().min(0).default(5),
  images: z.array(z.string()).default([]),
  featured_image: z.string().optional().default(''),
  category_id: z.string().optional().default(''),
  tags: z.array(z.string()).default([]),
  meta_title: z.string().max(60, 'Meta titel mag maximaal 60 tekens zijn').optional().default(''),
  meta_description: z.string().max(160, 'Meta beschrijving mag maximaal 160 tekens zijn').optional().default(''),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  weight: z.coerce.number().min(0).nullable().optional(),
  requires_shipping: z.boolean().default(true),
});

type FormValues = z.infer<typeof productSchema>;

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  
  const { currentTenant } = useTenant();
  const { data: product, isLoading: productLoading } = useProduct(id);
  const { createProduct, updateProduct } = useProducts();
  const { categories } = useCategories();
  const { uploadImage, uploading } = useImageUpload();
  
  const [tagsInput, setTagsInput] = useState('');

  const form = useForm<FormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      short_description: '',
      price: 0,
      compare_at_price: null,
      cost_price: null,
      sku: '',
      barcode: '',
      stock: 0,
      track_inventory: true,
      allow_backorder: false,
      low_stock_threshold: 5,
      images: [],
      featured_image: '',
      category_id: '',
      tags: [],
      meta_title: '',
      meta_description: '',
      is_active: true,
      is_featured: false,
      weight: null,
      requires_shipping: true,
    },
    values: product ? {
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      short_description: product.short_description || '',
      price: product.price,
      compare_at_price: product.compare_at_price,
      cost_price: product.cost_price,
      sku: product.sku || '',
      barcode: product.barcode || '',
      stock: product.stock,
      track_inventory: product.track_inventory,
      allow_backorder: product.allow_backorder,
      low_stock_threshold: product.low_stock_threshold,
      images: product.images || [],
      featured_image: product.featured_image || '',
      category_id: product.category_id || '',
      tags: product.tags || [],
      meta_title: product.meta_title || '',
      meta_description: product.meta_description || '',
      is_active: product.is_active,
      is_featured: product.is_featured,
      weight: product.weight,
      requires_shipping: product.requires_shipping,
    } : undefined,
  });

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (value: string) => {
    form.setValue('name', value);
    if (!isEditing || !form.getValues('slug')) {
      form.setValue('slug', generateSlug(value));
    }
  };

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const currentImages = form.getValues('images') || [];
    
    for (const file of Array.from(files)) {
      const url = await uploadImage(file);
      if (url) {
        currentImages.push(url);
        // Set first image as featured if none set
        if (!form.getValues('featured_image')) {
          form.setValue('featured_image', url);
        }
      }
    }
    
    form.setValue('images', currentImages);
    e.target.value = '';
  };

  const removeImage = (url: string) => {
    const images = form.getValues('images').filter(img => img !== url);
    form.setValue('images', images);
    
    if (form.getValues('featured_image') === url) {
      form.setValue('featured_image', images[0] || '');
    }
  };

  const setFeaturedImage = (url: string) => {
    form.setValue('featured_image', url);
  };

  // Tags handler
  const addTag = () => {
    if (!tagsInput.trim()) return;
    const tags = form.getValues('tags');
    if (!tags.includes(tagsInput.trim())) {
      form.setValue('tags', [...tags, tagsInput.trim()]);
    }
    setTagsInput('');
  };

  const removeTag = (tag: string) => {
    form.setValue('tags', form.getValues('tags').filter(t => t !== tag));
  };

  const onSubmit = async (data: FormValues) => {
    if (isEditing && id) {
      await updateProduct.mutateAsync({ id, data });
    } else {
      await createProduct.mutateAsync(data as any);
    }
    navigate('/admin/products');
  };

  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Selecteer eerst een winkel</p>
      </div>
    );
  }

  if (isEditing && productLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/products')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? 'Product bewerken' : 'Nieuw product'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? `Bewerk ${product?.name}` : 'Voeg een nieuw product toe aan je catalogus'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/products')}>
            Annuleren
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opslaan...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Opslaan
              </>
            )}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basis</TabsTrigger>
              <TabsTrigger value="pricing">Prijzen</TabsTrigger>
              <TabsTrigger value="inventory">Voorraad</TabsTrigger>
              <TabsTrigger value="images">Afbeeldingen</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Product informatie</CardTitle>
                    <CardDescription>Basis gegevens van het product</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Naam *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              onChange={(e) => handleNameChange(e.target.value)}
                              placeholder="Product naam"
                            />
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
                            <Input {...field} placeholder="product-naam" />
                          </FormControl>
                          <FormDescription>
                            URL-vriendelijke naam voor het product
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="short_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Korte beschrijving</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Korte beschrijving voor productlijsten"
                              rows={2}
                            />
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
                          <FormLabel>Volledige beschrijving</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Uitgebreide productbeschrijving"
                              rows={6}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Organisatie</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="category_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categorie</FormLabel>
                            <Select 
                              value={field.value} 
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecteer categorie" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">Geen categorie</SelectItem>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-2">
                        <Label>Tags</Label>
                        <div className="flex gap-2">
                          <Input
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            placeholder="Voeg tag toe"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addTag();
                              }
                            }}
                          />
                          <Button type="button" variant="secondary" onClick={addTag}>
                            Toevoegen
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {form.watch('tags').map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
                            >
                              {tag}
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="is_active"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <FormLabel>Actief</FormLabel>
                              <FormDescription>
                                Product is zichtbaar in de winkel
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="is_featured"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <FormLabel>Uitgelicht</FormLabel>
                              <FormDescription>
                                Toon op homepage en in speciale secties
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Pricing Tab */}
            <TabsContent value="pricing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Prijzen</CardTitle>
                  <CardDescription>Stel de prijzen in voor dit product</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Verkoopprijs *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                              <Input 
                                {...field} 
                                type="number" 
                                step="0.01" 
                                min="0"
                                className="pl-7"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="compare_at_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vergelijkingsprijs</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                              <Input 
                                {...field} 
                                value={field.value ?? ''}
                                type="number" 
                                step="0.01" 
                                min="0"
                                className="pl-7"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            "Was" prijs voor kortingen
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cost_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inkoopprijs</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                              <Input 
                                {...field} 
                                value={field.value ?? ''}
                                type="number" 
                                step="0.01" 
                                min="0"
                                className="pl-7"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Voor winstberekening (niet zichtbaar)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Inventory Tab */}
            <TabsContent value="inventory" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Identificatie</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="ABC-123" />
                          </FormControl>
                          <FormDescription>
                            Stock Keeping Unit
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="barcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Barcode</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="8712345678901" />
                          </FormControl>
                          <FormDescription>
                            EAN, UPC of GTIN
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Voorraad</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="track_inventory"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel>Voorraad bijhouden</FormLabel>
                            <FormDescription>
                              Houd de voorraad automatisch bij
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {form.watch('track_inventory') && (
                      <>
                        <FormField
                          control={form.control}
                          name="stock"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Huidige voorraad</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min="0" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="low_stock_threshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lage voorraad drempel</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min="0" />
                              </FormControl>
                              <FormDescription>
                                Ontvang een waarschuwing bij deze voorraad
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="allow_backorder"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-3">
                              <div>
                                <FormLabel>Backorders toestaan</FormLabel>
                                <FormDescription>
                                  Klanten kunnen bestellen als uitverkocht
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Verzending</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="requires_shipping"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel>Verzending vereist</FormLabel>
                            <FormDescription>
                              Dit is een fysiek product
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {form.watch('requires_shipping') && (
                      <FormField
                        control={form.control}
                        name="weight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gewicht (kg)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={field.value ?? ''}
                                type="number" 
                                step="0.01" 
                                min="0"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Product afbeeldingen</CardTitle>
                  <CardDescription>
                    Upload afbeeldingen van je product. De eerste afbeelding wordt gebruikt als hoofdafbeelding.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Upload area */}
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {uploading ? (
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground">
                                <span className="font-semibold">Klik om te uploaden</span> of sleep bestanden hierheen
                              </p>
                              <p className="text-xs text-muted-foreground">
                                PNG, JPG, WebP of GIF (max. 5MB)
                              </p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          multiple
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                      </label>
                    </div>

                    {/* Image grid */}
                    {form.watch('images').length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {form.watch('images').map((url, index) => (
                          <div
                            key={url}
                            className={cn(
                              "relative group aspect-square rounded-lg overflow-hidden border-2",
                              form.watch('featured_image') === url 
                                ? "border-primary" 
                                : "border-transparent"
                            )}
                          >
                            <img
                              src={url}
                              alt={`Product ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                onClick={() => setFeaturedImage(url)}
                                title="Maak hoofdafbeelding"
                              >
                                <Star className={cn(
                                  "h-4 w-4",
                                  form.watch('featured_image') === url && "fill-amber-500 text-amber-500"
                                )} />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                onClick={() => removeImage(url)}
                                title="Verwijderen"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            {form.watch('featured_image') === url && (
                              <div className="absolute top-2 left-2">
                                <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                                  Hoofd
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SEO Tab */}
            <TabsContent value="seo" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Zoekmachine optimalisatie</CardTitle>
                  <CardDescription>
                    Optimaliseer hoe je product verschijnt in zoekresultaten
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="meta_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta titel</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={form.watch('name') || 'Product titel'} />
                        </FormControl>
                        <FormDescription>
                          {field.value?.length || 0}/60 tekens - Laat leeg om productnaam te gebruiken
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="meta_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta beschrijving</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder={form.watch('short_description') || 'Korte beschrijving voor zoekmachines'}
                            rows={3}
                          />
                        </FormControl>
                        <FormDescription>
                          {field.value?.length || 0}/160 tekens - Laat leeg om korte beschrijving te gebruiken
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Preview */}
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Zoekresultaat voorbeeld</p>
                    <div className="space-y-1">
                      <p className="text-blue-600 text-lg hover:underline cursor-pointer">
                        {form.watch('meta_title') || form.watch('name') || 'Product titel'}
                      </p>
                      <p className="text-sm text-green-700">
                        jouwwinkel.nl/producten/{form.watch('slug') || 'product-slug'}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {form.watch('meta_description') || form.watch('short_description') || 'Productbeschrijving verschijnt hier in zoekresultaten...'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  );
}
