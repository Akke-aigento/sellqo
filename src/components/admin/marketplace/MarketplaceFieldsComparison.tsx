import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X, Minus, ExternalLink, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/product';

interface MarketplaceFieldsComparisonProps {
  product: Product;
}

interface FieldDefinition {
  key: string;
  label: string;
  category: 'identification' | 'content' | 'seo' | 'pricing' | 'inventory' | 'logistics' | 'status';
  description?: string;
}

interface PlatformFieldConfig {
  supported: boolean;
  fieldKey?: string;
  maxLength?: number;
  required?: boolean;
  format?: string;
}

// Define all possible fields across platforms
const FIELD_DEFINITIONS: FieldDefinition[] = [
  // Identification
  { key: 'product_id', label: 'Platform ID', category: 'identification' },
  { key: 'sku', label: 'SKU', category: 'identification' },
  { key: 'ean', label: 'EAN/Barcode', category: 'identification' },
  { key: 'asin', label: 'ASIN', category: 'identification', description: 'Amazon Standard Identification Number' },
  { key: 'category', label: 'Categorie', category: 'identification' },
  
  // Content
  { key: 'title', label: 'Titel', category: 'content' },
  { key: 'description', label: 'Beschrijving', category: 'content' },
  { key: 'bullets', label: 'Bullet Points', category: 'content' },
  { key: 'images', label: 'Afbeeldingen', category: 'content' },
  
  // SEO
  { key: 'meta_title', label: 'Meta Titel', category: 'seo' },
  { key: 'meta_description', label: 'Meta Beschrijving', category: 'seo' },
  { key: 'keywords', label: 'Zoekwoorden', category: 'seo' },
  
  // Pricing
  { key: 'price', label: 'Prijs', category: 'pricing' },
  { key: 'compare_at_price', label: 'Oorspronkelijke prijs', category: 'pricing' },
  
  // Inventory
  { key: 'stock', label: 'Voorraad', category: 'inventory' },
  { key: 'condition', label: 'Conditie', category: 'inventory' },
  
  // Logistics
  { key: 'fulfillment', label: 'Fulfilment', category: 'logistics', description: 'FBR/FBB (Bol) of FBM/FBA (Amazon)' },
  { key: 'delivery_code', label: 'Levertijd', category: 'logistics' },
  { key: 'weight', label: 'Gewicht', category: 'logistics' },
  
  // Status
  { key: 'listing_status', label: 'Listing Status', category: 'status' },
  { key: 'last_synced', label: 'Laatst gesynchroniseerd', category: 'status' },
];

// Platform field configurations
const PLATFORM_CONFIGS: Record<string, Record<string, PlatformFieldConfig>> = {
  bol_com: {
    product_id: { supported: true, fieldKey: 'bol_offer_id' },
    sku: { supported: true, fieldKey: 'sku' },
    ean: { supported: true, fieldKey: 'bol_ean', required: true },
    asin: { supported: false },
    category: { supported: false },
    title: { supported: true, fieldKey: 'bol_optimized_title', maxLength: 150 },
    description: { supported: true, fieldKey: 'bol_optimized_description' },
    bullets: { supported: true, fieldKey: 'bol_bullets', format: '5 bullets max 150 tekens' },
    images: { supported: true },
    meta_title: { supported: false },
    meta_description: { supported: false },
    keywords: { supported: false },
    price: { supported: true },
    compare_at_price: { supported: false },
    stock: { supported: true },
    condition: { supported: true, fieldKey: 'bol_condition' },
    fulfillment: { supported: true, fieldKey: 'bol_fulfilment_method', format: 'FBR of LVB' },
    delivery_code: { supported: true, fieldKey: 'bol_delivery_code' },
    weight: { supported: false },
    listing_status: { supported: true, fieldKey: 'bol_listing_status' },
    last_synced: { supported: true, fieldKey: 'bol_last_synced_at' },
  },
  amazon: {
    product_id: { supported: true, fieldKey: 'amazon_offer_id' },
    sku: { supported: true, fieldKey: 'sku', required: true },
    ean: { supported: true, fieldKey: 'barcode' },
    asin: { supported: true, fieldKey: 'amazon_asin' },
    category: { supported: false },
    title: { supported: true, fieldKey: 'amazon_optimized_title', maxLength: 200 },
    description: { supported: true, fieldKey: 'amazon_optimized_description' },
    bullets: { supported: true, fieldKey: 'amazon_bullets', format: '5 bullets max 500 tekens' },
    images: { supported: true },
    meta_title: { supported: false },
    meta_description: { supported: false },
    keywords: { supported: true },
    price: { supported: true },
    compare_at_price: { supported: false },
    stock: { supported: true },
    condition: { supported: true, fieldKey: 'amazon_condition' },
    fulfillment: { supported: true, fieldKey: 'amazon_fulfillment_channel', format: 'FBM of FBA' },
    delivery_code: { supported: false },
    weight: { supported: true },
    listing_status: { supported: true, fieldKey: 'amazon_listing_status' },
    last_synced: { supported: true, fieldKey: 'amazon_last_synced_at' },
  },
  ebay: {
    product_id: { supported: true, fieldKey: 'ebay_item_id' },
    sku: { supported: true, fieldKey: 'sku' },
    ean: { supported: true, fieldKey: 'barcode' },
    asin: { supported: false },
    category: { supported: true, fieldKey: 'ebay_category_id', required: true },
    title: { supported: true, fieldKey: 'ebay_optimized_title', maxLength: 80 },
    description: { supported: true, fieldKey: 'ebay_optimized_description', format: 'HTML' },
    bullets: { supported: false },
    images: { supported: true },
    meta_title: { supported: false },
    meta_description: { supported: false },
    keywords: { supported: false },
    price: { supported: true },
    compare_at_price: { supported: false },
    stock: { supported: true },
    condition: { supported: true, fieldKey: 'ebay_condition' },
    fulfillment: { supported: false },
    delivery_code: { supported: false },
    weight: { supported: true },
    listing_status: { supported: true, fieldKey: 'ebay_listing_status' },
    last_synced: { supported: true, fieldKey: 'ebay_last_synced_at' },
  },
  shopify: {
    product_id: { supported: true, fieldKey: 'shopify_product_id' },
    sku: { supported: true, fieldKey: 'sku' },
    ean: { supported: true, fieldKey: 'barcode' },
    asin: { supported: false },
    category: { supported: false },
    title: { supported: true, fieldKey: 'shopify_optimized_title' },
    description: { supported: true, fieldKey: 'shopify_optimized_description' },
    bullets: { supported: true, fieldKey: 'shopify_bullets', format: 'Optioneel' },
    images: { supported: true },
    meta_title: { supported: true, fieldKey: 'shopify_meta_title', maxLength: 70 },
    meta_description: { supported: true, fieldKey: 'shopify_meta_description', maxLength: 320 },
    keywords: { supported: true, fieldKey: 'tags' },
    price: { supported: true },
    compare_at_price: { supported: true },
    stock: { supported: true },
    condition: { supported: false },
    fulfillment: { supported: false },
    delivery_code: { supported: false },
    weight: { supported: true },
    listing_status: { supported: true, fieldKey: 'shopify_listing_status' },
    last_synced: { supported: true, fieldKey: 'shopify_last_synced_at' },
  },
  woocommerce: {
    product_id: { supported: true, fieldKey: 'woocommerce_product_id' },
    sku: { supported: true, fieldKey: 'sku' },
    ean: { supported: true, fieldKey: 'barcode' },
    asin: { supported: false },
    category: { supported: false },
    title: { supported: true, fieldKey: 'woocommerce_optimized_title' },
    description: { supported: true, fieldKey: 'woocommerce_optimized_description' },
    bullets: { supported: true, fieldKey: 'woocommerce_bullets', format: 'Optioneel' },
    images: { supported: true },
    meta_title: { supported: true, fieldKey: 'woocommerce_meta_title', maxLength: 60, format: 'Yoast/RankMath' },
    meta_description: { supported: true, fieldKey: 'woocommerce_meta_description', maxLength: 160, format: 'Yoast/RankMath' },
    keywords: { supported: true, fieldKey: 'tags' },
    price: { supported: true },
    compare_at_price: { supported: true },
    stock: { supported: true },
    condition: { supported: false },
    fulfillment: { supported: false },
    delivery_code: { supported: false },
    weight: { supported: true },
    listing_status: { supported: true, fieldKey: 'woocommerce_listing_status' },
    last_synced: { supported: true, fieldKey: 'woocommerce_last_synced_at' },
  },
};

const PLATFORMS = [
  { id: 'bol_com', name: 'Bol.com', color: 'bg-blue-500' },
  { id: 'amazon', name: 'Amazon', color: 'bg-orange-500' },
  { id: 'ebay', name: 'eBay', color: 'bg-yellow-500' },
  { id: 'shopify', name: 'Shopify', color: 'bg-green-500' },
  { id: 'woocommerce', name: 'WooCommerce', color: 'bg-purple-500' },
];

const CATEGORIES = [
  { id: 'identification', label: 'Identificatie', icon: '🏷️' },
  { id: 'content', label: 'Content', icon: '📝' },
  { id: 'seo', label: 'SEO', icon: '🔍' },
  { id: 'pricing', label: 'Prijzen', icon: '💰' },
  { id: 'inventory', label: 'Voorraad', icon: '📦' },
  { id: 'logistics', label: 'Logistiek', icon: '🚚' },
  { id: 'status', label: 'Status', icon: '📊' },
];

export function MarketplaceFieldsComparison({ product }: MarketplaceFieldsComparisonProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['content', 'seo']));

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const getFieldValue = (platformId: string, fieldKey: string): string | null => {
    const config = PLATFORM_CONFIGS[platformId]?.[fieldKey];
    if (!config?.supported || !config.fieldKey) return null;

    const productRecord = product as unknown as Record<string, unknown>;
    const value = productRecord[config.fieldKey];
    
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return value.length > 0 ? `${value.length} items` : null;
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nee';
    if (value instanceof Date) return value.toLocaleDateString('nl-NL');
    if (typeof value === 'string' && value.length > 50) return `${value.substring(0, 50)}...`;
    
    return String(value);
  };

  const renderFieldCell = (platformId: string, fieldKey: string) => {
    const config = PLATFORM_CONFIGS[platformId]?.[fieldKey];
    
    if (!config?.supported) {
      return (
        <div className="flex items-center justify-center">
          <Minus className="h-4 w-4 text-muted-foreground/30" />
        </div>
      );
    }

    const value = getFieldValue(platformId, fieldKey);
    const hasValue = value !== null && value !== '';
    const isStatus = fieldKey === 'listing_status';

    if (isStatus) {
      const statusValue = value?.toLowerCase();
      return (
        <Badge
          variant="outline"
          className={cn(
            "text-xs",
            statusValue === 'listed' && "bg-green-100 text-green-700 border-green-300",
            statusValue === 'pending' && "bg-amber-100 text-amber-700 border-amber-300",
            statusValue === 'error' && "bg-red-100 text-red-700 border-red-300",
            !statusValue && "bg-gray-100 text-gray-500"
          )}
        >
          {statusValue === 'listed' ? 'Actief' : statusValue === 'pending' ? 'Wacht' : statusValue === 'error' ? 'Fout' : 'Niet gepubliceerd'}
        </Badge>
      );
    }

    return (
      <div className="flex items-center gap-1">
        {hasValue ? (
          <>
            <Check className="h-3 w-3 text-green-500 shrink-0" />
            <span className="text-xs text-muted-foreground truncate max-w-[80px]" title={value || undefined}>
              {value}
            </span>
          </>
        ) : (
          <>
            <X className="h-3 w-3 text-red-400 shrink-0" />
            <span className="text-xs text-muted-foreground">Ontbreekt</span>
          </>
        )}
        {config.required && !hasValue && (
          <Badge variant="destructive" className="text-[10px] px-1 py-0">Vereist</Badge>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          Marketplace Velden Overzicht
        </CardTitle>
        <CardDescription>
          Vergelijk alle listing velden per platform en identificeer ontbrekende gegevens
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 w-48">Veld</th>
                {PLATFORMS.map((platform) => (
                  <th key={platform.id} className="text-center py-2 px-2 min-w-[120px]">
                    <div className="flex items-center justify-center gap-1">
                      <span className={cn("w-2 h-2 rounded-full", platform.color)} />
                      <span className="text-xs font-medium">{platform.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category) => {
                const categoryFields = FIELD_DEFINITIONS.filter((f) => f.category === category.id);
                const isExpanded = expandedCategories.has(category.id);

                return (
                  <Collapsible key={category.id} open={isExpanded} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <tr 
                          className="border-b bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => toggleCategory(category.id)}
                        >
                          <td colSpan={PLATFORMS.length + 1} className="py-2 px-2">
                            <div className="flex items-center gap-2 font-medium">
                              <span>{category.icon}</span>
                              <span>{category.label}</span>
                              <Badge variant="outline" className="text-xs">
                                {categoryFields.length}
                              </Badge>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 ml-auto" />
                              ) : (
                                <ChevronDown className="h-4 w-4 ml-auto" />
                              )}
                            </div>
                          </td>
                        </tr>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <>
                          {categoryFields.map((field) => (
                            <tr key={field.key} className="border-b hover:bg-muted/20">
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-1">
                                  <span className="text-sm">{field.label}</span>
                                  {field.description && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Info className="h-3 w-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-xs">{field.description}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </td>
                              {PLATFORMS.map((platform) => (
                                <td key={platform.id} className="py-2 px-2 text-center">
                                  {renderFieldCell(platform.id, field.key)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Check className="h-3 w-3 text-green-500" />
            <span>Ingevuld</span>
          </div>
          <div className="flex items-center gap-1">
            <X className="h-3 w-3 text-red-400" />
            <span>Ontbreekt</span>
          </div>
          <div className="flex items-center gap-1">
            <Minus className="h-3 w-3 text-muted-foreground/30" />
            <span>Niet ondersteund</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
