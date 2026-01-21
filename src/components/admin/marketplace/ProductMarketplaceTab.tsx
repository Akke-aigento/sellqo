import { useState, useEffect, useCallback } from 'react';
import { Sparkles, ShoppingBag, Package, RefreshCw, Loader2, Check, AlertCircle, ExternalLink, Save, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMarketplaceListing, type OptimizedContent, type BolOfferData, type AmazonOfferData } from '@/hooks/useMarketplaceListing';
import { Store } from 'lucide-react';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { getEANValidationStatus } from '@/lib/eanValidation';
import { getASINValidationStatus } from '@/lib/asinValidation';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types/product';

interface ProductMarketplaceTabProps {
  product: Product;
  onRefresh?: () => void;
}

const BOL_DELIVERY_CODES = [
  { value: '24uurs-21', label: '24 uur (besteld voor 21:00)' },
  { value: '24uurs-23', label: '24 uur (besteld voor 23:00)' },
  { value: '1-2d', label: '1-2 werkdagen' },
  { value: '2-3d', label: '2-3 werkdagen' },
  { value: '3-5d', label: '3-5 werkdagen' },
  { value: '4-8d', label: '4-8 werkdagen' },
  { value: '1-8d', label: '1-8 werkdagen' },
];

const BOL_CONDITIONS = [
  { value: 'NEW', label: 'Nieuw' },
  { value: 'AS_NEW', label: 'Als nieuw' },
  { value: 'GOOD', label: 'Goed' },
  { value: 'REASONABLE', label: 'Redelijk' },
  { value: 'MODERATE', label: 'Matig' },
];

const BOL_FULFILLMENT = [
  { value: 'FBR', label: 'Zelf verzenden (FBR)' },
  { value: 'FBB', label: 'Logistiek via Bol (LVB)' },
];

const AMAZON_CONDITIONS = [
  { value: 'new', label: 'Nieuw' },
  { value: 'used_like_new', label: 'Gebruikt - Als nieuw' },
  { value: 'used_very_good', label: 'Gebruikt - Zeer goed' },
  { value: 'used_good', label: 'Gebruikt - Goed' },
  { value: 'used_acceptable', label: 'Gebruikt - Acceptabel' },
];

const AMAZON_FULFILLMENT = [
  { value: 'MFN', label: 'Zelf verzenden (FBM)' },
  { value: 'AFN', label: 'Door Amazon (FBA)' },
];

export function ProductMarketplaceTab({ product, onRefresh }: ProductMarketplaceTabProps) {
  const { getConnectionByType } = useMarketplaceConnections();
  const { 
    optimizeContent, 
    isOptimizing, 
    saveOptimizedContent, 
    saveMarketplaceSettings,
    createBolOffer, 
    updateBolOffer,
    checkBolProcessStatus,
    isCheckingStatus,
    createAmazonOffer,
    updateAmazonOffer,
    checkAmazonListingStatus,
    isCheckingAmazonStatus,
  } = useMarketplaceListing();
  const { toast } = useToast();

  const bolConnection = getConnectionByType('bol_com');
  const hasBolConnection = !!bolConnection;
  const amazonConnection = getConnectionByType('amazon');
  const hasAmazonConnection = !!amazonConnection;
  const shopifyConnection = getConnectionByType('shopify');
  const hasShopifyConnection = !!shopifyConnection;

  // Bol.com state - initialized from product
  const [bolEnabled, setBolEnabled] = useState(product.bol_listing_status !== 'not_listed');
  const [bolEan, setBolEan] = useState(product.bol_ean || product.barcode || '');
  const [bolDeliveryCode, setBolDeliveryCode] = useState(product.bol_delivery_code || '24uurs-21');
  const [bolCondition, setBolCondition] = useState(product.bol_condition || 'NEW');
  const [bolFulfillment, setBolFulfillment] = useState<'FBR' | 'FBB'>((product.bol_fulfilment_method as 'FBR' | 'FBB') || 'FBR');
  const [bolOptimizedTitle, setBolOptimizedTitle] = useState(product.bol_optimized_title || '');
  const [bolBullets, setBolBullets] = useState<string[]>(product.bol_bullets || []);
  
  // Amazon state - initialized from product
  const [amazonEnabled, setAmazonEnabled] = useState(product.amazon_listing_status !== 'not_listed' && product.amazon_listing_status !== null);
  const [amazonAsin, setAmazonAsin] = useState(product.amazon_asin || '');
  const [amazonCondition, setAmazonCondition] = useState('new');
  const [amazonFulfillment, setAmazonFulfillment] = useState<'MFN' | 'AFN'>('MFN');
  const [amazonOptimizedTitle, setAmazonOptimizedTitle] = useState(product.amazon_optimized_title || '');
  const [amazonOptimizedDescription, setAmazonOptimizedDescription] = useState(product.amazon_optimized_description || '');
  const [amazonBullets, setAmazonBullets] = useState<string[]>(product.amazon_bullets || []);
  
  // Shopify state - initialized from product
  const [shopifyEnabled, setShopifyEnabled] = useState(
    product.shopify_listing_status !== null && product.shopify_listing_status !== 'not_listed'
  );
  const [shopifyOptimizedTitle, setShopifyOptimizedTitle] = useState(product.shopify_optimized_title || '');
  const [shopifyOptimizedDescription, setShopifyOptimizedDescription] = useState(product.shopify_optimized_description || '');
  
  // Track if settings have changed
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasAmazonUnsavedChanges, setHasAmazonUnsavedChanges] = useState(false);
  const [hasShopifyUnsavedChanges, setHasShopifyUnsavedChanges] = useState(false);
  
  // Shopify action states
  const [isPublishingShopify, setIsPublishingShopify] = useState(false);
  const [isSyncingShopify, setIsSyncingShopify] = useState(false);

  // Validations
  const eanValidation = getEANValidationStatus(bolEan);
  const asinValidation = getASINValidationStatus(amazonAsin);

  // Update local state when product changes
  useEffect(() => {
    setBolEnabled(product.bol_listing_status !== 'not_listed');
    setBolEan(product.bol_ean || product.barcode || '');
    setBolDeliveryCode(product.bol_delivery_code || '24uurs-21');
    setBolCondition(product.bol_condition || 'NEW');
    setBolFulfillment((product.bol_fulfilment_method as 'FBR' | 'FBB') || 'FBR');
    setBolOptimizedTitle(product.bol_optimized_title || '');
    setBolBullets(product.bol_bullets || []);
    
    // Amazon state
    setAmazonEnabled(product.amazon_listing_status !== 'not_listed' && product.amazon_listing_status !== null);
    setAmazonAsin(product.amazon_asin || '');
    setAmazonOptimizedTitle(product.amazon_optimized_title || '');
    setAmazonOptimizedDescription(product.amazon_optimized_description || '');
    setAmazonBullets(product.amazon_bullets || []);
    
    // Shopify state
    setShopifyEnabled(product.shopify_listing_status !== null && product.shopify_listing_status !== 'not_listed');
    setShopifyOptimizedTitle(product.shopify_optimized_title || '');
    setShopifyOptimizedDescription(product.shopify_optimized_description || '');
    
    setHasUnsavedChanges(false);
    setHasAmazonUnsavedChanges(false);
    setHasShopifyUnsavedChanges(false);
  }, [product]);

  // Track Bol.com changes
  const handleFieldChange = useCallback((setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
    setter(value);
    setHasUnsavedChanges(true);
  }, []);

  // Track Amazon changes
  const handleAmazonFieldChange = useCallback((setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
    setter(value);
    setHasAmazonUnsavedChanges(true);
  }, []);

  // Track Shopify changes
  const handleShopifyFieldChange = useCallback((setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
    setter(value);
    setHasShopifyUnsavedChanges(true);
  }, []);

  const handleSaveSettings = async () => {
    try {
      await saveMarketplaceSettings.mutateAsync({
        productId: product.id,
        settings: {
          bol_ean: bolEan,
          bol_delivery_code: bolDeliveryCode,
          bol_condition: bolCondition,
          bol_fulfilment_method: bolFulfillment,
          bol_optimized_title: bolOptimizedTitle,
          bol_bullets: bolBullets.filter(Boolean),
        },
      });
      setHasUnsavedChanges(false);
      onRefresh?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleSaveAmazonSettings = async () => {
    try {
      await saveMarketplaceSettings.mutateAsync({
        productId: product.id,
        settings: {
          amazon_asin: amazonAsin,
          amazon_optimized_title: amazonOptimizedTitle,
          amazon_optimized_description: amazonOptimizedDescription,
          amazon_bullets: amazonBullets.filter(Boolean),
        },
      });
      setHasAmazonUnsavedChanges(false);
      onRefresh?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleSaveShopifySettings = async () => {
    try {
      await saveMarketplaceSettings.mutateAsync({
        productId: product.id,
        settings: {
          shopify_optimized_title: shopifyOptimizedTitle,
          shopify_optimized_description: shopifyOptimizedDescription,
        },
      });
      setHasShopifyUnsavedChanges(false);
      onRefresh?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleOptimizeBol = async () => {
    const content = await optimizeContent(product, 'bol_com');
    if (content) {
      setBolOptimizedTitle(content.title);
      setBolBullets(content.bullets);
      setHasUnsavedChanges(true);
      
      // Auto-save optimized content
      saveOptimizedContent.mutate({
        productId: product.id,
        marketplace: 'bol_com',
        content,
      });
    }
  };

  const handlePublishToBol = async () => {
    // Validate EAN
    if (!eanValidation.isValid) {
      toast({
        title: 'Ongeldige EAN',
        description: eanValidation.message,
        variant: 'destructive',
      });
      return;
    }

    // Warn about zero stock
    if ((product.stock ?? 0) === 0) {
      toast({
        title: 'Waarschuwing',
        description: 'Je publiceert met 0 voorraad. Het product wordt direct als uitverkocht getoond.',
        variant: 'default',
      });
    }

    const offerData: BolOfferData = {
      ean: bolEan.replace(/\s/g, ''),
      condition: bolCondition as BolOfferData['condition'],
      price: product.price,
      stock: product.stock ?? 0,
      delivery_code: bolDeliveryCode,
      fulfilment_method: bolFulfillment,
      title: bolOptimizedTitle || product.name,
    };

    try {
      await createBolOffer.mutateAsync({ product, offerData });
      onRefresh?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCheckStatus = async () => {
    const result = await checkBolProcessStatus(product);
    if (result.success) {
      onRefresh?.();
    }
  };

  const handleSyncBol = async () => {
    try {
      await updateBolOffer.mutateAsync({
        product,
        updateType: 'all',
        updateData: {
          price: product.price,
          stock: product.stock ?? 0,
          delivery_code: bolDeliveryCode,
        },
      });
      onRefresh?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'listed':
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Actief
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">
            <Clock className="h-3 w-3 mr-1" /> Wordt verwerkt
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" /> Fout
          </Badge>
        );
      default:
        return <Badge variant="outline">Niet gepubliceerd</Badge>;
    }
  };

  // Amazon handlers
  const handleOptimizeAmazon = async () => {
    const content = await optimizeContent(product, 'amazon');
    if (content) {
      setAmazonOptimizedTitle(content.title);
      setAmazonBullets(content.bullets);
      setAmazonOptimizedDescription(content.description);
      setHasAmazonUnsavedChanges(true);
      
      // Auto-save optimized content
      saveOptimizedContent.mutate({
        productId: product.id,
        marketplace: 'amazon',
        content,
      });
    }
  };

  const handlePublishToAmazon = async () => {
    // Warn about zero stock
    if ((product.stock ?? 0) === 0) {
      toast({
        title: 'Waarschuwing',
        description: 'Je publiceert met 0 voorraad. Het product wordt direct als uitverkocht getoond.',
        variant: 'default',
      });
    }

    // Generate SKU from product SKU or id
    const sku = product.sku || `SKU-${product.id.slice(0, 8)}`;

    const offerData: AmazonOfferData = {
      asin: amazonAsin || undefined,
      sku,
      price: product.price,
      quantity: product.stock ?? 0,
      condition: amazonCondition as AmazonOfferData['condition'],
      fulfilment_channel: amazonFulfillment,
      title: amazonOptimizedTitle || product.name,
      bullets: amazonBullets.filter(Boolean),
      description: amazonOptimizedDescription || product.description || undefined,
    };

    try {
      await createAmazonOffer.mutateAsync({ product, offerData });
      onRefresh?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCheckAmazonStatus = async () => {
    const result = await checkAmazonListingStatus(product);
    if (result.success) {
      onRefresh?.();
    }
  };

  const handleSyncAmazon = async () => {
    try {
      await updateAmazonOffer.mutateAsync({
        product,
        updateType: 'all',
        updateData: {
          price: product.price,
          quantity: product.stock ?? 0,
        },
      });
      onRefresh?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Shopify handlers
  const handleOptimizeShopify = async () => {
    const content = await optimizeContent(product, 'shopify');
    if (content) {
      setShopifyOptimizedTitle(content.title);
      setShopifyOptimizedDescription(content.description);
      setHasShopifyUnsavedChanges(true);
      
      // Auto-save optimized content
      saveOptimizedContent.mutate({
        productId: product.id,
        marketplace: 'shopify',
        content,
      });
    }
  };

  const handlePublishToShopify = async () => {
    if (!shopifyConnection) return;
    
    setIsPublishingShopify(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-shopify-product', {
        body: {
          product_id: product.id,
          tenant_id: product.tenant_id,
          connection_id: shopifyConnection.id,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Shopify API fout');

      toast({
        title: 'Product gepubliceerd!',
        description: 'Je product is succesvol gepubliceerd naar Shopify',
      });
      onRefresh?.();
    } catch (error) {
      toast({
        title: 'Publicatie mislukt',
        description: error instanceof Error ? error.message : 'Kon product niet publiceren',
        variant: 'destructive',
      });
    } finally {
      setIsPublishingShopify(false);
    }
  };

  const handleSyncShopify = async () => {
    if (!shopifyConnection) return;
    
    setIsSyncingShopify(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-shopify-product', {
        body: {
          product_id: product.id,
          tenant_id: product.tenant_id,
          connection_id: shopifyConnection.id,
          update_type: 'all',
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Shopify sync fout');

      toast({
        title: 'Gesynchroniseerd!',
        description: 'Je product is bijgewerkt in Shopify',
      });
      onRefresh?.();
    } catch (error) {
      toast({
        title: 'Synchronisatie mislukt',
        description: error instanceof Error ? error.message : 'Kon product niet synchroniseren',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingShopify(false);
    }
  };

  const isListed = product.bol_listing_status === 'listed';
  const isPending = product.bol_listing_status === 'pending';
  const hasError = product.bol_listing_status === 'error';

  const isAmazonListed = product.amazon_listing_status === 'listed';
  const isAmazonPending = product.amazon_listing_status === 'pending';
  const hasAmazonError = product.amazon_listing_status === 'error';

  const isShopifyListed = product.shopify_listing_status === 'listed';
  const isShopifyPending = product.shopify_listing_status === 'pending';
  const hasShopifyError = product.shopify_listing_status === 'error';

  return (
    <div className="space-y-6">
      {/* Bol.com Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Bol.com</CardTitle>
                <CardDescription>
                  {hasBolConnection ? 'Verbonden' : 'Niet verbonden - Ga naar Connect om te koppelen'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(product.bol_listing_status)}
              <Switch
                checked={bolEnabled}
                onCheckedChange={(checked) => handleFieldChange(setBolEnabled, checked)}
                disabled={!hasBolConnection}
              />
            </div>
          </div>
        </CardHeader>

        {bolEnabled && hasBolConnection && (
          <CardContent className="space-y-6">
            {/* Unsaved changes alert */}
            {hasUnsavedChanges && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Je hebt onopgeslagen wijzigingen</span>
                  <Button 
                    size="sm" 
                    onClick={handleSaveSettings}
                    disabled={saveMarketplaceSettings.isPending}
                  >
                    {saveMarketplaceSettings.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Opslaan
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Error message if any */}
            {hasError && product.bol_listing_error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{product.bol_listing_error}</AlertDescription>
              </Alert>
            )}

            {/* Pending status - show check button */}
            {isPending && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Je aanbieding wordt verwerkt door Bol.com</span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleCheckStatus}
                    disabled={isCheckingStatus}
                  >
                    {isCheckingStatus ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    Status controleren
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* EAN & Settings */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bol-ean">EAN Code *</Label>
                <div className="relative">
                  <Input
                    id="bol-ean"
                    value={bolEan}
                    onChange={(e) => handleFieldChange(setBolEan, e.target.value)}
                    placeholder="8719274850014"
                    className={`pr-10 ${
                      bolEan 
                        ? eanValidation.isValid 
                          ? 'border-green-500 focus-visible:ring-green-500' 
                          : 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }`}
                    disabled={isListed}
                  />
                  {bolEan && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {eanValidation.isValid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  )}
                </div>
                <p className={`text-xs ${bolEan && !eanValidation.isValid ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {bolEan ? eanValidation.message : 'Verplicht voor Bol.com (EAN-13)'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Levertijd</Label>
                <Select 
                  value={bolDeliveryCode} 
                  onValueChange={(value) => handleFieldChange(setBolDeliveryCode, value)}
                  disabled={isListed && !hasUnsavedChanges}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOL_DELIVERY_CODES.map((code) => (
                      <SelectItem key={code.value} value={code.value}>
                        {code.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Conditie</Label>
                <Select 
                  value={bolCondition} 
                  onValueChange={(value) => handleFieldChange(setBolCondition, value)}
                  disabled={isListed}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOL_CONDITIONS.map((cond) => (
                      <SelectItem key={cond.value} value={cond.value}>
                        {cond.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Verzendmethode</Label>
                <Select 
                  value={bolFulfillment} 
                  onValueChange={(value) => handleFieldChange(setBolFulfillment, value as 'FBR' | 'FBB')}
                  disabled={isListed}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOL_FULFILLMENT.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  FBR = zelf verzenden, LVB = Bol.com verzorgt logistiek
                </p>
              </div>
            </div>

            <Separator />

            {/* AI Optimization */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">AI Content Optimalisatie</h4>
                  <p className="text-sm text-muted-foreground">
                    Laat AI je productcontent optimaliseren voor Bol.com
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleOptimizeBol}
                  disabled={isOptimizing}
                >
                  {isOptimizing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Optimaliseer met AI
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Geoptimaliseerde titel</Label>
                  <Input
                    value={bolOptimizedTitle}
                    onChange={(e) => handleFieldChange(setBolOptimizedTitle, e.target.value)}
                    placeholder="AI-geoptimaliseerde titel voor Bol.com"
                    maxLength={150}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {bolOptimizedTitle.length}/150 tekens
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Bullet points (max 5)</Label>
                  {[0, 1, 2, 3, 4].map((index) => (
                    <Input
                      key={index}
                      value={bolBullets[index] || ''}
                      onChange={(e) => {
                        const newBullets = [...bolBullets];
                        newBullets[index] = e.target.value;
                        handleFieldChange(setBolBullets, newBullets.filter((b, i) => b || i < index));
                      }}
                      placeholder={`Bullet point ${index + 1}`}
                      maxLength={150}
                    />
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {product.bol_last_synced_at && (
                  <span>
                    Laatst gesynchroniseerd:{' '}
                    {new Date(product.bol_last_synced_at).toLocaleString('nl-NL')}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {/* Save button */}
                {hasUnsavedChanges && (
                  <Button
                    variant="outline"
                    onClick={handleSaveSettings}
                    disabled={saveMarketplaceSettings.isPending}
                  >
                    {saveMarketplaceSettings.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Opslaan
                  </Button>
                )}
                
                {/* Sync button for listed products */}
                {isListed && (
                  <Button
                    variant="outline"
                    onClick={handleSyncBol}
                    disabled={updateBolOffer.isPending}
                  >
                    {updateBolOffer.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Synchroniseren
                  </Button>
                )}
                
                {/* Publish button for non-listed products */}
                {!isListed && !isPending && (
                  <Button
                    onClick={handlePublishToBol}
                    disabled={!eanValidation.isValid || createBolOffer.isPending}
                  >
                    {createBolOffer.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Publiceer naar Bol.com
                  </Button>
                )}

                {/* Check status button for pending */}
                {isPending && (
                  <Button
                    onClick={handleCheckStatus}
                    disabled={isCheckingStatus}
                  >
                    {isCheckingStatus ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Status controleren
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        )}

        {!hasBolConnection && (
          <CardContent>
            <div className="text-center py-6">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">
                Verbind eerst je Bol.com Retailer account om producten te kunnen publiceren
              </p>
              <Button variant="outline" asChild>
                <a href="/admin/connect">Naar Connect</a>
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Amazon Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Amazon</CardTitle>
                <CardDescription>
                  {hasAmazonConnection ? 'Verbonden' : 'Niet verbonden - Ga naar Connect om te koppelen'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(product.amazon_listing_status)}
              <Switch
                checked={amazonEnabled}
                onCheckedChange={(checked) => handleAmazonFieldChange(setAmazonEnabled, checked)}
                disabled={!hasAmazonConnection}
              />
            </div>
          </div>
        </CardHeader>

        {amazonEnabled && hasAmazonConnection && (
          <CardContent className="space-y-6">
            {/* Unsaved changes alert */}
            {hasAmazonUnsavedChanges && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Je hebt onopgeslagen wijzigingen</span>
                  <Button 
                    size="sm" 
                    onClick={handleSaveAmazonSettings}
                    disabled={saveMarketplaceSettings.isPending}
                  >
                    {saveMarketplaceSettings.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Opslaan
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Error message if any */}
            {hasAmazonError && product.amazon_listing_error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{product.amazon_listing_error}</AlertDescription>
              </Alert>
            )}

            {/* Pending status - show check button */}
            {isAmazonPending && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Je aanbieding wordt verwerkt door Amazon</span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={handleCheckAmazonStatus}
                    disabled={isCheckingAmazonStatus}
                  >
                    {isCheckingAmazonStatus ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    Status controleren
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* ASIN & Settings */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="amazon-asin">ASIN (optioneel)</Label>
                <div className="relative">
                  <Input
                    id="amazon-asin"
                    value={amazonAsin}
                    onChange={(e) => handleAmazonFieldChange(setAmazonAsin, e.target.value.toUpperCase())}
                    placeholder="B0XXXXXXXXX"
                    className={`pr-10 ${
                      amazonAsin 
                        ? asinValidation.isValid 
                          ? 'border-green-500 focus-visible:ring-green-500' 
                          : 'border-destructive focus-visible:ring-destructive'
                        : ''
                    }`}
                    disabled={isAmazonListed}
                    maxLength={10}
                  />
                  {amazonAsin && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {asinValidation.isValid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  )}
                </div>
                <p className={`text-xs ${amazonAsin && !asinValidation.isValid ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {amazonAsin ? asinValidation.message : 'Laat leeg voor nieuw product'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Conditie</Label>
                <Select 
                  value={amazonCondition} 
                  onValueChange={(value) => handleAmazonFieldChange(setAmazonCondition, value)}
                  disabled={isAmazonListed}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AMAZON_CONDITIONS.map((cond) => (
                      <SelectItem key={cond.value} value={cond.value}>
                        {cond.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Verzendmethode</Label>
                <Select 
                  value={amazonFulfillment} 
                  onValueChange={(value) => handleAmazonFieldChange(setAmazonFulfillment, value as 'MFN' | 'AFN')}
                  disabled={isAmazonListed}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AMAZON_FULFILLMENT.map((ful) => (
                      <SelectItem key={ful.value} value={ful.value}>
                        {ful.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* AI Optimization */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">AI Content Optimalisatie</h4>
                  <p className="text-sm text-muted-foreground">
                    Laat AI je productcontent optimaliseren voor Amazon
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleOptimizeAmazon}
                  disabled={isOptimizing}
                >
                  {isOptimizing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Optimaliseer met AI
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Geoptimaliseerde titel</Label>
                  <Input
                    value={amazonOptimizedTitle}
                    onChange={(e) => handleAmazonFieldChange(setAmazonOptimizedTitle, e.target.value)}
                    placeholder="AI-geoptimaliseerde titel voor Amazon"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {amazonOptimizedTitle.length}/200 tekens
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Bullet points (max 5)</Label>
                  {[0, 1, 2, 3, 4].map((index) => (
                    <Input
                      key={index}
                      value={amazonBullets[index] || ''}
                      onChange={(e) => {
                        const newBullets = [...amazonBullets];
                        newBullets[index] = e.target.value;
                        handleAmazonFieldChange(setAmazonBullets, newBullets.filter((b, i) => b || i < index));
                      }}
                      placeholder={`Bullet point ${index + 1}`}
                      maxLength={500}
                    />
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Productomschrijving</Label>
                  <Textarea
                    value={amazonOptimizedDescription}
                    onChange={(e) => handleAmazonFieldChange(setAmazonOptimizedDescription, e.target.value)}
                    placeholder="Uitgebreide productomschrijving voor Amazon..."
                    rows={4}
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {amazonOptimizedDescription.length}/2000 tekens
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {product.amazon_last_synced_at && (
                  <span>
                    Laatst gesynchroniseerd:{' '}
                    {new Date(product.amazon_last_synced_at).toLocaleString('nl-NL')}
                  </span>
                )}
                {product.amazon_asin && (
                  <span className="ml-3">
                    ASIN: <code className="bg-muted px-1 py-0.5 rounded text-xs">{product.amazon_asin}</code>
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {/* Save button */}
                {hasAmazonUnsavedChanges && (
                  <Button
                    variant="outline"
                    onClick={handleSaveAmazonSettings}
                    disabled={saveMarketplaceSettings.isPending}
                  >
                    {saveMarketplaceSettings.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Opslaan
                  </Button>
                )}
                
                {/* Sync button for listed products */}
                {isAmazonListed && (
                  <Button
                    variant="outline"
                    onClick={handleSyncAmazon}
                    disabled={updateAmazonOffer.isPending}
                  >
                    {updateAmazonOffer.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Synchroniseren
                  </Button>
                )}
                
                {/* Publish button for non-listed products */}
                {!isAmazonListed && !isAmazonPending && (
                  <Button
                    onClick={handlePublishToAmazon}
                    disabled={createAmazonOffer.isPending}
                  >
                    {createAmazonOffer.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Publiceer naar Amazon
                  </Button>
                )}

                {/* Check status button for pending */}
                {isAmazonPending && (
                  <Button
                    onClick={handleCheckAmazonStatus}
                    disabled={isCheckingAmazonStatus}
                  >
                    {isCheckingAmazonStatus ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Status controleren
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        )}

        {!hasAmazonConnection && (
          <CardContent>
            <div className="text-center py-6">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">
                Verbind eerst je Amazon Seller Central account om producten te kunnen publiceren
              </p>
              <Button variant="outline" asChild>
                <a href="/admin/connect">Naar Connect</a>
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Shopify Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Store className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Shopify</CardTitle>
                <CardDescription>
                  {hasShopifyConnection ? 'Verbonden' : 'Niet verbonden - Ga naar Connect om te koppelen'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(product.shopify_listing_status)}
              <Switch
                checked={shopifyEnabled}
                onCheckedChange={(checked) => handleShopifyFieldChange(setShopifyEnabled, checked)}
                disabled={!hasShopifyConnection}
              />
            </div>
          </div>
        </CardHeader>

        {shopifyEnabled && hasShopifyConnection && (
          <CardContent className="space-y-6">
            {/* Unsaved changes alert */}
            {hasShopifyUnsavedChanges && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Je hebt onopgeslagen wijzigingen</span>
                  <Button 
                    size="sm" 
                    onClick={handleSaveShopifySettings}
                    disabled={saveMarketplaceSettings.isPending}
                  >
                    {saveMarketplaceSettings.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Opslaan
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Error message if any */}
            {hasShopifyError && product.shopify_listing_error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{product.shopify_listing_error}</AlertDescription>
              </Alert>
            )}

            {/* Pending status */}
            {isShopifyPending && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Je product wordt verwerkt door Shopify...
                </AlertDescription>
              </Alert>
            )}

            {/* AI Optimization */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">AI Content Optimalisatie</h4>
                  <p className="text-sm text-muted-foreground">
                    Laat AI je productcontent optimaliseren voor Shopify SEO
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleOptimizeShopify}
                  disabled={isOptimizing}
                >
                  {isOptimizing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Optimaliseer met AI
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>SEO-geoptimaliseerde titel</Label>
                  <Input
                    value={shopifyOptimizedTitle}
                    onChange={(e) => handleShopifyFieldChange(setShopifyOptimizedTitle, e.target.value)}
                    placeholder="AI-geoptimaliseerde titel voor Shopify"
                    maxLength={255}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {shopifyOptimizedTitle.length}/255 tekens
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>SEO-geoptimaliseerde beschrijving</Label>
                  <Textarea
                    value={shopifyOptimizedDescription}
                    onChange={(e) => handleShopifyFieldChange(setShopifyOptimizedDescription, e.target.value)}
                    placeholder="Uitgebreide productomschrijving voor Shopify..."
                    rows={4}
                    maxLength={5000}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {shopifyOptimizedDescription.length}/5000 tekens
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {product.shopify_last_synced_at && (
                  <span>
                    Laatst gesynchroniseerd:{' '}
                    {new Date(product.shopify_last_synced_at).toLocaleString('nl-NL')}
                  </span>
                )}
                {product.shopify_product_id && (
                  <span className="ml-3">
                    Product ID: <code className="bg-muted px-1 py-0.5 rounded text-xs">{product.shopify_product_id}</code>
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {/* Save button */}
                {hasShopifyUnsavedChanges && (
                  <Button
                    variant="outline"
                    onClick={handleSaveShopifySettings}
                    disabled={saveMarketplaceSettings.isPending}
                  >
                    {saveMarketplaceSettings.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Opslaan
                  </Button>
                )}
                
                {/* Sync button for listed products */}
                {isShopifyListed && (
                  <Button
                    variant="outline"
                    onClick={handleSyncShopify}
                    disabled={isSyncingShopify}
                  >
                    {isSyncingShopify ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Synchroniseren
                  </Button>
                )}
                
                {/* Publish button for non-listed products */}
                {!isShopifyListed && !isShopifyPending && (
                  <Button
                    onClick={handlePublishToShopify}
                    disabled={isPublishingShopify}
                  >
                    {isPublishingShopify ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Publiceer naar Shopify
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        )}

        {!hasShopifyConnection && (
          <CardContent>
            <div className="text-center py-6">
              <Store className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-4">
                Verbind eerst je Shopify winkel om producten te kunnen publiceren
              </p>
              <Button variant="outline" asChild>
                <a href="/admin/connect">Naar Connect</a>
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
