import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

export interface OnboardingData {
  // Step 1: Welcome
  shopName: string;
  shopSlug: string;
  // Step 2: Business Details
  businessName: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  vatNumber: string;
  chamberOfCommerce: string;
  // Step 3: Logo
  logoUrl: string | null;
  // Step 4: First Product
  productName: string;
  productPrice: number;
  productDescription: string;
  productImageUrl: string | null;
  // Step 5: Payments
  stripeConnected: boolean;
}

interface OnboardingState {
  currentStep: number;
  totalSteps: number;
  isOpen: boolean;
  isLoading: boolean;
  data: OnboardingData;
  createdTenantId: string | null;
  createdProductId: string | null;
}

const TOTAL_STEPS = 6;

const initialData: OnboardingData = {
  shopName: '',
  shopSlug: '',
  businessName: '',
  email: '',
  address: '',
  postalCode: '',
  city: '',
  country: 'NL',
  vatNumber: '',
  chamberOfCommerce: '',
  logoUrl: null,
  productName: '',
  productPrice: 0,
  productDescription: '',
  productImageUrl: null,
  stripeConnected: false,
};

export function useOnboarding() {
  const { user } = useAuth();
  const { currentTenant, tenants, setCurrentTenant, refreshTenants } = useTenant();
  
  const [state, setState] = useState<OnboardingState>({
    currentStep: 1,
    totalSteps: TOTAL_STEPS,
    isOpen: false,
    isLoading: true,
    data: initialData,
    createdTenantId: null,
    createdProductId: null,
  });

  // Check if user needs onboarding
  const checkOnboardingStatus = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
      return;
    }

    try {
      // Fetch profile to check onboarding status
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step, onboarding_skipped_at, email')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Skip if already completed or skipped
      if (profile?.onboarding_completed || profile?.onboarding_skipped_at) {
        setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
        return;
      }

      // Check if user has any tenants with products
      const hasTenants = tenants && tenants.length > 0;
      
      if (hasTenants && currentTenant) {
        // Check if tenant has products
        const { data: products } = await supabase
          .from('products')
          .select('id')
          .eq('tenant_id', currentTenant.id)
          .limit(1);

        // If they have products, mark onboarding as complete
        if (products && products.length > 0) {
          await supabase
            .from('profiles')
            .update({ onboarding_completed: true })
            .eq('id', user.id);
          
          setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
          return;
        }
      }

      // Show onboarding for new users
      const savedStep = profile?.onboarding_step || 1;
      
      setState(prev => ({
        ...prev,
        currentStep: savedStep,
        isOpen: true,
        isLoading: false,
        data: {
          ...prev.data,
          email: profile?.email || user.email || '',
        },
      }));
    } catch (err) {
      console.error('Onboarding check error:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user, tenants, currentTenant]);

  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  // Update data
  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setState(prev => ({
      ...prev,
      data: { ...prev.data, ...updates },
    }));
  }, []);

  // Go to next step
  const nextStep = useCallback(async () => {
    const newStep = Math.min(state.currentStep + 1, TOTAL_STEPS);
    
    // Save progress to database
    if (user) {
      await supabase
        .from('profiles')
        .update({ onboarding_step: newStep })
        .eq('id', user.id);
    }

    setState(prev => ({ ...prev, currentStep: newStep }));
  }, [state.currentStep, user]);

  // Go to previous step
  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1),
    }));
  }, []);

  // Go to specific step
  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setState(prev => ({ ...prev, currentStep: step }));
    }
  }, []);

  // Skip onboarding
  const skipOnboarding = useCallback(async () => {
    if (user) {
      await supabase
        .from('profiles')
        .update({ onboarding_skipped_at: new Date().toISOString() })
        .eq('id', user.id);
    }
    
    setState(prev => ({ ...prev, isOpen: false }));
  }, [user]);

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    if (user) {
      await supabase
        .from('profiles')
        .update({ 
          onboarding_completed: true,
          onboarding_step: TOTAL_STEPS,
        })
        .eq('id', user.id);
    }
    
    setState(prev => ({ ...prev, isOpen: false }));
  }, [user]);

  // Restart onboarding from step 1
  const restartOnboarding = useCallback(async () => {
    if (user) {
      await supabase
        .from('profiles')
        .update({ 
          onboarding_completed: false,
          onboarding_step: 1,
          onboarding_skipped_at: null,
        })
        .eq('id', user.id);
    }
    
    setState(prev => ({ 
      ...prev, 
      currentStep: 1, 
      isOpen: true,
      data: initialData,
    }));
  }, [user]);

  // Resume onboarding from where you left off
  const resumeOnboarding = useCallback(async () => {
    if (user) {
      await supabase
        .from('profiles')
        .update({ onboarding_skipped_at: null })
        .eq('id', user.id);
    }
    
    setState(prev => ({ ...prev, isOpen: true }));
  }, [user]);

  // Create tenant (Step 1 completion)
  const createTenant = useCallback(async () => {
    if (!user) return null;

    const { shopName, shopSlug, businessName, email, address, postalCode, city, country, vatNumber, chamberOfCommerce } = state.data;

    try {
      // Create the tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: shopName,
          slug: shopSlug,
          owner_email: email || user.email || '',
          owner_name: businessName || shopName,
          address: address || null,
          postal_code: postalCode || null,
          city: city || null,
          country: country || null,
          btw_number: vatNumber || null,
          kvk_number: chamberOfCommerce || null,
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      // Create user role for this tenant
      await supabase.from('user_roles').insert({
        user_id: user.id,
        tenant_id: tenant.id,
        role: 'tenant_admin',
      });

      // Refresh tenants and set as current
      await refreshTenants();
      setCurrentTenant(tenant);

      setState(prev => ({ ...prev, createdTenantId: tenant.id }));
      
      return tenant;
    } catch (error) {
      console.error('Error creating tenant:', error);
      throw error;
    }
  }, [user, state.data, refreshTenants, setCurrentTenant]);

  // Update tenant with logo
  const updateTenantLogo = useCallback(async (logoUrl: string) => {
    const tenantId = state.createdTenantId || currentTenant?.id;
    if (!tenantId) return;

    await supabase
      .from('tenants')
      .update({ logo_url: logoUrl })
      .eq('id', tenantId);

    updateData({ logoUrl });
  }, [state.createdTenantId, currentTenant?.id, updateData]);

  // Create first product (Step 4 completion)
  const createFirstProduct = useCallback(async () => {
    const tenantId = state.createdTenantId || currentTenant?.id;
    if (!tenantId) return null;

    const { productName, productPrice, productDescription, productImageUrl } = state.data;

    try {
      const slug = productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { data: product, error } = await supabase
        .from('products')
        .insert({
          tenant_id: tenantId,
          name: productName,
          slug: slug,
          price: productPrice,
          description: productDescription || null,
          image_url: productImageUrl || null,
          is_active: true,
          track_inventory: false,
          stock: 999,
        })
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({ ...prev, createdProductId: product.id }));
      return product;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }, [state.createdTenantId, currentTenant?.id, state.data]);

  // Generate slug from name
  const generateSlug = useCallback((name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }, []);

  // Check if slug is available
  const checkSlugAvailable = useCallback(async (slug: string): Promise<boolean> => {
    const { data } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .limit(1);
    
    return !data || data.length === 0;
  }, []);

  return {
    ...state,
    updateData,
    nextStep,
    prevStep,
    goToStep,
    skipOnboarding,
    completeOnboarding,
    restartOnboarding,
    resumeOnboarding,
    createTenant,
    updateTenantLogo,
    createFirstProduct,
    generateSlug,
    checkSlugAvailable,
    refreshOnboarding: checkOnboardingStatus,
  };
}
