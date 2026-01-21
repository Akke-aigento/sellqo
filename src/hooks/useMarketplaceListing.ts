import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';
import { useMarketplaceConnections } from './useMarketplaceConnections';
import type { Product } from '@/types/product';

export interface OptimizedContent {
  title: string;
  bullets: string[];
  description: string;
  category_suggestion?: string;
  keywords: string[];
}

export interface BolOfferData {
  ean: string;
  condition: 'NEW' | 'AS_NEW' | 'GOOD' | 'REASONABLE' | 'MODERATE';
  price: number;
  stock: number;
  delivery_code: string;
  fulfilment_method: 'FBR' | 'FBB';
  title?: string;
}

export interface AmazonOfferData {
  asin?: string;
  sku: string;
  price: number;
  quantity: number;
  condition: 'new' | 'used_like_new' | 'used_very_good' | 'used_good' | 'used_acceptable';
  fulfilment_channel: 'MFN' | 'AFN';
  title?: string;
  bullets?: string[];
  description?: string;
}

export interface MarketplaceSettings {
  bol_ean?: string;
  bol_delivery_code?: string;
  bol_condition?: string;
  bol_fulfilment_method?: 'FBR' | 'FBB';
  bol_optimized_title?: string;
  bol_bullets?: string[];
  amazon_asin?: string;
  amazon_optimized_title?: string;
  amazon_optimized_description?: string;
  amazon_bullets?: string[];
  // Shopify fields
  shopify_optimized_title?: string;
  shopify_optimized_description?: string;
}

export function useMarketplaceListing() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getConnectionByType } = useMarketplaceConnections();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isCheckingAmazonStatus, setIsCheckingAmazonStatus] = useState(false);

  const optimizeContent = async (product: Product, marketplace: 'bol_com' | 'amazon' | 'shopify'): Promise<OptimizedContent | null> => {
    if (!currentTenant) return null;

    setIsOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-optimize-marketplace-content', {
        body: {
          product: {
            id: product.id,
            name: product.name,
            description: product.description,
            short_description: product.short_description,
            price: product.price,
            sku: product.sku,
            barcode: product.barcode,
            category_name: product.category?.name,
            tags: product.tags,
          },
          marketplace,
          language: 'nl',
        },
      });

      if (error) throw error;
      return data.optimized;
    } catch (error) {
      console.error('Error optimizing content:', error);
      toast({
        title: 'Optimalisatie mislukt',
        description: 'Kon de content niet optimaliseren met AI',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsOptimizing(false);
    }
  };

  const saveOptimizedContent = useMutation({
    mutationFn: async ({ 
      productId, 
      marketplace, 
      content 
    }: { 
      productId: string; 
      marketplace: 'bol_com' | 'amazon' | 'shopify'; 
      content: OptimizedContent;
    }) => {
      let updateData: Record<string, unknown>;
      
      if (marketplace === 'bol_com') {
        updateData = {
          bol_optimized_title: content.title,
          bol_optimized_description: content.description,
          bol_bullets: content.bullets,
        };
      } else if (marketplace === 'amazon') {
        updateData = {
          amazon_optimized_title: content.title,
          amazon_optimized_description: content.description,
          amazon_bullets: content.bullets,
        };
      } else {
        updateData = {
          shopify_optimized_title: content.title,
          shopify_optimized_description: content.description,
        };
      }

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast({ title: 'Content opgeslagen' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  // Save marketplace settings (EAN, delivery code, condition, etc.)
  const saveMarketplaceSettings = useMutation({
    mutationFn: async ({
      productId,
      settings,
    }: {
      productId: string;
      settings: MarketplaceSettings;
    }) => {
      const { error } = await supabase
        .from('products')
        .update(settings)
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast({
        title: 'Instellingen opgeslagen',
        description: 'Marketplace instellingen zijn bijgewerkt',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Opslaan mislukt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createBolOffer = useMutation({
    mutationFn: async ({ 
      product, 
      offerData 
    }: { 
      product: Product; 
      offerData: BolOfferData;
    }) => {
      if (!currentTenant) throw new Error('Geen tenant geselecteerd');

      const connection = getConnectionByType('bol_com');
      if (!connection) throw new Error('Geen Bol.com connectie gevonden');

      // Validate EAN
      if (!offerData.ean || offerData.ean.length < 8) {
        throw new Error('Vul een geldige EAN code in (minimaal 8 cijfers)');
      }

      // Validate stock
      if (offerData.stock < 0) {
        throw new Error('Voorraad kan niet negatief zijn');
      }

      // Validate price
      if (offerData.price <= 0) {
        throw new Error('Prijs moet groter dan 0 zijn');
      }

      const { data, error } = await supabase.functions.invoke('create-bol-offer', {
        body: {
          product_id: product.id,
          tenant_id: currentTenant.id,
          connection_id: connection.id,
          offer_data: offerData,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Bol.com API fout');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast({ 
        title: 'Publicatie gestart', 
        description: 'Je product wordt naar Bol.com verzonden. Controleer de status over enkele minuten.' 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Publicatie mislukt', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const updateBolOffer = useMutation({
    mutationFn: async ({ 
      product, 
      updateType, 
      updateData 
    }: { 
      product: Product; 
      updateType: 'price' | 'stock' | 'fulfilment' | 'all';
      updateData: {
        price?: number;
        stock?: number;
        delivery_code?: string;
        on_hold?: boolean;
      };
    }) => {
      if (!currentTenant) throw new Error('Geen tenant geselecteerd');
      if (!product.bol_offer_id) throw new Error('Product heeft geen Bol.com offer ID');

      const connection = getConnectionByType('bol_com');
      if (!connection) throw new Error('Geen Bol.com connectie gevonden');

      const { data, error } = await supabase.functions.invoke('update-bol-offer', {
        body: {
          product_id: product.id,
          tenant_id: currentTenant.id,
          connection_id: connection.id,
          offer_id: product.bol_offer_id,
          update_type: updateType,
          update_data: updateData,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Bol.com update fout');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast({ title: 'Synchronisatie gestart', description: 'Je wijzigingen worden naar Bol.com verzonden' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Synchronisatie mislukt', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Check Bol.com process status
  const checkBolProcessStatus = async (product: Product): Promise<{
    success: boolean;
    status?: string;
    listing_status?: string;
    offer_id?: string;
    error_message?: string;
  }> => {
    if (!currentTenant) {
      toast({
        title: 'Fout',
        description: 'Geen tenant gevonden',
        variant: 'destructive',
      });
      return { success: false };
    }

    const connection = getConnectionByType('bol_com');
    if (!connection) {
      toast({
        title: 'Fout',
        description: 'Geen Bol.com verbinding gevonden',
        variant: 'destructive',
      });
      return { success: false };
    }

    // The bol_offer_id initially contains the process status ID
    if (!product.bol_offer_id) {
      toast({
        title: 'Fout',
        description: 'Geen process status ID gevonden',
        variant: 'destructive',
      });
      return { success: false };
    }

    setIsCheckingStatus(true);

    try {
      const { data, error } = await supabase.functions.invoke('check-bol-process-status', {
        body: {
          product_id: product.id,
          tenant_id: currentTenant.id,
          connection_id: connection.id,
          process_status_id: product.bol_offer_id,
        },
      });

      if (error) throw error;

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });

      if (data.success) {
        if (data.listing_status === 'listed') {
          toast({
            title: 'Product gepubliceerd!',
            description: 'Je product is succesvol gepubliceerd op Bol.com',
          });
        } else if (data.listing_status === 'error') {
          toast({
            title: 'Publicatie mislukt',
            description: data.error_message || 'Er is een fout opgetreden bij Bol.com',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Nog in verwerking',
            description: 'Bol.com verwerkt je aanbieding nog. Probeer het later opnieuw.',
          });
        }
      }

      return data;
    } catch (error) {
      console.error('Check process status error:', error);
      toast({
        title: 'Status controle mislukt',
        description: error instanceof Error ? error.message : 'Kon de status niet ophalen',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Amazon mutations
  const createAmazonOffer = useMutation({
    mutationFn: async ({ 
      product, 
      offerData 
    }: { 
      product: Product; 
      offerData: AmazonOfferData;
    }) => {
      if (!currentTenant) throw new Error('Geen tenant geselecteerd');

      const connection = getConnectionByType('amazon');
      if (!connection) throw new Error('Geen Amazon connectie gevonden');

      // Validate price
      if (offerData.price <= 0) {
        throw new Error('Prijs moet groter dan 0 zijn');
      }

      const { data, error } = await supabase.functions.invoke('create-amazon-offer', {
        body: {
          product_id: product.id,
          tenant_id: currentTenant.id,
          connection_id: connection.id,
          offer_data: offerData,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Amazon API fout');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast({ 
        title: 'Publicatie gestart', 
        description: 'Je product wordt naar Amazon verzonden. Controleer de status over enkele minuten.' 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Publicatie mislukt', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const updateAmazonOffer = useMutation({
    mutationFn: async ({ 
      product, 
      updateType, 
      updateData 
    }: { 
      product: Product; 
      updateType: 'price' | 'quantity' | 'all';
      updateData: {
        price?: number;
        quantity?: number;
      };
    }) => {
      if (!currentTenant) throw new Error('Geen tenant geselecteerd');
      if (!product.amazon_offer_id) throw new Error('Product heeft geen Amazon SKU');

      const connection = getConnectionByType('amazon');
      if (!connection) throw new Error('Geen Amazon connectie gevonden');

      const { data, error } = await supabase.functions.invoke('update-amazon-offer', {
        body: {
          product_id: product.id,
          tenant_id: currentTenant.id,
          connection_id: connection.id,
          sku: product.amazon_offer_id,
          update_type: updateType,
          update_data: updateData,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Amazon update fout');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast({ title: 'Synchronisatie gestart', description: 'Je wijzigingen worden naar Amazon verzonden' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Synchronisatie mislukt', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Check Amazon listing status
  const checkAmazonListingStatus = async (product: Product): Promise<{
    success: boolean;
    listing_status?: string;
    asin?: string;
    error_message?: string;
    issues?: string[];
  }> => {
    if (!currentTenant) {
      toast({
        title: 'Fout',
        description: 'Geen tenant gevonden',
        variant: 'destructive',
      });
      return { success: false };
    }

    const connection = getConnectionByType('amazon');
    if (!connection) {
      toast({
        title: 'Fout',
        description: 'Geen Amazon verbinding gevonden',
        variant: 'destructive',
      });
      return { success: false };
    }

    // The amazon_offer_id contains the SKU
    if (!product.amazon_offer_id) {
      toast({
        title: 'Fout',
        description: 'Geen Amazon SKU gevonden',
        variant: 'destructive',
      });
      return { success: false };
    }

    setIsCheckingAmazonStatus(true);

    try {
      const { data, error } = await supabase.functions.invoke('check-amazon-listing-status', {
        body: {
          product_id: product.id,
          tenant_id: currentTenant.id,
          connection_id: connection.id,
          sku: product.amazon_offer_id,
        },
      });

      if (error) throw error;

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });

      if (data.success) {
        if (data.listing_status === 'listed') {
          toast({
            title: 'Product actief!',
            description: `Je product is actief op Amazon${data.asin ? ` (ASIN: ${data.asin})` : ''}`,
          });
        } else if (data.listing_status === 'error') {
          toast({
            title: 'Publicatie probleem',
            description: data.error_message || 'Er is een fout opgetreden bij Amazon',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Nog in verwerking',
            description: 'Amazon verwerkt je aanbieding nog. Probeer het later opnieuw.',
          });
        }
      }

      return data;
    } catch (error) {
      console.error('Check Amazon listing status error:', error);
      toast({
        title: 'Status controle mislukt',
        description: error instanceof Error ? error.message : 'Kon de status niet ophalen',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsCheckingAmazonStatus(false);
    }
  };

  return {
    // AI Optimization
    optimizeContent,
    isOptimizing,
    saveOptimizedContent,
    
    // Settings
    saveMarketplaceSettings,
    
    // Bol.com offers
    createBolOffer,
    updateBolOffer,
    
    // Amazon offers
    createAmazonOffer,
    updateAmazonOffer,
    
    // Status checking
    checkBolProcessStatus,
    isCheckingStatus,
    checkAmazonListingStatus,
    isCheckingAmazonStatus,
  };
}
