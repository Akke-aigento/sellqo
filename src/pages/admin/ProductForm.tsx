import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowLeft, 
  Save, 
  Loader2,
  Upload,
  X,
  Star,
  Package,
  Download,
  Briefcase,
  RefreshCw,
  Layers,
  Key,
  FileText,
  Trash2,
  Eye,
  Plus,
  CreditCard,
  Gift,
  Languages,
  ExternalLink
} from 'lucide-react';
import { useProduct, useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useImageUpload } from '@/hooks/useImageUpload';
import { ProductMarketplaceTab } from '@/components/admin/marketplace/ProductMarketplaceTab';
import { ProductDescriptionEditor } from '@/components/admin/products/ProductDescriptionEditor';
import { useProductFiles } from '@/hooks/useProductFiles';
import { useLicenseKeys } from '@/hooks/useLicenseKeys';
import { useTenant } from '@/hooks/useTenant';
import { useGiftCardDesigns } from '@/hooks/useGiftCardDesigns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import type { ProductFormData, ProductType, DigitalDeliveryType } from '@/types/product';
import { productTypeInfo, digitalDeliveryTypeInfo } from '@/types/product';
import { TRANSLATION_LANGUAGES, type TranslationLanguage } from '@/types/translation';

const productSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht').max(200, 'Naam mag maximaal 200 tekens zijn'),
  slug: z.string().min(1, 'Slug is verplicht').regex(/^[a-z0-9-]+$/, 'Slug mag alleen kleine letters, cijfers en streepjes bevatten'),
  description: z.string().max(20000, 'Beschrijving is te lang').optional().default(''),
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
  hide_from_storefront: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  weight: z.coerce.number().min(0).nullable().optional(),
  requires_shipping: z.boolean().default(true),
  // Digital product fields
  product_type: z.enum(['physical', 'digital', 'service', 'subscription', 'bundle', 'gift_card']).default('physical'),
  digital_delivery_type: z.enum(['download', 'license_key', 'access_url', 'email_attachment', 'qr_code', 'external_service']).nullable().optional(),
  download_limit: z.coerce.number().int().min(0).nullable().optional(),
  download_expiry_hours: z.coerce.number().int().min(1).nullable().optional(),
  license_generator: z.enum(['manual', 'auto']).nullable().optional(),
  access_duration_days: z.coerce.number().int().min(1).nullable().optional(),
  // Gift card fields
  gift_card_denominations: z.array(z.number()).nullable().optional(),
  gift_card_min_amount: z.coerce.number().min(0).nullable().optional(),
  gift_card_max_amount: z.coerce.number().min(0).nullable().optional(),
  gift_card_allow_custom: z.boolean().default(false),
  gift_card_expiry_months: z.coerce.number().int().min(1).nullable().optional(),
  gift_card_design_id: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof productSchema>;

const productTypeIcons: Record<ProductType, React.ReactNode> = {
  physical: <Package className="h-6 w-6" />,
  digital: <Download className="h-6 w-6" />,
  service: <Briefcase className="h-6 w-6" />,
  subscription: <RefreshCw className="h-6 w-6" />,
  bundle: <Layers className="h-6 w-6" />,
  gift_card: <CreditCard className="h-6 w-6" />,
};

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  
  const { currentTenant } = useTenant();
  const { data: product, isLoading: productLoading } = useProduct(id);
  const { createProduct, updateProduct } = useProducts();
  const { categories } = useCategories();
  const { uploadImage, uploading } = useImageUpload();
  const { files, uploadFile, deleteFile, isLoading: filesLoading } = useProductFiles(id);
  const { keys, addKeys, deleteKey, availableCount, assignedCount, isLoading: keysLoading } = useLicenseKeys(id);
  const { data: giftCardDesigns = [] } = useGiftCardDesigns();
  
  const [tagsInput, setTagsInput] = useState('');
  const [licenseInput, setLicenseInput] = useState('');
  const [uploadingDigital, setUploadingDigital] = useState(false);
  const [denominationInput, setDenominationInput] = useState('');

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
      hide_from_storefront: false,
      is_featured: false,
      weight: null,
      requires_shipping: true,
      product_type: 'physical',
      digital_delivery_type: null,
      download_limit: null,
      download_expiry_hours: 72,
      license_generator: null,
      access_duration_days: null,
      gift_card_denominations: null,
      gift_card_min_amount: 10,
      gift_card_max_amount: 500,
      gift_card_allow_custom: false,
      gift_card_expiry_months: null,
      gift_card_design_id: null,
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
      hide_from_storefront: (product as any).hide_from_storefront || false,
      is_featured: product.is_featured,
      weight: product.weight,
      requires_shipping: product.requires_shipping,
      product_type: product.product_type || 'physical',
      digital_delivery_type: product.digital_delivery_type || null,
      download_limit: product.download_limit || null,
      download_expiry_hours: product.download_expiry_hours || 72,
      license_generator: product.license_generator || null,
      access_duration_days: product.access_duration_days || null,
      gift_card_denominations: product.gift_card_denominations || null,
      gift_card_min_amount: product.gift_card_min_amount || 10,
      gift_card_max_amount: product.gift_card_max_amount || 500,
      gift_card_allow_custom: product.gift_card_allow_custom || false,
      gift_card_expiry_months: product.gift_card_expiry_months || null,
      gift_card_design_id: product.gift_card_design_id || null,
    } : undefined,
  });

  const productType = form.watch('product_type');
  const digitalDeliveryType = form.watch('digital_delivery_type');
  const isDigital = productType === 'digital';
  const isGiftCard = productType === 'gift_card';

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

  // Handle product type change
  const handleProductTypeChange = (type: ProductType) => {
    form.setValue('product_type', type);
    
    // Auto-set related fields
    if (type === 'digital' || type === 'service' || type === 'gift_card') {
      form.setValue('requires_shipping', false);
      form.setValue('track_inventory', false);
    } else if (type === 'physical') {
      form.setValue('requires_shipping', true);
      form.setValue('track_inventory', true);
    }

    // Reset digital fields if not digital
    if (type !== 'digital') {
      form.setValue('digital_delivery_type', null);
      form.setValue('download_limit', null);
      form.setValue('download_expiry_hours', null);
      form.setValue('license_generator', null);
      form.setValue('access_duration_days', null);
    } else {
      form.setValue('digital_delivery_type', 'download');
      form.setValue('download_expiry_hours', 72);
    }

    // Reset gift card fields if not gift card
    if (type !== 'gift_card') {
      form.setValue('gift_card_denominations', null);
      form.setValue('gift_card_allow_custom', false);
      form.setValue('gift_card_design_id', null);
      form.setValue('gift_card_expiry_months', null);
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

  // Digital file upload
  const handleDigitalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || !id) return;

    setUploadingDigital(true);
    try {
      for (const file of Array.from(fileList)) {
        await uploadFile.mutateAsync({ file });
      }
    } finally {
      setUploadingDigital(false);
      e.target.value = '';
    }
  };

  // License keys
  const handleAddLicenseKeys = () => {
    if (!licenseInput.trim()) return;
    
    const keys = licenseInput
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    if (keys.length > 0) {
      addKeys.mutate(keys);
      setLicenseInput('');
    }
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

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Onbekend';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
          <Tabs defaultValue="type" className="space-y-6">
            <TabsList className="grid w-full grid-cols-9">
              <TabsTrigger value="type">Type</TabsTrigger>
              <TabsTrigger value="basic">Basis</TabsTrigger>
              <TabsTrigger value="pricing">Prijzen</TabsTrigger>
              <TabsTrigger value="inventory">Voorraad</TabsTrigger>
              <TabsTrigger value="images">Afbeeldingen</TabsTrigger>
              {isDigital && <TabsTrigger value="digital">Bestanden</TabsTrigger>}
              {isGiftCard && <TabsTrigger value="giftcard">Cadeaukaart</TabsTrigger>}
              <TabsTrigger value="marketplaces">Marketplaces</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>

            {/* Product Type Tab */}
            <TabsContent value="type" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Product type</CardTitle>
                  <CardDescription>
                    Kies het type product dat je wilt verkopen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                    {(Object.keys(productTypeInfo) as ProductType[]).map((type) => {
                      const info = productTypeInfo[type];
                      const isSelected = productType === type;
                      
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleProductTypeChange(type)}
                          className={cn(
                            "flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all hover:border-primary/50",
                            isSelected 
                              ? "border-primary bg-primary/5" 
                              : "border-muted"
                          )}
                        >
                          <div className={cn(
                            "p-3 rounded-full",
                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}>
                            {productTypeIcons[type]}
                          </div>
                          <div className="text-center">
                            <p className="font-medium">{info.label}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {info.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Digital delivery options */}
              {isDigital && (
                <Card>
                  <CardHeader>
                    <CardTitle>Leveringsmethode</CardTitle>
                    <CardDescription>
                      Hoe wordt het digitale product aan de klant geleverd?
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField
                      control={form.control}
                      name="digital_delivery_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Leveringsmethode</FormLabel>
                          <Select 
                            value={field.value || 'download'} 
                            onValueChange={(value) => field.onChange(value as DigitalDeliveryType)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecteer methode" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(Object.keys(digitalDeliveryTypeInfo) as DigitalDeliveryType[]).map((type) => {
                                const info = digitalDeliveryTypeInfo[type];
                                return (
                                  <SelectItem key={type} value={type}>
                                    <div>
                                      <span>{info.label}</span>
                                      <span className="text-muted-foreground ml-2 text-sm">
                                        - {info.description}
                                      </span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      {(digitalDeliveryType === 'download' || digitalDeliveryType === 'email_attachment') && (
                        <>
                          <FormField
                            control={form.control}
                            name="download_limit"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Download limiet</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    value={field.value ?? ''}
                                    type="number" 
                                    min="0" 
                                    placeholder="Onbeperkt"
                                  />
                                </FormControl>
                                <FormDescription>
                                  Max. aantal downloads per aankoop (leeg = onbeperkt)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="download_expiry_hours"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Geldigheid (uren)</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    value={field.value ?? 72}
                                    type="number" 
                                    min="1" 
                                  />
                                </FormControl>
                                <FormDescription>
                                  Hoelang de download link geldig is
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}

                      {digitalDeliveryType === 'license_key' && (
                        <FormField
                          control={form.control}
                          name="license_generator"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Licentiebeheer</FormLabel>
                              <Select 
                                value={field.value || 'manual'} 
                                onValueChange={(value) => field.onChange(value as 'manual' | 'auto')}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="manual">Handmatig (voer codes in)</SelectItem>
                                  <SelectItem value="auto">Automatisch genereren</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {(digitalDeliveryType === 'access_url' || digitalDeliveryType === 'external_service') && (
                        <FormField
                          control={form.control}
                          name="access_duration_days"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Toegangsduur (dagen)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  value={field.value ?? ''}
                                  type="number" 
                                  min="1" 
                                  placeholder="Permanent"
                                />
                              </FormControl>
                              <FormDescription>
                                Hoelang klant toegang heeft (leeg = permanent)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Gift Card Tab */}
            {isGiftCard && (
              <TabsContent value="giftcard" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="h-5 w-5" />
                      Cadeaukaart configuratie
                    </CardTitle>
                    <CardDescription>
                      Stel de beschikbare bedragen en opties in voor deze cadeaukaart
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Denominations */}
                    <div className="space-y-3">
                      <Label>Vaste bedragen</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(form.watch('gift_card_denominations') || []).map((amount: number, index: number) => (
                          <Badge key={index} variant="secondary" className="text-sm py-1 px-3">
                            €{amount.toFixed(2)}
                            <button
                              type="button"
                              onClick={() => {
                                const current = form.getValues('gift_card_denominations') || [];
                                form.setValue('gift_card_denominations', current.filter((_, i) => i !== index));
                              }}
                              className="ml-2 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="1"
                          step="0.01"
                          placeholder="Nieuw bedrag (bijv. 25)"
                          value={denominationInput}
                          onChange={(e) => setDenominationInput(e.target.value)}
                          className="max-w-[200px]"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const amount = parseFloat(denominationInput);
                            if (amount > 0) {
                              const current = form.getValues('gift_card_denominations') || [];
                              if (!current.includes(amount)) {
                                form.setValue('gift_card_denominations', [...current, amount].sort((a, b) => a - b));
                              }
                              setDenominationInput('');
                            }
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Toevoegen
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Voeg de vaste bedragen toe die klanten kunnen kiezen
                      </p>
                    </div>

                    {/* Custom amount toggle */}
                    <FormField
                      control={form.control}
                      name="gift_card_allow_custom"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Vrij bedrag toestaan</FormLabel>
                            <FormDescription>
                              Laat klanten een eigen bedrag kiezen binnen de grenzen
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Min/Max amounts */}
                    {form.watch('gift_card_allow_custom') && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="gift_card_min_amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Minimum bedrag</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min="1"
                                  step="0.01"
                                  value={field.value ?? 10}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="gift_card_max_amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Maximum bedrag</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min="1"
                                  step="0.01"
                                  value={field.value ?? 500}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Design selector */}
                    <FormField
                      control={form.control}
                      name="gift_card_design_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Standaard ontwerp</FormLabel>
                          <Select 
                            value={field.value || 'none'} 
                            onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecteer een ontwerp" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Geen standaard ontwerp</SelectItem>
                              {giftCardDesigns.filter(d => d.is_active).map((design) => (
                                <SelectItem key={design.id} value={design.id}>
                                  {design.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Klanten kunnen bij aankoop ook een ander ontwerp kiezen
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Expiry months */}
                    <FormField
                      control={form.control}
                      name="gift_card_expiry_months"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Geldigheid (maanden)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="number" 
                              min="1"
                              placeholder="Onbeperkt geldig"
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormDescription>
                            Laat leeg voor onbeperkte geldigheid
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

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
                            <ProductDescriptionEditor
                              value={field.value || ''}
                              onChange={field.onChange}
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
                              value={field.value || 'none'} 
                              onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecteer categorie" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">Geen categorie</SelectItem>
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
                        name="hide_from_storefront"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <FormLabel>Verbergen op webshop</FormLabel>
                              <FormDescription>
                                Niet zichtbaar online, wel via POS
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
                              {isDigital ? 'Niet van toepassing voor digitale producten' : 'Houd de voorraad automatisch bij'}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={field.onChange} 
                              disabled={isDigital && digitalDeliveryType !== 'license_key'}
                            />
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
                              {isDigital ? 'Digitale producten vereisen geen verzending' : 'Dit is een fysiek product'}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                              disabled={isDigital || productType === 'service'}
                            />
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

            {/* Digital Files Tab - Only shown for digital products */}
            {isDigital && (
              <TabsContent value="digital" className="space-y-6">
                {!id ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Download className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">Sla eerst het product op</h3>
                      <p className="text-muted-foreground mt-2">
                        Je kunt digitale bestanden en licentiecodes toevoegen nadat het product is opgeslagen.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Digital Files */}
                    {(digitalDeliveryType === 'download' || digitalDeliveryType === 'email_attachment') && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Digitale bestanden
                          </CardTitle>
                          <CardDescription>
                            Upload de bestanden die klanten kunnen downloaden na aankoop
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* File upload */}
                          <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                {uploadingDigital ? (
                                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                ) : (
                                  <>
                                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                      <span className="font-semibold">Klik om te uploaden</span> of sleep bestanden hierheen
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      PDF, ZIP, MP3, MP4, EPUB, etc. (max. 100MB)
                                    </p>
                                  </>
                                )}
                              </div>
                              <input
                                type="file"
                                className="hidden"
                                multiple
                                onChange={handleDigitalFileUpload}
                                disabled={uploadingDigital}
                              />
                            </label>
                          </div>

                          {/* Files list */}
                          {files.length > 0 && (
                            <div className="border rounded-lg divide-y">
                              {files.map((file) => (
                                <div key={file.id} className="flex items-center gap-4 p-4">
                                  <FileText className="h-8 w-8 text-muted-foreground" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{file.file_name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {formatFileSize(file.file_size)} • Versie {file.version}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {file.is_preview && (
                                      <Badge variant="secondary">
                                        <Eye className="h-3 w-3 mr-1" />
                                        Preview
                                      </Badge>
                                    )}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteFile.mutate(file.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {files.length === 0 && !filesLoading && (
                            <p className="text-center text-muted-foreground py-8">
                              Nog geen bestanden geüpload
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* License Keys */}
                    {digitalDeliveryType === 'license_key' && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Key className="h-5 w-5" />
                            Licentiecodes
                          </CardTitle>
                          <CardDescription>
                            Beheer de licentiecodes die worden toegewezen bij aankoop
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-muted/50 rounded-lg p-4 text-center">
                              <p className="text-2xl font-bold text-green-600">{availableCount}</p>
                              <p className="text-sm text-muted-foreground">Beschikbaar</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-4 text-center">
                              <p className="text-2xl font-bold">{assignedCount}</p>
                              <p className="text-sm text-muted-foreground">Toegewezen</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-4 text-center">
                              <p className="text-2xl font-bold">{keys.length}</p>
                              <p className="text-sm text-muted-foreground">Totaal</p>
                            </div>
                          </div>

                          {/* Add keys */}
                          <div className="space-y-2">
                            <Label>Licentiecodes toevoegen</Label>
                            <Textarea
                              value={licenseInput}
                              onChange={(e) => setLicenseInput(e.target.value)}
                              placeholder="Voer licentiecodes in, één per regel..."
                              rows={4}
                            />
                            <Button
                              type="button"
                              onClick={handleAddLicenseKeys}
                              disabled={!licenseInput.trim() || addKeys.isPending}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Toevoegen
                            </Button>
                          </div>

                          {/* Keys list */}
                          {keys.length > 0 && (
                            <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                              {keys.slice(0, 50).map((key) => (
                                <div key={key.id} className="flex items-center gap-4 p-3">
                                  <code className="flex-1 text-sm font-mono truncate">
                                    {key.license_key}
                                  </code>
                                  <Badge variant={
                                    key.status === 'available' ? 'default' :
                                    key.status === 'assigned' ? 'secondary' : 'destructive'
                                  }>
                                    {key.status === 'available' ? 'Beschikbaar' :
                                     key.status === 'assigned' ? 'Toegewezen' : 'Ingetrokken'}
                                  </Badge>
                                  {key.status === 'available' && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteKey.mutate(key.id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {keys.length === 0 && !keysLoading && (
                            <p className="text-center text-muted-foreground py-8">
                              Nog geen licentiecodes toegevoegd
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>
            )}

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
                  {/* Primary language indicator */}
                  <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
                    <Badge variant="outline" className="gap-1">
                      {TRANSLATION_LANGUAGES.find(l => l.code === ((currentTenant as any)?.language || 'nl'))?.flag || '🇳🇱'}
                      <span className="text-xs">Invoer in: {TRANSLATION_LANGUAGES.find(l => l.code === ((currentTenant as any)?.language || 'nl'))?.label || 'Nederlands'}</span>
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      (ingesteld in Winkelinstellingen)
                    </span>
                  </div>

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

                  {/* Translation Hub Link */}
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Languages className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">Vertalingen</p>
                        <p className="text-xs text-muted-foreground">
                          {TRANSLATION_LANGUAGES.filter(l => l.code !== ((currentTenant as any)?.language || 'nl')).map(l => l.flag).join(' ')} via AI vertalen
                        </p>
                      </div>
                    </div>
                    <Link to="/admin/marketing/translations">
                      <Button type="button" variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Vertaal Hub
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Marketplaces Tab */}
            <TabsContent value="marketplaces">
              {isEditing && product ? (
                <ProductMarketplaceTab 
                  product={product} 
                  onRefresh={() => queryClient.invalidateQueries({ queryKey: ['product', id] })} 
                />
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                      Sla het product eerst op om marketplace instellingen te configureren
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  );
}
