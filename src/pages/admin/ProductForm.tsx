import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
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
import { useProductCategories } from '@/hooks/useProductCategories';
import { useImageUpload } from '@/hooks/useImageUpload';
import { ProductMarketplaceTab } from '@/components/admin/marketplace/ProductMarketplaceTab';
import { ProductVariantsTab } from '@/components/admin/products/ProductVariantsTab';
import { ProductSpecificationsSection } from '@/components/admin/products/ProductSpecificationsSection';
import { ProductDescriptionEditor } from '@/components/admin/products/ProductDescriptionEditor';
import { AIFieldAssistant } from '@/components/admin/ai/AIFieldAssistant';
import { AIUpsellHint } from '@/components/admin/ai/AIUpsellHint';
import type { AIFieldContext } from '@/components/admin/ai/AIFieldAssistant';
import { useProductFiles } from '@/hooks/useProductFiles';
import { useLicenseKeys } from '@/hooks/useLicenseKeys';
import { useTenant } from '@/hooks/useTenant';
import { useSEOKeywords } from '@/hooks/useSEOKeywords';
import { giftCardTemplates, GiftCardTemplatePreview, GiftCardTemplateRenderer } from '@/components/shared/GiftCardTemplates';
import { toPng } from 'html-to-image';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { BundleProductsSection, type BundleItem } from '@/components/admin/products/BundleProductsSection';
import { supabase } from '@/integrations/supabase/client';
import type { ProductFormData, ProductType, DigitalDeliveryType } from '@/types/product';
import { productTypeInfo, digitalDeliveryTypeInfo } from '@/types/product';
import { TRANSLATION_LANGUAGES, type TranslationLanguage } from '@/types/translation';
import { ProductTranslationTabs } from '@/components/admin/products/ProductTranslationTabs';

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
  product_type: z.enum(['physical', 'digital', 'service', 'subscription', 'bundle', 'gift_card']).default('physical'),
  digital_delivery_type: z.enum(['download', 'license_key', 'access_url', 'email_attachment', 'qr_code', 'external_service']).nullable().optional(),
  download_limit: z.coerce.number().int().min(0).nullable().optional(),
  download_expiry_hours: z.coerce.number().int().min(1).nullable().optional(),
  license_generator: z.enum(['manual', 'auto']).nullable().optional(),
  access_duration_days: z.coerce.number().int().min(1).nullable().optional(),
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
  const { categoryIds: savedCategoryIds, primaryCategoryId: savedPrimaryCategoryId, syncCategories, isLoading: isCategoriesLoading } = useProductCategories(id);
  const { uploadImage, uploading } = useImageUpload();
  const { files, uploadFile, deleteFile, isLoading: filesLoading } = useProductFiles(id);
  const { keys, addKeys, deleteKey, availableCount, assignedCount, isLoading: keysLoading } = useLicenseKeys(id);
  
  const { primaryKeywords: seoKeywords } = useSEOKeywords();
  
  const [tagsInput, setTagsInput] = useState('');
  const [licenseInput, setLicenseInput] = useState('');
  const [uploadingDigital, setUploadingDigital] = useState(false);
  const [denominationInput, setDenominationInput] = useState('');
  const [descOpen, setDescOpen] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(null);
  const [categoriesInitialized, setCategoriesInitialized] = useState(false);
  const hasCategoryInteraction = useRef(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

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

  // Initialize selected categories from saved data via useEffect
  // to avoid race conditions when data is still loading
  useEffect(() => {
    if (!isEditing && !categoriesInitialized) {
      setCategoriesInitialized(true);
    } else if (isEditing && !categoriesInitialized && !isCategoriesLoading) {
      // Only hydrate if user hasn't already interacted with categories
      if (!hasCategoryInteraction.current) {
        setSelectedCategoryIds(savedCategoryIds);
        setPrimaryCategoryId(savedPrimaryCategoryId);
      }
      setCategoriesInitialized(true);
    }
  }, [isEditing, savedCategoryIds, savedPrimaryCategoryId, categoriesInitialized, isCategoriesLoading]);

  // Wrapped setters that track user interaction
  const handleSetSelectedCategoryIds = useCallback((ids: string[] | ((prev: string[]) => string[])) => {
    hasCategoryInteraction.current = true;
    setSelectedCategoryIds(ids);
  }, []);

  const handleSetPrimaryCategoryId = useCallback((id: string | null) => {
    hasCategoryInteraction.current = true;
    setPrimaryCategoryId(id);
  }, []);

  const aiContext: AIFieldContext = {
    name: form.watch('name'),
    short_description: form.watch('short_description'),
    description: form.watch('description'),
    category_name: categories?.find(c => c.id === (primaryCategoryId || selectedCategoryIds[0]))?.name,
    price: form.watch('price'),
    weight: form.watch('weight'),
    tags: form.watch('tags'),
    marketplace_channels: (() => {
      if (!product) return [];
      const channels: string[] = [];
      const mappings = (product as any).marketplace_mappings || {};
      if (mappings.bol_com || (product as any).bol_ean) channels.push('bol_com');
      if (mappings.amazon || (product as any).amazon_asin) channels.push('amazon');
      return channels;
    })(),
  };

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

  const handleProductTypeChange = (type: ProductType) => {
    form.setValue('product_type', type);
    if (type === 'digital' || type === 'service' || type === 'gift_card') {
      form.setValue('requires_shipping', false);
      form.setValue('track_inventory', false);
    } else if (type === 'physical') {
      form.setValue('requires_shipping', true);
      form.setValue('track_inventory', true);
    }
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
    if (type !== 'gift_card') {
      form.setValue('gift_card_denominations', null);
      form.setValue('gift_card_allow_custom', false);
      form.setValue('gift_card_design_id', null);
      form.setValue('gift_card_expiry_months', null);
    }
  };

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
    try {
      // Set primary category_id for backward compatibility
      const effectivePrimary = primaryCategoryId && selectedCategoryIds.includes(primaryCategoryId)
        ? primaryCategoryId
        : selectedCategoryIds[0] || null;

      const submitData = {
        ...data,
        category_id: effectivePrimary,
        sku: data.sku?.trim() || null,
        barcode: data.barcode?.trim() || null,
      };
      let productId = id;
      if (isEditing && id) {
        await updateProduct.mutateAsync({ id, data: submitData });
      } else {
        const created = await createProduct.mutateAsync(submitData as any);
        productId = created.id;
      }
      // Always sync multi-categories
      if (productId) {
        await syncCategories.mutateAsync({
          productId,
          categoryIds: selectedCategoryIds,
          primaryCategoryId: effectivePrimary,
        });
      }
      navigate('/admin/products');
    } catch (err: any) {
      console.error('Product save failed:', err);
      toast.error(err?.message || 'Opslaan mislukt');
    }
  };

  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  const handleDownloadTemplate = async () => {
    if (!downloadRef.current) return;
    setDownloadingTemplate(true);
    try {
      // Temporarily make visible for capture
      const el = downloadRef.current;
      el.style.opacity = '1';
      el.style.position = 'fixed';
      el.style.top = '0';
      el.style.left = '0';
      el.style.zIndex = '99999';
      // Wait for render
      await new Promise(r => setTimeout(r, 100));
      const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true, backgroundColor: undefined });
      // Hide again
      el.style.opacity = '0';
      el.style.zIndex = '-50';
      const link = document.createElement('a');
      link.download = `cadeaukaart-${form.getValues('gift_card_design_id') || 'elegant'}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Productfoto gedownload');
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Download mislukt');
    } finally {
      setDownloadingTemplate(false);
    }
  };

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
    <div className={cn("space-y-6", form.formState.isDirty && "pb-20")}>
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
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="product" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="product">Product</TabsTrigger>
              <TabsTrigger value="marketplaces">Marketplaces</TabsTrigger>
            </TabsList>

            {/* Product Tab - One-page 2-column layout */}
            <TabsContent value="product" className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Product Type */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Product type</CardTitle>
                      <CardDescription>Kies het type product dat je wilt verkopen</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-3">
                        {(Object.keys(productTypeInfo) as ProductType[]).map((type) => {
                          const info = productTypeInfo[type];
                          const isSelected = productType === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => handleProductTypeChange(type)}
                              className={cn(
                                "flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all hover:border-primary/50",
                                isSelected ? "border-primary bg-primary/5" : "border-muted"
                              )}
                            >
                              <div className={cn(
                                "p-3 rounded-full",
                                isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                              )}>
                                {productTypeIcons[type]}
                              </div>
                              <div className="text-center">
                                <p className="font-medium text-sm">{info.label}</p>
                                <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
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
                        <CardDescription>Hoe wordt het digitale product aan de klant geleverd?</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <FormField
                          control={form.control}
                          name="digital_delivery_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Leveringsmethode</FormLabel>
                              <Select value={field.value || 'download'} onValueChange={(value) => field.onChange(value as DigitalDeliveryType)}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Selecteer methode" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {(Object.keys(digitalDeliveryTypeInfo) as DigitalDeliveryType[]).map((type) => {
                                    const info = digitalDeliveryTypeInfo[type];
                                    return (
                                      <SelectItem key={type} value={type}>
                                        <div>
                                          <span>{info.label}</span>
                                          <span className="text-muted-foreground ml-2 text-sm">- {info.description}</span>
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
                              <FormField control={form.control} name="download_limit" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Download limiet</FormLabel>
                                  <FormControl><Input {...field} value={field.value ?? ''} type="number" min="0" placeholder="Onbeperkt" /></FormControl>
                                  <FormDescription>Max. aantal downloads per aankoop (leeg = onbeperkt)</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <FormField control={form.control} name="download_expiry_hours" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Geldigheid (uren)</FormLabel>
                                  <FormControl><Input {...field} value={field.value ?? 72} type="number" min="1" /></FormControl>
                                  <FormDescription>Hoelang de download link geldig is</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </>
                          )}
                          {digitalDeliveryType === 'license_key' && (
                            <FormField control={form.control} name="license_generator" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Licentiebeheer</FormLabel>
                                <Select value={field.value || 'manual'} onValueChange={(value) => field.onChange(value as 'manual' | 'auto')}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="manual">Handmatig (voer codes in)</SelectItem>
                                    <SelectItem value="auto">Automatisch genereren</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                          )}
                          {(digitalDeliveryType === 'access_url' || digitalDeliveryType === 'external_service') && (
                            <FormField control={form.control} name="access_duration_days" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Toegangsduur (dagen)</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ''} type="number" min="1" placeholder="Permanent" /></FormControl>
                                <FormDescription>Hoelang klant toegang heeft (leeg = permanent)</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )} />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Basic Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Product informatie</CardTitle>
                      <CardDescription>Basis gegevens van het product</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-1">
                            <FormLabel>Naam *</FormLabel>
                            <AIFieldAssistant
                              fieldType="product_title"
                              currentValue={field.value}
                              onApply={(text) => handleNameChange(text)}
                              context={aiContext}
                              seoKeywords={seoKeywords}
                            />
                          </div>
                          <FormControl><Input {...field} onChange={(e) => handleNameChange(e.target.value)} placeholder="Product naam" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="slug" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug *</FormLabel>
                          <FormControl><Input {...field} placeholder="product-naam" /></FormControl>
                          <FormDescription>URL-vriendelijke naam voor het product</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="short_description" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-1">
                            <FormLabel>Korte beschrijving</FormLabel>
                            <AIFieldAssistant
                              fieldType="short_description"
                              currentValue={field.value}
                              onApply={(text) => form.setValue('short_description', text)}
                              context={aiContext}
                              seoKeywords={seoKeywords}
                            />
                          </div>
                          <FormControl><Textarea {...field} placeholder="Korte beschrijving voor productlijsten" rows={2} /></FormControl>
                          <AIUpsellHint className="mt-1" />
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem>
                          <Collapsible open={descOpen} onOpenChange={setDescOpen}>
                            <CollapsibleTrigger className="flex items-center gap-2 w-full group cursor-pointer">
                              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                              <FormLabel className="cursor-pointer">Volledige beschrijving</FormLabel>
                            </CollapsibleTrigger>
                            {!descOpen && field.value && field.value !== '<p></p>' && (
                              <div
                                onClick={() => setDescOpen(true)}
                                className="relative mt-2 cursor-pointer rounded-md border border-input p-3"
                              >
                                <div
                                  className="prose prose-sm max-w-none max-h-[12rem] overflow-hidden text-muted-foreground"
                                  dangerouslySetInnerHTML={{ __html: field.value }}
                                />
                                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none rounded-b-md" />
                              </div>
                            )}
                            <CollapsibleContent>
                              <div className="pt-2">
                                <FormControl><ProductDescriptionEditor value={field.value || ''} onChange={field.onChange} aiContext={aiContext} onSeoGenerated={(seo) => { form.setValue('meta_title', seo.meta_title); form.setValue('meta_description', seo.meta_description); toast.success('SEO meta titel en beschrijving automatisch ingevuld'); }} /></FormControl>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>

                  {/* Pricing - hidden for gift cards */}
                  {!isGiftCard && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Prijzen</CardTitle>
                      <CardDescription>Stel de prijzen in voor dit product</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 md:grid-cols-3">
                        <FormField control={form.control} name="price" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Verkoopprijs *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                                <Input {...field} type="number" step="0.01" min="0" className="pl-7" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="compare_at_price" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vergelijkingsprijs</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                                <Input {...field} value={field.value ?? ''} type="number" step="0.01" min="0" className="pl-7" />
                              </div>
                            </FormControl>
                            <FormDescription>"Was" prijs voor kortingen</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="cost_price" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Inkoopprijs</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                                <Input {...field} value={field.value ?? ''} type="number" step="0.01" min="0" className="pl-7" />
                              </div>
                            </FormControl>
                            <FormDescription>Voor winstberekening (niet zichtbaar)</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </CardContent>
                  </Card>
                  )}

                  {/* Inventory & Identification - hidden for gift cards */}
                  {!isGiftCard && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Voorraad & Identificatie</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField control={form.control} name="sku" render={({ field }) => (
                          <FormItem>
                            <FormLabel>SKU</FormLabel>
                            <FormControl><Input {...field} placeholder="ABC-123" /></FormControl>
                            <FormDescription>Stock Keeping Unit</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="barcode" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Barcode</FormLabel>
                            <FormControl><Input {...field} placeholder="8712345678901" /></FormControl>
                            <FormDescription>EAN, UPC of GTIN</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="track_inventory" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel>Voorraad bijhouden</FormLabel>
                            <FormDescription>{isDigital ? 'Niet van toepassing voor digitale producten' : 'Houd de voorraad automatisch bij'}</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isDigital && digitalDeliveryType !== 'license_key'} />
                          </FormControl>
                        </FormItem>
                      )} />

                      {form.watch('track_inventory') && (
                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField control={form.control} name="stock" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Huidige voorraad</FormLabel>
                              <FormControl><Input {...field} type="number" min="0" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="low_stock_threshold" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lage voorraad drempel</FormLabel>
                              <FormControl><Input {...field} type="number" min="0" /></FormControl>
                              <FormDescription>Ontvang een waarschuwing bij deze voorraad</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="allow_backorder" render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                              <div>
                                <FormLabel>Backorders toestaan</FormLabel>
                                <FormDescription>Klanten kunnen bestellen als uitverkocht</FormDescription>
                              </div>
                              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                      )}

                      <FormField control={form.control} name="requires_shipping" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel>Verzending vereist</FormLabel>
                            <FormDescription>{isDigital ? 'Digitale producten vereisen geen verzending' : 'Dit is een fysiek product'}</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isDigital || productType === 'service'} />
                          </FormControl>
                        </FormItem>
                      )} />

                      {form.watch('requires_shipping') && (
                        <FormField control={form.control} name="weight" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gewicht (kg)</FormLabel>
                            <FormControl><Input {...field} value={field.value ?? ''} type="number" step="0.01" min="0" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                    </CardContent>
                  </Card>
                  )}

                  {/* Conditional: Digital Files */}
                  {isDigital && (
                    <>
                      {!id ? (
                        <Card>
                          <CardContent className="py-12 text-center">
                            <Download className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">Sla eerst het product op</h3>
                            <p className="text-muted-foreground mt-2">Je kunt digitale bestanden en licentiecodes toevoegen nadat het product is opgeslagen.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <>
                          {(digitalDeliveryType === 'download' || digitalDeliveryType === 'email_attachment') && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Digitale bestanden</CardTitle>
                                <CardDescription>Upload de bestanden die klanten kunnen downloaden na aankoop</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="flex items-center justify-center w-full">
                                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                      {uploadingDigital ? (
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                      ) : (
                                        <>
                                          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                          <p className="text-sm text-muted-foreground"><span className="font-semibold">Klik om te uploaden</span> of sleep bestanden hierheen</p>
                                          <p className="text-xs text-muted-foreground">PDF, ZIP, MP3, MP4, EPUB, etc. (max. 100MB)</p>
                                        </>
                                      )}
                                    </div>
                                    <input type="file" className="hidden" multiple onChange={handleDigitalFileUpload} disabled={uploadingDigital} />
                                  </label>
                                </div>
                                {files.length > 0 && (
                                  <div className="border rounded-lg divide-y">
                                    {files.map((file) => (
                                      <div key={file.id} className="flex items-center gap-4 p-4">
                                        <FileText className="h-8 w-8 text-muted-foreground" />
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium truncate">{file.file_name}</p>
                                          <p className="text-sm text-muted-foreground">{formatFileSize(file.file_size)} • Versie {file.version}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {file.is_preview && <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" />Preview</Badge>}
                                          <Button type="button" variant="ghost" size="icon" onClick={() => deleteFile.mutate(file.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {files.length === 0 && !filesLoading && <p className="text-center text-muted-foreground py-8">Nog geen bestanden geüpload</p>}
                              </CardContent>
                            </Card>
                          )}

                          {digitalDeliveryType === 'license_key' && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />Licentiecodes</CardTitle>
                                <CardDescription>Beheer de licentiecodes die worden toegewezen bij aankoop</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
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
                                <div className="space-y-2">
                                  <Label>Licentiecodes toevoegen</Label>
                                  <Textarea value={licenseInput} onChange={(e) => setLicenseInput(e.target.value)} placeholder="Voer licentiecodes in, één per regel..." rows={4} />
                                  <Button type="button" onClick={handleAddLicenseKeys} disabled={!licenseInput.trim() || addKeys.isPending}>
                                    <Plus className="h-4 w-4 mr-2" />Toevoegen
                                  </Button>
                                </div>
                                {keys.length > 0 && (
                                  <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                                    {keys.slice(0, 50).map((key) => (
                                      <div key={key.id} className="flex items-center gap-4 p-3">
                                        <code className="flex-1 text-sm font-mono truncate">{key.license_key}</code>
                                        <Badge variant={key.status === 'available' ? 'default' : key.status === 'assigned' ? 'secondary' : 'destructive'}>
                                          {key.status === 'available' ? 'Beschikbaar' : key.status === 'assigned' ? 'Toegewezen' : 'Ingetrokken'}
                                        </Badge>
                                        {key.status === 'available' && (
                                          <Button type="button" variant="ghost" size="icon" onClick={() => deleteKey.mutate(key.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {keys.length === 0 && !keysLoading && <p className="text-center text-muted-foreground py-8">Nog geen licentiecodes toegevoegd</p>}
                              </CardContent>
                            </Card>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Conditional: Gift Card */}
                  {isGiftCard && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" />Cadeaukaart configuratie</CardTitle>
                        <CardDescription>Stel de beschikbare bedragen en opties in voor deze cadeaukaart</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-3">
                          <Label>Vaste bedragen</Label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {(form.watch('gift_card_denominations') || []).map((amount: number, index: number) => (
                              <Badge key={index} variant="secondary" className="text-sm py-1 px-3">
                                €{amount.toFixed(2)}
                                <button type="button" onClick={() => {
                                  const current = form.getValues('gift_card_denominations') || [];
                                  form.setValue('gift_card_denominations', current.filter((_, i) => i !== index));
                                }} className="ml-2 hover:text-destructive"><X className="h-3 w-3" /></button>
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input type="number" min="1" step="0.01" placeholder="Nieuw bedrag (bijv. 25)" value={denominationInput} onChange={(e) => setDenominationInput(e.target.value)} className="max-w-[200px]" />
                            <Button type="button" variant="outline" onClick={() => {
                              const amount = parseFloat(denominationInput);
                              if (amount > 0) {
                                const current = form.getValues('gift_card_denominations') || [];
                                if (!current.includes(amount)) {
                                  form.setValue('gift_card_denominations', [...current, amount].sort((a, b) => a - b));
                                }
                                setDenominationInput('');
                              }
                            }}><Plus className="h-4 w-4 mr-1" />Toevoegen</Button>
                          </div>
                          <p className="text-sm text-muted-foreground">Voeg de vaste bedragen toe die klanten kunnen kiezen</p>
                        </div>

                        <FormField control={form.control} name="gift_card_allow_custom" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Vrij bedrag toestaan</FormLabel>
                              <FormDescription>Laat klanten een eigen bedrag kiezen binnen de grenzen</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )} />

                        {form.watch('gift_card_allow_custom') && (
                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField control={form.control} name="gift_card_min_amount" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Minimum bedrag</FormLabel>
                                <FormControl><Input {...field} type="number" min="1" step="0.01" value={field.value ?? 10} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="gift_card_max_amount" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Maximum bedrag</FormLabel>
                                <FormControl><Input {...field} type="number" min="1" step="0.01" value={field.value ?? 500} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                        )}

                        <div className="space-y-3">
                          <Label>Standaard ontwerp</Label>
                          <p className="text-sm text-muted-foreground">Kies een template die klanten standaard zien. Zij kunnen bij aankoop ook een ander ontwerp kiezen.</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {giftCardTemplates.map((template) => (
                              <GiftCardTemplatePreview
                                key={template.id}
                                template={template}
                                selected={form.watch('gift_card_design_id') === template.id}
                                onClick={() => form.setValue('gift_card_design_id', template.id)}
                                amount={25}
                                storeName={currentTenant?.name || 'Uw winkel'}
                                logoUrl={currentTenant?.logo_url || undefined}
                                compact
                              />
                            ))}
                          </div>

                          {/* Download as product image */}
                          <div className="pt-2">
                            <div ref={downloadRef} className="fixed top-0 left-0 w-[800px] opacity-0 pointer-events-none -z-50" aria-hidden>
                              <GiftCardTemplateRenderer
                                templateId={form.watch('gift_card_design_id') || 'elegant'}
                                storeName={currentTenant?.name || 'Uw winkel'}
                                amount={25}
                                logoUrl={currentTenant?.logo_url || undefined}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleDownloadTemplate}
                              disabled={downloadingTemplate}
                            >
                              {downloadingTemplate ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                              Download als productfoto
                            </Button>
                            <p className="text-xs text-muted-foreground mt-1">Download het ontwerp als PNG om als productfoto te gebruiken</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Varianten - hidden for gift cards */}
                  {!isGiftCard && (
                    <>
                    {isEditing && id ? (
                      <ProductVariantsTab productId={id} trackInventory={form.watch('track_inventory')} />
                    ) : (
                      <Card>
                        <CardContent className="py-8 text-center">
                          <p className="text-muted-foreground">Sla het product eerst op om varianten te beheren</p>
                        </CardContent>
                      </Card>
                    )}
                    </>
                  )}

                  {/* Technische Specificaties - hidden for gift cards */}
                  {!isGiftCard && isEditing && id && (
                    <ProductSpecificationsSection productId={id} />
                  )}
                </div>

                {/* Right Column - Sidebar */}
                <div className="space-y-6 order-first xl:order-none">
                  {/* Images */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Afbeeldingen</CardTitle>
                      <CardDescription>Upload afbeeldingen van je product</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-center w-full">
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              {uploading ? (
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                              ) : (
                                <>
                                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                  <p className="text-sm text-muted-foreground text-center"><span className="font-semibold">Klik om te uploaden</span></p>
                                  <p className="text-xs text-muted-foreground">PNG, JPG, WebP of GIF</p>
                                </>
                              )}
                            </div>
                            <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleImageUpload} disabled={uploading} />
                          </label>
                        </div>
                        {form.watch('images').length > 0 && (
                          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-2 gap-3">
                            {form.watch('images').map((url, index) => (
                              <div key={url} className={cn(
                                "relative group aspect-square rounded-lg overflow-hidden border-2",
                                form.watch('featured_image') === url ? "border-primary" : "border-transparent"
                              )}>
                                <img src={url} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <Button type="button" size="icon" variant="secondary" onClick={() => setFeaturedImage(url)} title="Maak hoofdafbeelding">
                                    <Star className={cn("h-4 w-4", form.watch('featured_image') === url && "fill-amber-500 text-amber-500")} />
                                  </Button>
                                  <Button type="button" size="icon" variant="destructive" onClick={() => removeImage(url)} title="Verwijderen">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                {form.watch('featured_image') === url && (
                                  <div className="absolute top-2 left-2">
                                    <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded">Hoofd</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Organisation */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Organisatie</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Multi-category selector */}
                      <div className="space-y-2">
                        <Label>Categorieën</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between font-normal">
                              {selectedCategoryIds.length === 0
                                ? 'Selecteer categorieën...'
                                : `${selectedCategoryIds.length} ${selectedCategoryIds.length === 1 ? 'categorie' : 'categorieën'} geselecteerd`}
                              <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                              {categories.map((cat) => {
                                const isSelected = selectedCategoryIds.includes(cat.id);
                                const isPrimary = primaryCategoryId === cat.id;
                                return (
                                  <div key={cat.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          const newIds = [...selectedCategoryIds, cat.id];
                                          handleSetSelectedCategoryIds(newIds);
                                          if (newIds.length === 1) handleSetPrimaryCategoryId(cat.id);
                                        } else {
                                          const newIds = selectedCategoryIds.filter(id => id !== cat.id);
                                          handleSetSelectedCategoryIds(newIds);
                                          if (isPrimary) handleSetPrimaryCategoryId(newIds[0] || null);
                                        }
                                      }}
                                    />
                                    <span className="flex-1 text-sm">{cat.name}</span>
                                    {isSelected && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSetPrimaryCategoryId(cat.id);
                                        }}
                                        className={cn(
                                          "text-xs px-1.5 py-0.5 rounded",
                                          isPrimary
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground hover:bg-accent"
                                        )}
                                      >
                                        {isPrimary ? 'Primair' : 'Maak primair'}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                              {categories.length === 0 && (
                                <p className="text-sm text-muted-foreground p-2">Geen categorieën beschikbaar</p>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        {/* Selected categories display */}
                        {selectedCategoryIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {selectedCategoryIds.map(catId => {
                              const cat = categories.find(c => c.id === catId);
                              if (!cat) return null;
                              const isPrimary = primaryCategoryId === catId;
                              return (
                                <Badge key={catId} variant={isPrimary ? "default" : "secondary"} className="gap-1">
                                  {isPrimary && <Star className="h-3 w-3" />}
                                  {cat.name}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newIds = selectedCategoryIds.filter(id => id !== catId);
                                      handleSetSelectedCategoryIds(newIds);
                                      if (isPrimary) handleSetPrimaryCategoryId(newIds[0] || null);
                                    }}
                                    className="ml-0.5 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Tags</Label>
                        <div className="flex gap-2">
                          <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Voeg tag toe" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                          <Button type="button" variant="secondary" onClick={addTag}>Toevoegen</Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {form.watch('tags').map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
                              {tag}
                              <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="is_active" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel>Actief</FormLabel>
                            <FormDescription>Product is zichtbaar in de winkel</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="hide_from_storefront" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel>Verbergen op webshop</FormLabel>
                            <FormDescription>Niet zichtbaar online, wel via POS</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="is_featured" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel>Uitgelicht</FormLabel>
                            <FormDescription>Toon op homepage en in speciale secties</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>

                  {/* SEO */}
                  <Card>
                    <CardHeader>
                      <CardTitle>SEO</CardTitle>
                      <CardDescription>Zoekmachine optimalisatie</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
                        <Badge variant="outline" className="gap-1">
                          {TRANSLATION_LANGUAGES.find(l => l.code === ((currentTenant as any)?.language || 'nl'))?.flag || '🇳🇱'}
                          <span className="text-xs">{TRANSLATION_LANGUAGES.find(l => l.code === ((currentTenant as any)?.language || 'nl'))?.label || 'Nederlands'}</span>
                        </Badge>
                      </div>
                      <FormField control={form.control} name="meta_title" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-1">
                            <FormLabel>Meta titel</FormLabel>
                            <AIFieldAssistant
                              fieldType="meta_title"
                              currentValue={field.value}
                              onApply={(text) => form.setValue('meta_title', text)}
                              context={aiContext}
                              seoKeywords={seoKeywords}
                            />
                          </div>
                          <FormControl><Input {...field} placeholder={form.watch('name') || 'Product titel'} /></FormControl>
                          <FormDescription>{field.value?.length || 0}/60 tekens</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="meta_description" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-1">
                            <FormLabel>Meta beschrijving</FormLabel>
                            <AIFieldAssistant
                              fieldType="meta_description"
                              currentValue={field.value}
                              onApply={(text) => form.setValue('meta_description', text)}
                              context={aiContext}
                              seoKeywords={seoKeywords}
                            />
                          </div>
                          <FormControl><Textarea {...field} placeholder={form.watch('short_description') || 'Korte beschrijving voor zoekmachines'} rows={3} /></FormControl>
                          <FormDescription>{field.value?.length || 0}/160 tekens</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="rounded-lg border p-4 bg-muted/30">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Voorbeeld</p>
                        <div className="space-y-1">
                          <p className="text-blue-600 text-sm hover:underline cursor-pointer truncate">{form.watch('meta_title') || form.watch('name') || 'Product titel'}</p>
                          <p className="text-xs text-green-700 truncate">jouwwinkel.nl/producten/{form.watch('slug') || 'product-slug'}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{form.watch('meta_description') || form.watch('short_description') || 'Productbeschrijving...'}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Vertalingen</span>
                    </div>
                    <Link to="/admin/marketing/translations">
                      <Button type="button" variant="outline" size="sm"><ExternalLink className="h-3 w-3 mr-1" />Vertaal Hub</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Translation Tabs (only when editing) */}
              {isEditing && id && (
                <ProductTranslationTabs productId={id} />
              )}
                </div>
              </div>
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
                    <p className="text-muted-foreground">Sla het product eerst op om marketplace instellingen te configureren</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </form>
      </Form>

      {/* Floating action bar */}
      {form.formState.isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:left-[var(--sidebar-width)] border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between px-6 py-3">
            <p className="text-sm text-muted-foreground font-medium">
              Onopgeslagen wijzigingen
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => form.reset()}>
                Annuleren
              </Button>
              <Button size="sm" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
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
        </div>
      )}
    </div>
  );
}
