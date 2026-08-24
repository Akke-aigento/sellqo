import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PermissionGate } from '@/components/PermissionGate';
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
  ExternalLink,
  Wand2,
  Library,
  Ticket
} from 'lucide-react';
import { useProduct, useProducts, useProductBundleItems, useSaveBundleItems } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useImageUpload } from '@/hooks/useImageUpload';
import { ProductMarketplaceTab } from '@/components/admin/marketplace/ProductMarketplaceTab';
import { ProductVariantsTab } from '@/components/admin/products/ProductVariantsTab';
import { ProductEventDatesTab } from '@/components/admin/products/ProductEventDatesTab';
import { ProductSpecificationsSection } from '@/components/admin/products/ProductSpecificationsSection';
import { ProductDescriptionEditor } from '@/components/admin/products/ProductDescriptionEditor';
import { MediaLibraryPickerDialog } from '@/components/admin/products/MediaLibraryPickerDialog';
import { AIFieldAssistant } from '@/components/admin/ai/AIFieldAssistant';
import { AIUpsellHint } from '@/components/admin/ai/AIUpsellHint';
import type { AIFieldContext } from '@/components/admin/ai/AIFieldAssistant';
import { useProductFiles } from '@/hooks/useProductFiles';
import { useLicenseKeys } from '@/hooks/useLicenseKeys';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useSEOKeywords } from '@/hooks/useSEOKeywords';
import { useGiftCardDesigns } from '@/hooks/useGiftCardDesigns';
import { Button } from '@/components/ui/button';
import { FloatingSaveBar } from '@/components/admin/FloatingSaveBar';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronRight } from 'lucide-react';
import type { ProductFormData, ProductType, DigitalDeliveryType } from '@/types/product';
import { productTypeInfo, digitalDeliveryTypeInfo } from '@/types/product';
import { TRANSLATION_LANGUAGES, type TranslationLanguage } from '@/types/translation';
import { EntityTranslationTabs } from '@/components/admin/translations/EntityTranslationTabs';
import { ProductAdsSection } from '@/components/admin/products/ProductAdsSection';
import { ImageEditorDialog } from '@/components/admin/products/ImageEditorDialog';
import { useTranslation } from 'react-i18next';

const productSchema = z.object({
  name: z.string().min(1, 'admin.promotions.autoDiscountFormDialog.validation.naam_is_verplicht').max(200, 'admin.productForm.validation.naam_mag_maximaal_200_tekens_zijn'),
  slug: z.string().min(1, 'admin.productForm.validation.slug_is_verplicht').regex(/^[a-z0-9-]+$/, 'admin.productForm.validation.slug_mag_alleen_kleine_letters_cijfers'),
  description: z.string().max(20000, 'admin.productForm.validation.beschrijving_is_te_lang').optional().default(''),
  short_description: z.string().max(500, 'admin.productForm.validation.korte_beschrijving_mag_maximaal_500_tekens').optional().default(''),
  price: z.coerce.number().min(0, 'admin.productForm.validation.prijs_moet_0_of_hoger_zijn'),
  compare_at_price: z.coerce.number().min(0).nullable().optional(),
  cost_price: z.coerce.number().min(0).nullable().optional(),
  sku: z.string().max(100).optional().default(''),
  barcode: z.string().max(100).optional().default(''),
  stock: z.coerce.number().int().min(0, 'admin.productForm.validation.voorraad_moet_0_of_hoger_zijn').default(0),
  track_inventory: z.boolean().default(true),
  allow_backorder: z.boolean().default(false),
  low_stock_threshold: z.coerce.number().int().min(0).default(5),
  images: z.array(z.string()).default([]),
  featured_image: z.string().optional().default(''),
  category_id: z.string().optional().default(''),
  tags: z.array(z.string()).default([]),
  meta_title: z.string().max(60, 'admin.productForm.validation.meta_titel_mag_maximaal_60_tekens').optional().default(''),
  meta_description: z.string().max(160, 'admin.productForm.validation.meta_beschrijving_mag_maximaal_160_tekens').optional().default(''),
  is_active: z.boolean().default(true),
  hide_from_storefront: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  weight: z.coerce.number().min(0).nullable().optional(),
  requires_shipping: z.boolean().default(true),
  product_type: z.enum(['physical', 'digital', 'service', 'subscription', 'bundle', 'gift_card', 'ticket']).default('physical'),
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
  bundle_pricing_model: z.enum(['fixed', 'dynamic']).nullable().optional(),
  bundle_discount_type: z.enum(['percentage', 'fixed_amount']).nullable().optional(),
  bundle_discount_value: z.coerce.number().min(0).nullable().optional(),
});

type FormValues = z.infer<typeof productSchema>;

const productTypeIcons: Record<ProductType, React.ReactNode> = {
  physical: <Package className="h-6 w-6" />,
  digital: <Download className="h-6 w-6" />,
  service: <Briefcase className="h-6 w-6" />,
  subscription: <RefreshCw className="h-6 w-6" />,
  bundle: <Layers className="h-6 w-6" />,
  gift_card: <CreditCard className="h-6 w-6" />,
  ticket: <Ticket className="h-6 w-6" />,
};

export default function ProductForm() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  
  const { currentTenant } = useTenant();
  // PROD-TRIGGER-1 — commerciële velden zijn voor rollen die uitsluitend
  // `marketing` of `warehouse` zijn niet schrijfbaar (DB-trigger
  // `guard_product_commercial_fields`). Zonder deze UI-afscherming krijgt de
  // gebruiker pas bij opslaan een databasefout.
  const { roles, isPlatformAdmin } = useAuth();
  const roleNames = useMemo(() => (roles ?? []).map((r) => r.role as string), [roles]);
  const hasBroadRole = isPlatformAdmin
    || roleNames.includes('tenant_admin')
    || roleNames.includes('staff');
  const isRestrictedRole = !hasBroadRole
    && (roleNames.includes('marketing') || roleNames.includes('warehouse'));
  const canEditCommercial = !isRestrictedRole;
  const canEditStock = !isRestrictedRole || roleNames.includes('warehouse');
  const adminManagedHint = 'Wordt door een beheerder beheerd.';
  const { enforceLimit } = useUsageLimits();
  const { data: product, isLoading: productLoading } = useProduct(id);
  const { products: allProducts, createProduct, updateProduct } = useProducts();
  const { categories, flatCategoryTree, getCategoryPath } = useCategories();
  const { uploadImage, uploading } = useImageUpload();
  const { files, uploadFile, deleteFile, isLoading: filesLoading } = useProductFiles(id);
  const { keys, addKeys, deleteKey, availableCount, assignedCount, isLoading: keysLoading } = useLicenseKeys(id);
  const { data: giftCardDesigns = [] } = useGiftCardDesigns();
  const { primaryKeywords: seoKeywords } = useSEOKeywords();
  
  const { data: bundleItems = [], isLoading: bundleItemsLoading } = useProductBundleItems(id);
  const saveBundleItems = useSaveBundleItems();

  const [tagsInput, setTagsInput] = useState('');
  const [licenseInput, setLicenseInput] = useState('');
  const [uploadingDigital, setUploadingDigital] = useState(false);
  const [denominationInput, setDenominationInput] = useState('');
  const [descOpen, setDescOpen] = useState(false);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [imageEditorUrl, setImageEditorUrl] = useState('');
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [bundleItemsState, setBundleItemsState] = useState<Array<{
    child_product_id: string;
    quantity: number;
    customer_can_adjust: boolean;
    min_quantity: number | null;
    max_quantity: number | null;
    sort_order: number;
    child_product?: { id: string; name: string; price: number; images: string[] | null; featured_image: string | null };
  }>>([]);
  const [bundleSearchQuery, setBundleSearchQuery] = useState('');
  const [bundlePopoverOpen, setBundlePopoverOpen] = useState(false);
  const [bundleItemsInitialized, setBundleItemsInitialized] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [categoryIdsInitialized, setCategoryIdsInitialized] = useState(false);

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
      bundle_pricing_model: null,
      bundle_discount_type: null,
      bundle_discount_value: null,
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
      featured_image: product.featured_image || (product.images && product.images.length > 0 ? product.images[0] : ''),
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
      bundle_pricing_model: (product as any).bundle_pricing_model || null,
      bundle_discount_type: (product as any).bundle_discount_type || null,
      bundle_discount_value: (product as any).bundle_discount_value || null,
    } : undefined,
  });

  const productType = form.watch('product_type');
  const digitalDeliveryType = form.watch('digital_delivery_type');
  const isDigital = productType === 'digital';
  const isGiftCard = productType === 'gift_card';
  const isBundle = productType === 'bundle';
  const isTicket = productType === 'ticket';
  const bundlePricingModel = form.watch('bundle_pricing_model');

  // Initialize bundle items from loaded data
  useEffect(() => {
    if (bundleItems.length > 0 && !bundleItemsInitialized) {
      setBundleItemsState(bundleItems.map(item => ({
        child_product_id: item.child_product_id,
        quantity: item.quantity,
        customer_can_adjust: item.customer_can_adjust,
        min_quantity: item.min_quantity,
        max_quantity: item.max_quantity,
        sort_order: item.sort_order,
        child_product: item.child_product ? {
          id: item.child_product.id,
          name: item.child_product.name,
          price: item.child_product.price,
          images: item.child_product.images,
          featured_image: item.child_product.featured_image,
        } : undefined,
      })));
      setBundleItemsInitialized(true);
    }
  }, [bundleItems, bundleItemsInitialized]);

  // Initialize category_ids from junction table
  useEffect(() => {
    if (id && product && !categoryIdsInitialized) {
      (async () => {
        const { data } = await (supabase as any)
          .from('product_categories')
          .select('category_id, is_primary, sort_order')
          .eq('product_id', id)
          .order('sort_order', { ascending: true });
        if (data && data.length > 0) {
          // Sort: primary first, then by sort_order
          const sorted = [...data].sort((a: any, b: any) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return (a.sort_order || 0) - (b.sort_order || 0);
          });
          setSelectedCategoryIds(sorted.map((pc: any) => pc.category_id));
        } else if (product.category_id) {
          // Fallback: use legacy category_id
          setSelectedCategoryIds([product.category_id]);
        }
        setCategoryIdsInitialized(true);
      })();
    }
  }, [id, product, categoryIdsInitialized]);

  const aiContext: AIFieldContext = {
    name: form.watch('name'),
    short_description: form.watch('short_description'),
    description: form.watch('description'),
    category_name: categories?.find(c => c.id === selectedCategoryIds[0])?.name,
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
    form.setValue('name', value, { shouldDirty: true });
    if (!isEditing || !form.getValues('slug')) {
      form.setValue('slug', generateSlug(value), { shouldDirty: true });
    }
  };

  const handleProductTypeChange = (type: ProductType) => {
    form.setValue('product_type', type, { shouldDirty: true });
    if (type === 'digital' || type === 'service' || type === 'gift_card' || type === 'ticket') {
      form.setValue('requires_shipping', false, { shouldDirty: true });
      form.setValue('track_inventory', false, { shouldDirty: true });
    } else if (type === 'physical') {
      form.setValue('requires_shipping', true, { shouldDirty: true });
      form.setValue('track_inventory', true, { shouldDirty: true });
    }
    if (type !== 'digital') {
      form.setValue('digital_delivery_type', null, { shouldDirty: true });
      form.setValue('download_limit', null, { shouldDirty: true });
      form.setValue('download_expiry_hours', null, { shouldDirty: true });
      form.setValue('license_generator', null, { shouldDirty: true });
      form.setValue('access_duration_days', null, { shouldDirty: true });
    } else {
      form.setValue('digital_delivery_type', 'download', { shouldDirty: true });
      form.setValue('download_expiry_hours', 72, { shouldDirty: true });
    }
    if (type !== 'gift_card') {
      form.setValue('gift_card_denominations', null, { shouldDirty: true });
      form.setValue('gift_card_allow_custom', false, { shouldDirty: true });
      form.setValue('gift_card_design_id', null, { shouldDirty: true });
      form.setValue('gift_card_expiry_months', null, { shouldDirty: true });
    }
    if (type === 'bundle') {
      form.setValue('requires_shipping', false, { shouldDirty: true });
      form.setValue('track_inventory', false, { shouldDirty: true });
      if (!form.getValues('bundle_pricing_model')) {
        form.setValue('bundle_pricing_model', 'fixed', { shouldDirty: true });
      }
    }
    if (type !== 'bundle') {
      form.setValue('bundle_pricing_model', null, { shouldDirty: true });
      form.setValue('bundle_discount_type', null, { shouldDirty: true });
      form.setValue('bundle_discount_value', null, { shouldDirty: true });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const currentImages = form.getValues('images') || [];
    const beforeCount = currentImages.length;
    const attempted = files.length;
    for (const file of Array.from(files)) {
      const url = await uploadImage(file);
      if (url) {
        currentImages.push(url);
        if (!form.getValues('featured_image')) {
          form.setValue('featured_image', url, { shouldDirty: true });
        }
      }
    }
    form.setValue('images', currentImages, { shouldDirty: true });
    // Fallback feedback: if nothing made it through, show a clear summary
    // (Android pickers can silently drop files past the per-file toasts).
    if (attempted > 0 && currentImages.length === beforeCount) {
      toast.error('Geen van de geselecteerde foto\'s kon worden geüpload', {
        description: t('admin.productForm.controleer_bestandstype_en_grootte_max_20'),
        duration: 8000,
      });
    }
    e.target.value = '';
  };

  const handleLibrarySelect = (urls: string[]) => {
    if (urls.length === 0) return;
    const currentImages = form.getValues('images') || [];
    const merged = [...currentImages, ...urls.filter(u => !currentImages.includes(u))];
    form.setValue('images', merged, { shouldDirty: true });
    if (!form.getValues('featured_image') && merged.length > 0) {
      form.setValue('featured_image', merged[0], { shouldDirty: true });
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${filename}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Kon afbeelding niet downloaden');
    }
  };

  const removeImage = (url: string) => {
    const images = form.getValues('images').filter(img => img !== url);
    form.setValue('images', images, { shouldDirty: true });
    if (form.getValues('featured_image') === url) {
      form.setValue('featured_image', images[0] || '', { shouldDirty: true });
    }
  };

  const setFeaturedImage = (url: string) => {
    form.setValue('featured_image', url, { shouldDirty: true });
    // Reorder images so featured_image is always first
    const currentImages = form.getValues('images') || [];
    if (currentImages.includes(url) && currentImages[0] !== url) {
      form.setValue('images', [url, ...currentImages.filter(i => i !== url)], { shouldDirty: true });
    }
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
      form.setValue('tags', [...tags, tagsInput.trim()], { shouldDirty: true });
    }
    setTagsInput('');
  };

  const removeTag = (tag: string) => {
    form.setValue('tags', form.getValues('tags').filter(t => t !== tag), { shouldDirty: true });
  };

   const onSubmit = async (data: FormValues) => {
    // Enforce usage limit for new products
    if (!isEditing) {
      const result = await enforceLimit('products');
      if (!result.allowed) return;
    }

    // Set legacy category_id to primary (first selected) category
    const primaryCategoryId = selectedCategoryIds.length > 0 ? selectedCategoryIds[0] : null;
     // featured_image mag nooit naar een verwijderde foto blijven wijzen:
     // hij moet altijd in de images-array voorkomen, anders valt hij terug op de eerste foto.
     const trimmedFeatured = data.featured_image?.trim() || '';
     const featuredImage = trimmedFeatured && data.images?.includes(trimmedFeatured)
       ? trimmedFeatured
       : (data.images?.length > 0 ? data.images[0] : null);
     const submitData = {
       ...data,
       category_id: primaryCategoryId,
       sku: data.sku?.trim() || null,
       barcode: data.barcode?.trim() || null,
       featured_image: featuredImage,
     };
    let productId = id;
    if (isEditing && id) {
      await updateProduct.mutateAsync({ id, data: submitData });
    } else {
      const created = await createProduct.mutateAsync(submitData as any);
      productId = created?.id;
    }

    // Save bundle items if this is a bundle product
    if (data.product_type === 'bundle' && productId) {
      await saveBundleItems.mutateAsync({
        productId,
        items: bundleItemsState.map((item, index) => ({
          child_product_id: item.child_product_id,
          quantity: item.quantity,
          customer_can_adjust: item.customer_can_adjust,
          min_quantity: item.min_quantity,
          max_quantity: item.max_quantity,
          sort_order: index,
        })),
      });
    }

    // Sync track_inventory to all variants
    if (productId && isEditing) {
      await supabase
        .from('product_variants')
        .update({ track_inventory: data.track_inventory })
        .eq('product_id', productId);
    }

    // Save category associations to junction table
    if (productId) {
      // Delete existing
      await (supabase as any)
        .from('product_categories')
        .delete()
        .eq('product_id', productId);

      // Insert new
      if (selectedCategoryIds.length > 0) {
        await (supabase as any)
          .from('product_categories')
          .insert(selectedCategoryIds.map((catId, index) => ({
            product_id: productId,
            category_id: catId,
            is_primary: index === 0,
            sort_order: index,
          })));
      }
    }

    navigate('/admin/products');
  };

  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Onbekend';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t('admin.products.selecteer_eerst_een_winkel')}</p>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/products')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? t('admin.productForm.product_bewerken') : t('admin.products.nieuw_product')}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? `Bewerk ${product?.name}` : 'Voeg een nieuw product toe aan je catalogus'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => navigate('/admin/products')}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {t('common.save')}
              </>
            )}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="product" className="space-y-6">
            <TabsList className="flex w-full overflow-x-auto sm:grid sm:grid-cols-4">
              <TabsTrigger value="product" className="shrink-0">{t('admin.stockReport.colName')}</TabsTrigger>
              <TabsTrigger value="translations" className="shrink-0" disabled={!isEditing}>{t('admin.productForm.vertalingen')}</TabsTrigger>
              <TabsTrigger value="marketplaces" className="shrink-0">{t('admin.productForm.marketplaces')}</TabsTrigger>
              <TabsTrigger value="ads" className="shrink-0" disabled={!isEditing}>{t('admin.products.productAdsSection.advertenties')}</TabsTrigger>
            </TabsList>

            {/* Product Tab - One-page 2-column layout */}
            <TabsContent value="product" className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-6">
                {/* Left Column */}
                <div className="space-y-6 min-w-0">
                  {/* Product Type */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('admin.productForm.product_type')}</CardTitle>
                      <CardDescription>{t('admin.productForm.kies_het_type_product_dat_je')}</CardDescription>
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
                        <CardTitle>{t('admin.productForm.leveringsmethode')}</CardTitle>
                        <CardDescription>{t('admin.productForm.hoe_wordt_het_digitale_product_aan')}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <FormField
                          control={form.control}
                          name="digital_delivery_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('admin.productForm.leveringsmethode_2')}</FormLabel>
                              <Select value={field.value || 'download'} onValueChange={(value) => field.onChange(value as DigitalDeliveryType)}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder={t('admin.productForm.selecteer_methode')} /></SelectTrigger>
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
                                  <FormLabel>{t('admin.productForm.download_limiet')}</FormLabel>
                                  <FormControl><Input {...field} value={field.value ?? ''} type="number" min="0" placeholder={t('admin.productForm.onbeperkt')} /></FormControl>
                                  <FormDescription>{t('admin.productForm.max_aantal_downloads_per_aankoop_leeg')}</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <FormField control={form.control} name="download_expiry_hours" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('admin.productForm.geldigheid_uren')}</FormLabel>
                                  <FormControl><Input {...field} value={field.value ?? 72} type="number" min="1" /></FormControl>
                                  <FormDescription>{t('admin.productForm.hoelang_de_download_link_geldig_is')}</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </>
                          )}
                          {digitalDeliveryType === 'license_key' && (
                            <FormField control={form.control} name="license_generator" render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('admin.productForm.licentiebeheer')}</FormLabel>
                                <Select value={field.value || 'manual'} onValueChange={(value) => field.onChange(value as 'manual' | 'auto')}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="manual">{t('admin.productForm.handmatig_voer_codes_in')}</SelectItem>
                                    <SelectItem value="auto">{t('admin.productForm.automatisch_genereren')}</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                          )}
                          {(digitalDeliveryType === 'access_url' || digitalDeliveryType === 'external_service') && (
                            <FormField control={form.control} name="access_duration_days" render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('admin.productForm.toegangsduur_dagen')}</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ''} type="number" min="1" placeholder={t('admin.productForm.permanent')} /></FormControl>
                                <FormDescription>{t('admin.productForm.hoelang_klant_toegang_heeft_leeg_permanent')}</FormDescription>
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
                      <CardTitle>{t('admin.productForm.product_informatie')}</CardTitle>
                      <CardDescription>{t('admin.productForm.basis_gegevens_van_het_product')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-1">
                            <FormLabel>{t('admin.productForm.naam')}</FormLabel>
                            <AIFieldAssistant
                              fieldType="product_title"
                              currentValue={field.value}
                              onApply={(text) => handleNameChange(text)}
                              context={aiContext}
                              seoKeywords={seoKeywords}
                            />
                          </div>
                          <FormControl><Input {...field} onChange={(e) => handleNameChange(e.target.value)} placeholder={t('admin.marketing.emailBlockProperties.product_naam')} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="slug" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('admin.productForm.slug')}</FormLabel>
                          <FormControl><Input {...field} placeholder="product-naam" /></FormControl>
                          <FormDescription>{t('admin.productForm.url_vriendelijke_naam_voor_het_product')}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="short_description" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-1">
                            <FormLabel>{t('admin.productForm.korte_beschrijving')}</FormLabel>
                            <AIFieldAssistant
                              fieldType="short_description"
                              currentValue={field.value}
                              onApply={(text) => form.setValue('short_description', text, { shouldDirty: true })}
                              context={aiContext}
                              seoKeywords={seoKeywords}
                            />
                          </div>
                          <FormControl><Textarea {...field} placeholder={t('admin.productForm.korte_beschrijving_voor_productlijsten')} rows={2} /></FormControl>
                          <AIUpsellHint className="mt-1" />
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem>
                          <Collapsible open={descOpen} onOpenChange={setDescOpen}>
                            <CollapsibleTrigger className="flex items-center gap-2 w-full group cursor-pointer">
                              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                              <FormLabel className="cursor-pointer">{t('admin.productForm.volledige_beschrijving')}</FormLabel>
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
                                <FormControl><ProductDescriptionEditor value={field.value || ''} onChange={field.onChange} aiContext={aiContext} onSeoGenerated={(seo) => { form.setValue('meta_title', seo.meta_title, { shouldDirty: true }); form.setValue('meta_description', seo.meta_description, { shouldDirty: true }); toast.success('SEO meta titel en beschrijving automatisch ingevuld'); }} /></FormControl>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </CardContent>
                  </Card>

                  {/* Pricing - hidden for bundles, they use bundle pricing config */}
                  {!isBundle && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('admin.products.productBulkEditDialog.prijzen')}</CardTitle>
                      <CardDescription>{t('admin.productForm.stel_de_prijzen_in_voor_dit')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 md:grid-cols-3">
                        {id && product?.product_variants && product.product_variants.filter(v => v.is_active).length > 0 ? (
                          <div className="md:col-span-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">{t('admin.productForm.verkoopprijs_wordt_per_variant_beheerd')}</p>
                            <p>
                              {product.product_variants.filter(v => v.is_active).length} actieve varianten — pas de verkoopprijs aan in het tabblad "Varianten".
                            </p>
                          </div>
                        ) : (
                          <FormField control={form.control} name="price" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('admin.productForm.verkoopprijs')}</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                                  <Input {...field} type="number" step="0.01" min="0" className="pl-7" disabled={!canEditCommercial} />
                                </div>
                              </FormControl>
                              {!canEditCommercial && <FormDescription>{adminManagedHint}</FormDescription>}
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                        <FormField control={form.control} name="compare_at_price" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('admin.productForm.vergelijkingsprijs')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                                <Input {...field} value={field.value ?? ''} type="number" step="0.01" min="0" className="pl-7" disabled={!canEditCommercial} />
                              </div>
                            </FormControl>
                            <FormDescription>{canEditCommercial ? '"Was" prijs voor kortingen' : adminManagedHint}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        {/* H4b — cost_price (Inkoopprijs) verbergen voor rollen zonder
                            product_costs read recht. Vermijdt accidentele empty-save. */}
                        <PermissionGate action="read" resource="product_costs">
                          <FormField control={form.control} name="cost_price" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('admin.productForm.inkoopprijs')}</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                                  <Input {...field} value={field.value ?? ''} type="number" step="0.01" min="0" className="pl-7" disabled={!canEditCommercial} />
                                </div>
                              </FormControl>
                              <FormDescription>{canEditCommercial ? 'Voor winstberekening (niet zichtbaar)' : adminManagedHint}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </PermissionGate>
                      </div>
                    </CardContent>
                  </Card>
                  )}

                  {/* Inventory & Identification */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('admin.productForm.voorraad_identificatie')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField control={form.control} name="sku" render={({ field }) => (
                          <FormItem>
                            <FormLabel>SKU</FormLabel>
                            <FormControl><Input {...field} placeholder="ABC-123" disabled={!canEditCommercial} /></FormControl>
                            <FormDescription>{canEditCommercial ? 'Stock Keeping Unit' : adminManagedHint}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="barcode" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('admin.productForm.barcode')}</FormLabel>
                            <FormControl><Input {...field} placeholder="8712345678901" disabled={!canEditCommercial} /></FormControl>
                            <FormDescription>{canEditCommercial ? 'EAN, UPC of GTIN' : adminManagedHint}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="track_inventory" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel>{t('admin.productForm.voorraad_bijhouden')}</FormLabel>
                            <FormDescription>{isDigital ? t('admin.productForm.niet_van_toepassing_voor_digitale_producten') : t('admin.productForm.houd_de_voorraad_automatisch_bij')}</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isDigital && digitalDeliveryType !== 'license_key'} />
                          </FormControl>
                        </FormItem>
                      )} />

                      {form.watch('track_inventory') && (
                        <div className="grid gap-4 md:grid-cols-2">
                          {id && product?.product_variants && product.product_variants.filter(v => v.is_active).length > 0 ? (
                            <div className="md:col-span-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                              <p className="font-medium text-foreground mb-1">{t('admin.productForm.voorraad_wordt_per_variant_beheerd')}</p>
                              <p>
                                Totaal: {product.product_variants.filter(v => v.is_active).reduce((sum, v) => sum + (v.stock || 0), 0)} stuks 
                                over {product.product_variants.filter(v => v.is_active).length} actieve varianten. 
                                Pas de voorraad aan in het tabblad "Varianten".
                              </p>
                            </div>
                          ) : (
                            <FormField control={form.control} name="stock" render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('admin.productForm.huidige_voorraad')}</FormLabel>
                                <FormControl><Input {...field} type="number" min="0" disabled={!canEditStock} /></FormControl>
                                {!canEditStock && <FormDescription>{adminManagedHint}</FormDescription>}
                                <FormMessage />
                              </FormItem>
                            )} />
                          )}
                          <FormField control={form.control} name="low_stock_threshold" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('admin.productForm.lage_voorraad_drempel')}</FormLabel>
                              <FormControl><Input {...field} type="number" min="0" disabled={!canEditStock} /></FormControl>
                              <FormDescription>{canEditStock ? 'Ontvang een waarschuwing bij deze voorraad' : adminManagedHint}</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="allow_backorder" render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                              <div>
                                <FormLabel>{t('admin.productForm.backorders_toestaan')}</FormLabel>
                                <FormDescription>{t('admin.productForm.klanten_kunnen_bestellen_als_uitverkocht')}</FormDescription>
                              </div>
                              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                      )}

                      <FormField control={form.control} name="requires_shipping" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel>{t('admin.productForm.verzending_vereist')}</FormLabel>
                            <FormDescription>{isDigital ? t('admin.productForm.digitale_producten_vereisen_geen_verzending') : t('admin.productForm.dit_is_een_fysiek_product')}</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isDigital || productType === 'service'} />
                          </FormControl>
                        </FormItem>
                      )} />

                      {form.watch('requires_shipping') && (
                        <FormField control={form.control} name="weight" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('admin.products.specs.dimensionsFields.gewicht_kg')}</FormLabel>
                            <FormControl><Input {...field} value={field.value ?? ''} type="number" step="0.01" min="0" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                    </CardContent>
                  </Card>

                  {/* Conditional: Digital Files */}
                  {isDigital && (
                    <>
                      {!id ? (
                        <Card>
                          <CardContent className="py-12 text-center">
                            <Download className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">{t('admin.productForm.sla_eerst_het_product_op')}</h3>
                            <p className="text-muted-foreground mt-2">{t('admin.productForm.je_kunt_digitale_bestanden_en_licentiecodes')}</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <>
                          {(digitalDeliveryType === 'download' || digitalDeliveryType === 'email_attachment') && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />{t('admin.productForm.digitale_bestanden')}</CardTitle>
                                <CardDescription>{t('admin.productForm.upload_de_bestanden_die_klanten_kunnen')}</CardDescription>
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
                                          <p className="text-sm text-muted-foreground"><span className="font-semibold">{t('admin.productForm.klik_om_te_uploaden')}</span> {t('admin.productForm.of_sleep_bestanden_hierheen')}</p>
                                          <p className="text-xs text-muted-foreground">{t('admin.productForm.pdf_zip_mp3_mp4_epub_etc')}</p>
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
                                          {file.is_preview && <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" />{t('admin.marketing.emailPreview.preview')}</Badge>}
                                          <Button type="button" variant="ghost" size="icon" onClick={() => deleteFile.mutate(file.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {files.length === 0 && !filesLoading && <p className="text-center text-muted-foreground py-8">{t('admin.productForm.nog_geen_bestanden_geupload')}</p>}
                              </CardContent>
                            </Card>
                          )}

                          {digitalDeliveryType === 'license_key' && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />{t('admin.productForm.licentiecodes')}</CardTitle>
                                <CardDescription>{t('admin.productForm.beheer_de_licentiecodes_die_worden_toegewezen')}</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold text-green-600">{availableCount}</p>
                                    <p className="text-sm text-muted-foreground">{t('admin.productForm.beschikbaar')}</p>
                                  </div>
                                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold">{assignedCount}</p>
                                    <p className="text-sm text-muted-foreground">{t('admin.productForm.toegewezen')}</p>
                                  </div>
                                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                                    <p className="text-2xl font-bold">{keys.length}</p>
                                    <p className="text-sm text-muted-foreground">{t('common.total')}</p>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>{t('admin.productForm.licentiecodes_toevoegen')}</Label>
                                  <Textarea value={licenseInput} onChange={(e) => setLicenseInput(e.target.value)} placeholder={t('admin.productForm.voer_licentiecodes_in_een_per_regel')} rows={4} />
                                  <Button type="button" onClick={handleAddLicenseKeys} disabled={!licenseInput.trim() || addKeys.isPending}>
                                    <Plus className="h-4 w-4 mr-2" />{t('common.add')}
                                  </Button>
                                </div>
                                {keys.length > 0 && (
                                  <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                                    {keys.slice(0, 50).map((key) => (
                                      <div key={key.id} className="flex items-center gap-4 p-3">
                                        <code className="flex-1 text-sm font-mono truncate">{key.license_key}</code>
                                        <Badge variant={key.status === 'available' ? 'default' : key.status === 'assigned' ? 'secondary' : 'destructive'}>
                                          {key.status === 'available' ? t('admin.productForm.beschikbaar') : key.status === 'assigned' ? t('admin.productForm.toegewezen') : t('admin.productForm.ingetrokken')}
                                        </Badge>
                                        {key.status === 'available' && (
                                          <Button type="button" variant="ghost" size="icon" onClick={() => deleteKey.mutate(key.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {keys.length === 0 && !keysLoading && <p className="text-center text-muted-foreground py-8">{t('admin.productForm.nog_geen_licentiecodes_toegevoegd')}</p>}
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
                        <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" />{t('admin.productForm.cadeaukaart_configuratie')}</CardTitle>
                        <CardDescription>{t('admin.productForm.stel_de_beschikbare_bedragen_en_opties')}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-3">
                          <Label>{t('admin.productForm.vaste_bedragen')}</Label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {(form.watch('gift_card_denominations') || []).map((amount: number, index: number) => (
                              <Badge key={index} variant="secondary" className="text-sm py-1 px-3">
                                €{amount.toFixed(2)}
                                <button type="button" onClick={() => {
                                  const current = form.getValues('gift_card_denominations') || [];
                                  form.setValue('gift_card_denominations', current.filter((_, i) => i !== index), { shouldDirty: true });
                                }} className="ml-2 hover:text-destructive"><X className="h-3 w-3" /></button>
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input type="number" min="1" step="0.01" placeholder={t('admin.productForm.nieuw_bedrag_bijv_25')} value={denominationInput} onChange={(e) => setDenominationInput(e.target.value)} className="max-w-[200px]" />
                            <Button type="button" variant="outline" onClick={() => {
                              const amount = parseFloat(denominationInput);
                              if (amount > 0) {
                                const current = form.getValues('gift_card_denominations') || [];
                                if (!current.includes(amount)) {
                                  form.setValue('gift_card_denominations', [...current, amount].sort((a, b) => a - b), { shouldDirty: true });
                                }
                                setDenominationInput('');
                              }
                            }}><Plus className="h-4 w-4 mr-1" />{t('common.add')}</Button>
                          </div>
                          <p className="text-sm text-muted-foreground">{t('admin.productForm.voeg_de_vaste_bedragen_toe_die')}</p>
                        </div>

                        <FormField control={form.control} name="gift_card_allow_custom" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">{t('admin.productForm.vrij_bedrag_toestaan')}</FormLabel>
                              <FormDescription>{t('admin.productForm.laat_klanten_een_eigen_bedrag_kiezen')}</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )} />

                        {form.watch('gift_card_allow_custom') && (
                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField control={form.control} name="gift_card_min_amount" render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('admin.productForm.minimum_bedrag')}</FormLabel>
                                <FormControl><Input {...field} type="number" min="1" step="0.01" value={field.value ?? 10} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="gift_card_max_amount" render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('admin.productForm.maximum_bedrag')}</FormLabel>
                                <FormControl><Input {...field} type="number" min="1" step="0.01" value={field.value ?? 500} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                        )}

                        <FormField control={form.control} name="gift_card_design_id" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('admin.productForm.standaard_ontwerp')}</FormLabel>
                            <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? null : value)}>
                              <FormControl><SelectTrigger><SelectValue placeholder={t('admin.productForm.selecteer_een_ontwerp')} /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="none">{t('admin.productForm.geen_standaard_ontwerp')}</SelectItem>
                                {giftCardDesigns.filter(d => d.is_active).map((design) => (
                                  <SelectItem key={design.id} value={design.id}>{design.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>{t('admin.productForm.klanten_kunnen_bij_aankoop_ook_een')}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <FormField control={form.control} name="gift_card_expiry_months" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('admin.productForm.geldigheid_maanden')}</FormLabel>
                            <FormControl><Input {...field} type="number" min="1" placeholder={t('admin.productForm.onbeperkt_geldig')} value={field.value ?? ''} /></FormControl>
                            <FormDescription>{t('admin.productForm.laat_leeg_voor_onbeperkte_geldigheid')}</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </CardContent>
                    </Card>
                  )}

                  {/* Bundel configuratie */}
                  {isBundle && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" />{t('admin.productForm.bundel_configuratie')}</CardTitle>
                        <CardDescription>{t('admin.productForm.stel_de_producten_en_het_prijsmodel')}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Pricing model */}
                        <div className="space-y-3">
                          <Label className="text-base font-medium">{t('admin.productForm.prijsmodel')}</Label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                form.setValue('bundle_pricing_model', 'fixed', { shouldDirty: true });
                                form.setValue('bundle_discount_type', null, { shouldDirty: true });
                                form.setValue('bundle_discount_value', null, { shouldDirty: true });
                              }}
                              className={cn(
                                'rounded-lg border-2 p-4 text-left transition-all',
                                bundlePricingModel === 'fixed' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/25'
                              )}
                            >
                              <div className="font-medium">{t('admin.productForm.vaste_bundelprijs')}</div>
                              <div className="text-sm text-muted-foreground mt-1">{t('admin.productForm.je_stelt_zelf_een_totaalprijs_in')}</div>
                            </button>
                            <button
                              type="button"
                              onClick={() => form.setValue('bundle_pricing_model', 'dynamic', { shouldDirty: true })}
                              className={cn(
                                'rounded-lg border-2 p-4 text-left transition-all',
                                bundlePricingModel === 'dynamic' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/25'
                              )}
                            >
                              <div className="font-medium">{t('admin.productForm.dynamische_prijs')}</div>
                              <div className="text-sm text-muted-foreground mt-1">{t('admin.productForm.som_van_individuele_productprijzen')}</div>
                            </button>
                          </div>
                        </div>

                        {/* Fixed pricing - price input */}
                        {bundlePricingModel === 'fixed' && (
                          <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
                            <FormField control={form.control} name="price" render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('admin.productForm.vaste_bundelprijs_2')}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                                    <Input {...field} type="number" step="0.01" min="0" className="pl-7" />
                                  </div>
                                </FormControl>
                                <FormDescription>{t('admin.productForm.de_totaalprijs_waarvoor_de_bundel_wordt')}</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                        )}

                        {/* Dynamic pricing discount */}
                        {bundlePricingModel === 'dynamic' && (
                          <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
                            <Label className="text-sm font-medium">{t('admin.productForm.bundelkorting_optioneel')}</Label>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <Label className="text-sm">{t('admin.productForm.type_korting')}</Label>
                                <Select
                                  value={form.watch('bundle_discount_type') || 'none'}
                                  onValueChange={(value) => form.setValue('bundle_discount_type', value === 'none' ? null : value as 'percentage' | 'fixed_amount', { shouldDirty: true })}
                                >
                                  <SelectTrigger><SelectValue placeholder={t('admin.productForm.geen_korting_2')} /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">{t('admin.productForm.geen_korting')}</SelectItem>
                                    <SelectItem value="percentage">{t('admin.productForm.percentage')}</SelectItem>
                                    <SelectItem value="fixed_amount">{t('admin.productForm.vast_bedrag_euro')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {form.watch('bundle_discount_type') && (
                                <FormField control={form.control} name="bundle_discount_value" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{form.watch('bundle_discount_type') === 'percentage' ? t('admin.productForm.korting') : t('admin.productForm.korting_u20ac')}</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min="0"
                                        step={form.watch('bundle_discount_type') === 'percentage' ? '1' : '0.01'}
                                        max={form.watch('bundle_discount_type') === 'percentage' ? '100' : undefined}
                                        value={field.value ?? ''}
                                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Bundle items */}
                        <div className="space-y-3">
                          <Label className="text-base font-medium">{t('admin.productForm.bundel_inhoud')}</Label>

                          {/* Product search */}
                          <Popover open={bundlePopoverOpen} onOpenChange={setBundlePopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" role="combobox" className="w-full justify-start text-muted-foreground font-normal">
                                <Plus className="mr-2 h-4 w-4" />
                                {t('admin.productForm.zoek_product_om_toe_te_voegen')}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command>
                                <CommandInput placeholder={t('admin.seo.imageAltTextPanel.zoek_op_productnaam')} />
                                <CommandList>
                                  <CommandEmpty>{t('admin.marketing.productSelectDialog.geen_producten_gevonden')}</CommandEmpty>
                                  <CommandGroup>
                                    {allProducts
                                      .filter(p =>
                                        p.id !== id &&
                                        p.product_type !== 'bundle'
                                      )
                                      .map(p => {
                                        const isInBundle = bundleItemsState.some(bi => bi.child_product_id === p.id);
                                        return (
                                          <CommandItem
                                            key={p.id}
                                            value={p.name}
                                            onSelect={() => {
                                              if (isInBundle) {
                                                setBundleItemsState(prev => prev.filter(bi => bi.child_product_id !== p.id));
                                              } else {
                                                setBundleItemsState(prev => [...prev, {
                                                  child_product_id: p.id,
                                                  quantity: 1,
                                                  customer_can_adjust: false,
                                                  min_quantity: null,
                                                  max_quantity: null,
                                                  sort_order: prev.length,
                                                  child_product: {
                                                    id: p.id,
                                                    name: p.name,
                                                    price: p.price,
                                                    images: p.images,
                                                    featured_image: p.featured_image,
                                                  },
                                                }]);
                                              }
                                            }}
                                            className="flex items-center gap-3 cursor-pointer"
                                          >
                                            <Checkbox checked={isInBundle} className="pointer-events-none" />
                                            {(p.featured_image || p.images?.[0]) ? (
                                              <img src={p.featured_image || p.images[0]} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                                            ) : (
                                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0"><Package className="h-4 w-4 text-muted-foreground" /></div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                              <div className="text-sm font-medium truncate">{p.name}</div>
                                              <div className="text-xs text-muted-foreground">&euro;{p.price.toFixed(2)}</div>
                                            </div>
                                          </CommandItem>
                                        );
                                      })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>

                          {/* Items list */}
                          {bundleItemsState.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed rounded-lg">
                              <Layers className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground">{t('admin.productForm.nog_geen_producten_toegevoegd_aan_de')}</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {bundleItemsState.map((item, index) => (
                                <div key={item.child_product_id} className="border rounded-lg p-4 space-y-3">
                                  <div className="flex items-center gap-3">
                                    {(item.child_product?.featured_image || item.child_product?.images?.[0]) ? (
                                      <img src={item.child_product.featured_image || item.child_product.images![0]} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                                    ) : (
                                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0"><Package className="h-5 w-5 text-muted-foreground" /></div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium truncate">{item.child_product?.name || 'Onbekend product'}</div>
                                      <div className="text-sm text-muted-foreground">&euro;{(item.child_product?.price || 0).toFixed(2)} per stuk</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Label className="text-sm whitespace-nowrap">{t('admin.productForm.aantal')}</Label>
                                      <Input
                                        type="number"
                                      min="0"
                                        className="w-20"
                                        value={item.quantity}
                                        onChange={(e) => {
                                          const val = Math.max(0, parseInt(e.target.value) || 0);
                                          setBundleItemsState(prev => prev.map((bi, i) => i === index ? { ...bi, quantity: val } : bi));
                                        }}
                                      />
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => {
                                      setBundleItemsState(prev => prev.filter((_, i) => i !== index));
                                    }}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>

                                  {/* Customer can adjust toggle */}
                                  <div className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                      <div className="text-sm font-medium">{t('admin.productForm.klant_kan_hoeveelheid_aanpassen')}</div>
                                      <div className="text-xs text-muted-foreground">{t('admin.productForm.de_klant_kan_de_hoeveelheid_in')}</div>
                                    </div>
                                    <Switch
                                      checked={item.customer_can_adjust}
                                      onCheckedChange={(checked) => {
                                        setBundleItemsState(prev => prev.map((bi, i) =>
                                          i === index ? { ...bi, customer_can_adjust: checked, min_quantity: checked ? null : null, max_quantity: checked ? null : null } : bi
                                        ));
                                      }}
                                    />
                                  </div>

                                  {/* Min/Max fields when adjustable */}
                                  {item.customer_can_adjust && (
                                    <div className="grid grid-cols-2 gap-3 pl-4">
                                      <div>
                                        <Label className="text-sm">{t('admin.productForm.minimum')}</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          placeholder={t('admin.productForm.geen_limiet')}
                                          value={item.min_quantity ?? ''}
                                          onChange={(e) => {
                                            const val = e.target.value ? Math.max(0, parseInt(e.target.value)) : null;
                                            setBundleItemsState(prev => prev.map((bi, i) => i === index ? { ...bi, min_quantity: val } : bi));
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-sm">{t('admin.productForm.maximum')}</Label>
                                        <Input
                                          type="number"
                                          min="1"
                                          placeholder={t('admin.productForm.geen_limiet_2')}
                                          value={item.max_quantity ?? ''}
                                          onChange={(e) => {
                                            const val = e.target.value ? Math.max(1, parseInt(e.target.value)) : null;
                                            setBundleItemsState(prev => prev.map((bi, i) => i === index ? { ...bi, max_quantity: val } : bi));
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}

                              {/* Bundle price summary */}
                              {bundlePricingModel === 'dynamic' && (
                                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                                  <div className="flex justify-between">
                                    <span>{t('admin.productForm.som_individuele_prijzen')}</span>
                                    <span className="font-medium">
                                      &euro;{bundleItemsState.reduce((sum, item) => sum + (item.child_product?.price || 0) * item.quantity, 0).toFixed(2)}
                                    </span>
                                  </div>
                                  {form.watch('bundle_discount_type') && form.watch('bundle_discount_value') && (
                                    <div className="flex justify-between text-green-600 mt-1">
                                      <span>{t('admin.productForm.bundelkorting')}</span>
                                      <span>
                                        -{form.watch('bundle_discount_type') === 'percentage'
                                          ? `${form.watch('bundle_discount_value')}%`
                                          : `\u20AC${(form.watch('bundle_discount_value') || 0).toFixed(2)}`}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Varianten */}
                  {isEditing && id ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('admin.productForm.varianten')}</CardTitle>
                        <CardDescription>{t('admin.productForm.beheer_productvarianten_zoals_maat_kleur_etc')}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ProductVariantsTab productId={id} productImages={form.watch('images') || []} trackInventory={form.watch('track_inventory')} defaultPrice={form.watch('price')} />
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <p className="text-muted-foreground">{t('admin.productForm.sla_het_product_eerst_op_om')}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Events & Datums (alleen bij ticket) */}
                  {isTicket && (isEditing && id ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('admin.productForm.events_datums')}</CardTitle>
                        <CardDescription>{t('admin.productForm.beheer_de_datums_tijden_en_capaciteit')}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ProductEventDatesTab productId={id} regularPrice={Number(form.watch('price')) || 0} />
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle>{t('admin.productForm.events_datums_2')}</CardTitle>
                      </CardHeader>
                      <CardContent className="py-8 text-center">
                        <p className="text-muted-foreground">{t('admin.productForm.sla_het_product_eerst_op_om_2')}</p>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Technische Specificaties */}
                  {isEditing && id && (
                    <ProductSpecificationsSection productId={id} />
                  )}
                </div>

                {/* Right Column - Sidebar */}
                <div className="space-y-6 min-w-0">
                  {/* Images */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('admin.marketing.promoKitResult.afbeeldingen')}</CardTitle>
                      <CardDescription>{t('admin.productForm.upload_afbeeldingen_of_kies_uit_je')}</CardDescription>
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
                                  <p className="text-sm text-muted-foreground text-center"><span className="font-semibold">{t('admin.productForm.klik_om_te_uploaden_2')}</span></p>
                                  <p className="text-xs text-muted-foreground">{t('admin.productForm.png_jpg_webp_of_gif')}</p>
                                </>
                              )}
                            </div>
                            <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} disabled={uploading} />
                          </label>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => setLibraryPickerOpen(true)}
                        >
                          <Library className="mr-2 h-4 w-4" />
                          {t('admin.products.variantExtraImagesDialog.kies_uit_bibliotheek')}
                        </Button>
                        {form.watch('images').length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {form.watch('images').map((url, index) => (
                              <div key={url} className={cn(
                                "relative group aspect-square rounded-lg overflow-hidden border-2",
                                form.watch('featured_image') === url ? "border-primary" : "border-transparent"
                              )}>
                                <img src={url} alt={t('admin.productForm.product_nummer', { number: index + 1 })} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <Button type="button" size="icon" variant="secondary" onClick={() => setFeaturedImage(url)} title={t('admin.productForm.maak_hoofdafbeelding')}>
                                    <Star className={cn("h-4 w-4", form.watch('featured_image') === url && "fill-amber-500 text-amber-500")} />
                                  </Button>
                                  <Button type="button" size="icon" variant="secondary" onClick={() => { setImageEditorUrl(url); setImageEditorOpen(true); }} title={t('admin.productForm.ai_bewerken')}>
                                    <Wand2 className="h-4 w-4" />
                                  </Button>
                                  <Button type="button" size="icon" variant="secondary" onClick={() => downloadImage(url, `product-${index + 1}`)} title={t('admin.marketing.mediaAssetsLibrary.downloaden')}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button type="button" size="icon" variant="destructive" onClick={() => removeImage(url)} title={t('common.delete')}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                {form.watch('featured_image') === url && (
                                  <div className="absolute top-2 left-2">
                                    <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded">{t('admin.products.productPhotosManager.hoofd')}</span>
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
                      <CardTitle>{t('admin.seo.structuredDataPreview.organisatie')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t('admin.marketing.mediaAssetsLibrary.folders.categorie_n')}</Label>
                        <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="w-full justify-start font-normal">
                              {selectedCategoryIds.length > 0
                                ? `${selectedCategoryIds.length} categorie${selectedCategoryIds.length > 1 ? 'ën' : ''} geselecteerd`
                                : 'Selecteer categorieën...'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0" align="start">
                            <Command shouldFilter={true}>
                              <CommandInput placeholder={t('admin.productForm.zoek_categorie')} value={categorySearchQuery} onValueChange={setCategorySearchQuery} />
                              <CommandList>
                                <CommandEmpty>{t('admin.seo.sEOCategoryTable.geen_categorieen_gevonden')}</CommandEmpty>
                                <CommandGroup>
                                  {flatCategoryTree.map(({ category: cat, level, path }) => {
                                    const isSelected = selectedCategoryIds.includes(cat.id);
                                    return (
                                      <CommandItem
                                        key={cat.id}
                                        value={path}
                                        onSelect={() => {
                                          setSelectedCategoryIds(prev =>
                                            isSelected
                                              ? prev.filter(id => id !== cat.id)
                                              : [...prev, cat.id]
                                          );
                                        }}
                                      >
                                        <span style={{ marginLeft: level * 16 }} className="flex items-center gap-2 flex-1 min-w-0">
                                          <Checkbox checked={isSelected} />
                                          <span className={level === 0 ? 'font-medium' : ''}>{cat.name}</span>
                                        </span>
                                        {isSelected && selectedCategoryIds[0] === cat.id && (
                                          <Badge variant="secondary" className="ml-auto text-xs shrink-0">{t('admin.seo.keywordResearchPanel.primair')}</Badge>
                                        )}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {selectedCategoryIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {selectedCategoryIds.map((catId, index) => {
                              const categoryPath = getCategoryPath(catId);
                              if (!categoryPath) return null;
                              return (
                                <Badge key={catId} variant={index === 0 ? 'default' : 'secondary'} className="gap-1">
                                  {categoryPath}
                                  {index === 0 && <span className="text-xs opacity-70">{t('admin.productForm.primair')}</span>}
                                  <button type="button" onClick={() => setSelectedCategoryIds(prev => prev.filter(id => id !== catId))} className="hover:text-destructive">
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>{t('admin.marketing.segmentBuilder.tags')}</Label>
                        <div className="flex gap-2">
                          <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder={t('admin.productForm.voeg_tag_toe')} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                          <Button type="button" variant="secondary" onClick={addTag}>{t('common.add')}</Button>
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
                      <CardTitle>{t('common.status')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="is_active" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel>{t('admin.marketing.aBTestingPanel.actief')}</FormLabel>
                            <FormDescription>{t('admin.productForm.product_is_zichtbaar_in_de_winkel')}</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="hide_from_storefront" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel>{t('admin.productForm.verbergen_op_webshop')}</FormLabel>
                            <FormDescription>{t('admin.productForm.niet_zichtbaar_online_wel_via_pos')}</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="is_featured" render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <FormLabel>{t('admin.productForm.uitgelicht')}</FormLabel>
                            <FormDescription>{t('admin.productForm.toon_op_homepage_en_in_speciale')}</FormDescription>
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
                      <CardDescription>{t('admin.productForm.zoekmachine_optimalisatie')}</CardDescription>
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
                            <FormLabel>{t('admin.productForm.meta_titel')}</FormLabel>
                            <AIFieldAssistant
                              fieldType="meta_title"
                              currentValue={field.value}
                              onApply={(text) => form.setValue('meta_title', text, { shouldDirty: true })}
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
                            <FormLabel>{t('admin.productForm.meta_beschrijving')}</FormLabel>
                            <AIFieldAssistant
                              fieldType="meta_description"
                              currentValue={field.value}
                              onApply={(text) => form.setValue('meta_description', text, { shouldDirty: true })}
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
                        <p className="text-sm font-medium text-muted-foreground mb-2">{t('admin.marketing.templateDialog.voorbeeld')}</p>
                        <div className="space-y-1">
                          <p className="text-blue-600 text-sm hover:underline cursor-pointer truncate">{form.watch('meta_title') || form.watch('name') || 'Product titel'}</p>
                          <p className="text-xs text-green-700 truncate">jouwwinkel.nl/producten/{form.watch('slug') || 'product-slug'}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{form.watch('meta_description') || form.watch('short_description') || 'Productbeschrijving...'}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{t('admin.productForm.vertalingen_2')}</span>
                    </div>
                    <Link to="/admin/marketing/translations">
                      <Button type="button" variant="outline" size="sm"><ExternalLink className="h-3 w-3 mr-1" />{t('admin.productForm.vertaal_hub')}</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

                </div>
              </div>
            </TabsContent>

            {/* Translations Tab */}
            <TabsContent value="translations">
              {isEditing && id ? (
                <EntityTranslationTabs entityType="product" entityId={id} />
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">{t('admin.productForm.sla_het_product_eerst_op_om_3')}</p>
                  </CardContent>
                </Card>
              )}
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
                    <p className="text-muted-foreground">{t('admin.productForm.sla_het_product_eerst_op_om_4')}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Advertenties Tab */}
            <TabsContent value="ads">
              {isEditing && id && currentTenant ? (
                <ProductAdsSection
                  productId={id}
                  tenantId={currentTenant.id}
                  productEan={product?.barcode || (product as any)?.bol_ean}
                />
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">{t('admin.productForm.sla_het_product_eerst_op_om_5')}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </form>
      </Form>

      <FloatingSaveBar
        isDirty={form.formState.isDirty}
        isSaving={isSubmitting}
        onSave={form.handleSubmit(onSubmit)}
        onCancel={() => form.reset()}
      />

      <ImageEditorDialog
        open={imageEditorOpen}
        onOpenChange={setImageEditorOpen}
        imageUrl={imageEditorUrl}
        productName={form.watch('name')}
        onApply={(newUrl) => {
          const currentImages = form.getValues('images') || [];
          const idx = currentImages.indexOf(imageEditorUrl);
          if (idx >= 0) {
            const updated = [...currentImages];
            updated[idx] = newUrl;
            form.setValue('images', updated, { shouldDirty: true });
            if (form.getValues('featured_image') === imageEditorUrl) {
              form.setValue('featured_image', newUrl, { shouldDirty: true });
            }
          }
        }}
      />

      <MediaLibraryPickerDialog
        open={libraryPickerOpen}
        onOpenChange={setLibraryPickerOpen}
        existingUrls={form.watch('images') || []}
        onSelect={handleLibrarySelect}
      />
    </div>
  );
}
