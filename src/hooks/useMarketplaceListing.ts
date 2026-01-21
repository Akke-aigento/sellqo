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

export function useMarketplaceListing() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getConnectionByType } = useMarketplaceConnections();
  const [isOptimizing, setIsOptimizing] = useState(false);

  const optimizeContent = async (product: Product, marketplace: 'bol_com' | 'amazon'): Promise<OptimizedContent | null> => {
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
      marketplace: 'bol_com' | 'amazon'; 
      content: OptimizedContent;
    }) => {
      const updateData = marketplace === 'bol_com' 
        ? {
            bol_optimized_title: content.title,
            bol_optimized_description: content.description,
            bol_bullets: content.bullets,
          }
        : {
            amazon_optimized_title: content.title,
            amazon_optimized_description: content.description,
            amazon_bullets: content.bullets,
          };

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Content opgeslagen' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
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

      const { data, error } = await supabase.functions.invoke('create-bol-offer', {
        body: {
          product_id: product.id,
          tenant_id: currentTenant.id,
          connection_id: connection.id,
          offer_data: offerData,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ 
        title: 'Aanbod aangemaakt', 
        description: 'Het product wordt verwerkt door Bol.com' 
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Aanbod bijgewerkt' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Update mislukt', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  return {
    optimizeContent,
    isOptimizing,
    saveOptimizedContent,
    createBolOffer,
    updateBolOffer,
  };
}
