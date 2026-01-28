import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAuthedClient } from '@/integrations/supabase/authedClient';
import { restInsertSingle } from '@/integrations/supabase/authedRest';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export interface OnboardingData {
  // Step 1: Welcome
  shopName: string;
  shopSlug: string;
  // Step 2: Plan Selection (NEW)
  selectedPlanId: string;
  // Step 3: Business Details
  businessName: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  vatNumber: string;
  chamberOfCommerce: string;
  // Step 4: Logo
  logoUrl: string | null;
  // Step 5: First Product
  productName: string;
  productPrice: number;
  productDescription: string;
  productImageUrl: string | null;
  // Step 6: Payments
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
  sessionExpired: boolean;
}

const TOTAL_STEPS = 7;

const initialData: OnboardingData = {
  shopName: '',
  shopSlug: '',
  selectedPlanId: 'free', // Default to free trial
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
  const { user, ensureAuthenticated, getVerifiedAccessToken, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentTenant, tenants, loading: tenantsLoading, setCurrentTenant, refreshTenants } = useTenant();
  
  const [state, setState] = useState<OnboardingState>({
    currentStep: 1,
    totalSteps: TOTAL_STEPS,
    isOpen: false,
    isLoading: true,
    data: initialData,
    createdTenantId: null,
    createdProductId: null,
    sessionExpired: false,
  });
  
  // Track if user had partial progress when loading
  const [hasPartialProgress, setHasPartialProgress] = useState(false);

  // Check if user needs onboarding
  const checkOnboardingStatus = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
      return;
    }

    // Wait for tenants to load before making onboarding decision
    if (tenantsLoading) {
      return;
    }

    // If user already has access to tenants, skip onboarding entirely
    if (tenants && tenants.length > 0) {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);
      setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
      return;
    }

    try {
      // Fetch profile to check onboarding status
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step, onboarding_skipped_at, email, created_at')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Check if this is a brand new user (created within last 5 minutes)
      const isNewUser = profile?.created_at && 
        (Date.now() - new Date(profile.created_at).getTime()) < 5 * 60 * 1000;

      // Skip if already completed or skipped (unless brand new user who skipped quickly)
      if (profile?.onboarding_completed) {
        setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
        return;
      }

      // If skipped, only re-show for truly new users
      if (profile?.onboarding_skipped_at && !isNewUser) {
        setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
        return;
      }

      // Note: Users with existing tenants are already filtered out at the top of this function

      // Show onboarding for new users or users who haven't completed setup
      const savedStep = profile?.onboarding_step || 1;
      
      // Force step 1 for brand new users
      const startStep = isNewUser ? 1 : savedStep;
      
      // Track if returning user has partial progress (not brand new, step > 1)
      const partialProgress = !isNewUser && savedStep > 1;
      setHasPartialProgress(partialProgress);
      
      setState(prev => ({
        ...prev,
        currentStep: startStep,
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
  }, [user, tenants, currentTenant, tenantsLoading]);

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

    // CRITICAL: Verify session is valid BEFORE attempting database write
    console.log('[Onboarding] createTenant: verifying session...');
    const isAuthenticated = await ensureAuthenticated();
    
    if (!isAuthenticated) {
      console.error('[Onboarding] createTenant: session invalid, showing recovery dialog');
      setState(prev => ({ ...prev, sessionExpired: true }));
      throw new Error('SESSION_EXPIRED');
    }

    // CRITICAL: owner_email MUST be the login email for RLS to pass
    const loginEmail = user.email;
    if (!loginEmail) {
      throw new Error('Je login e-mailadres ontbreekt. Log opnieuw in en probeer het nog eens.');
    }

    const { shopName, shopSlug, businessName, email, address, postalCode, city, country, vatNumber, chamberOfCommerce } = state.data;

    // ============================================
    // CRITICAL FIX: Get verified token and use explicit auth client
    // This ensures the Authorization header is ALWAYS present on the request
    // ============================================
    console.log('[Onboarding] createTenant: getting verified access token with force refresh...');
    const accessToken = await getVerifiedAccessToken({ forceRefresh: true });
    
    if (!accessToken) {
      console.error('[Onboarding] createTenant: could not get verified token, showing recovery dialog');
      setState(prev => ({ ...prev, sessionExpired: true }));
      throw new Error('SESSION_EXPIRED');
    }
    
    console.log('[Onboarding] createTenant: token obtained, creating authed client');
    const authedDb = getAuthedClient(accessToken);

    // Quick sanity check: this MUST succeed if Authorization header is applied.
    // If this returns 0 rows / errors, we know the request is effectively unauthenticated.
    try {
      const { data: profileCheck, error: profileCheckError } = await authedDb
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
      console.log('[Onboarding] createTenant: authed profile check ok:', !!profileCheck, profileCheckError?.code);
    } catch (e) {
      console.warn('[Onboarding] createTenant: authed profile check threw', e);
    }

    const attemptCreate = async () => {
      // First check if tenant already exists (using authed client)
      console.log('[Onboarding] createTenant: checking for existing tenant...');
      const { data: existingCheck } = await authedDb
        .from('tenants')
        .select('id, name')
        .eq('owner_email', loginEmail)
        .limit(1);
      
      if (existingCheck && existingCheck.length > 0) {
        console.log('[Onboarding] createTenant: existing tenant found, using it');
        return { tenant: existingCheck[0], tenantError: null, wasExisting: true };
      }

      // owner_email = login email (for RLS security check)
      // billing_email = form email (for invoices/communication)
      const payload = {
        name: shopName,
        slug: shopSlug,
        owner_email: loginEmail, // Always use login email for RLS
        owner_name: businessName || shopName,
        address: address || null,
        postal_code: postalCode || null,
        city: city || null,
        country: country || null,
        btw_number: vatNumber || null,
        kvk_number: chamberOfCommerce || null,
        billing_email: email || loginEmail,
        billing_company_name: businessName || null,
      };

      console.log('[Onboarding] createTenant: inserting new tenant with explicit auth...');
      const { data: tenant, error: tenantError } = await authedDb
        .from('tenants')
        .insert(payload)
        .select()
        .single();

      // If we still get an RLS error here, try a raw REST fallback with explicit Authorization header.
      if (tenantError && (tenantError.code === '42501' || tenantError.message?.includes('row-level security'))) {
        console.warn('[Onboarding] createTenant: RLS error via supabase-js, trying REST fallback...');
        const restTenant = await restInsertSingle<any>('tenants', accessToken, payload);
        console.log('[Onboarding] createTenant: REST fallback succeeded:', restTenant?.id);
        return { tenant: restTenant, tenantError: null, wasExisting: false };
      }

      return { tenant, tenantError, wasExisting: false };
    };

    try {
      const { tenant, tenantError, wasExisting } = await attemptCreate();

      // ============================================
      // SUCCESS PATH - return immediately, no extra checks
      // ============================================
      if (tenant && !tenantError) {
        console.log('[Onboarding] Tenant ' + (wasExisting ? 'found' : 'created') + ' successfully:', tenant.id);
        
        if (wasExisting) {
          toast({
            title: 'Bestaande winkel gevonden',
            description: `Je bent gekoppeld aan ${tenant.name}.`,
          });
        }
        
        // Non-critical follow-up calls - wrapped in try/catch
        try {
          await refreshTenants();
          setCurrentTenant(tenant as any);
        } catch (refreshError) {
          console.warn('[Onboarding] refreshTenants failed but tenant exists:', refreshError);
          // Continue anyway - tenant is created
        }

        setState(prev => ({ ...prev, createdTenantId: tenant.id }));

        // Update subscription with selected plan if not free
        if (state.data.selectedPlanId && state.data.selectedPlanId !== 'free') {
          try {
            await supabase
              .from('tenant_subscriptions')
              .update({ plan_id: state.data.selectedPlanId })
              .eq('tenant_id', tenant.id);
          } catch (subError) {
            console.warn('[Onboarding] Subscription update failed:', subError);
          }
        }

        return tenant;
      }

      // ============================================
      // ERROR PATH - this should be rare now with explicit auth
      // ============================================
      if (tenantError) {
        console.error('[Onboarding] Tenant creation error (with explicit auth!):', tenantError.code, tenantError.message);
        
        // If RLS error even with explicit auth, this is a genuine issue
        if (tenantError.code === '42501' || tenantError.message?.includes('row-level security')) {
          console.error('[Onboarding] RLS error despite explicit token - checking if session is truly valid...');
          
          // Double-check: can we actually verify the user?
          const stillAuthenticated = await ensureAuthenticated();
          if (!stillAuthenticated) {
            console.error('[Onboarding] Session confirmed invalid after all');
            setState(prev => ({ ...prev, sessionExpired: true }));
            throw new Error('SESSION_EXPIRED');
          }
          
          // Session is valid but RLS still failing - this is a genuine RLS config issue
          console.error('[Onboarding] RLS error with verified session - genuine policy issue');
        }
        
        // Throw the original error for proper handling
        throw tenantError;
      }

      // Should not reach here
      throw new Error('Tenant creation returned no data');
      
    } catch (error: any) {
      console.error('[Onboarding] Error creating tenant:', error);
      
      // Don't re-throw SESSION_EXPIRED - it's handled by the dialog
      if (error.message === 'SESSION_EXPIRED') {
        return null;
      }
      
      throw error;
    }
  }, [user, state.data, ensureAuthenticated, getVerifiedAccessToken, refreshTenants, setCurrentTenant, toast]);

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

  // Function to clear partial progress flag (after user makes choice)
  const clearPartialProgress = useCallback(() => {
    setHasPartialProgress(false);
  }, []);

  // Handle session expired - force sign out and redirect to login
  const handleSessionExpiredRelogin = useCallback(async () => {
    console.log('[Onboarding] Session expired - signing out and redirecting to login');
    setState(prev => ({ ...prev, sessionExpired: false, isOpen: false }));
    await signOut();
    navigate('/auth');
  }, [signOut, navigate]);

  // Clear session expired state (if user somehow recovers)
  const clearSessionExpired = useCallback(() => {
    setState(prev => ({ ...prev, sessionExpired: false }));
  }, []);

  return {
    ...state,
    hasPartialProgress,
    clearPartialProgress,
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
    handleSessionExpiredRelogin,
    clearSessionExpired,
  };
}
