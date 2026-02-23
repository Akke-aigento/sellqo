import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAuthedClient } from '@/integrations/supabase/authedClient';
import { restInsertSingle } from '@/integrations/supabase/authedRest';
import { createTenantViaFunction, SlugConflictError } from '@/integrations/backend/createTenantViaFunction';
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

interface SlugConflict {
  original: string;
  suggested: string;
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
  slugConflict: SlugConflict | null;
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
    slugConflict: null,
  });
  
  // Track if user had partial progress when loading
  const [hasPartialProgress, setHasPartialProgress] = useState(false);
  
  // Track if we've done the initial check - prevents resume dialog from showing
  // during active sessions (e.g., after tenant creation triggers refreshTenants)
  const hasInitiallyChecked = useRef(false);

  // FIX 2: Track if we've created a tenant this session - prevents re-checks
  // Refs: Console log analyse - step flip na refreshTenants
  const hasCreatedTenantRef = useRef(false);

  // FIX 2: Track debounce timer for checkOnboardingStatus
  const checkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if user needs onboarding
  const checkOnboardingStatus = useCallback(async () => {
    // FIX 2: Skip if we just created a tenant - prevents flip back to step 1
    // Refs: Console log analyse - multiple checkOnboardingStatus calls na tenant creation
    if (hasCreatedTenantRef.current) {
      console.log('[Onboarding] checkOnboardingStatus: skipped (tenant just created)');
      return;
    }

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
      // Fetch profile to check onboarding status + saved data
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step, onboarding_skipped_at, onboarding_data, email, created_at')
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

      // Show onboarding for new users or users who haven't completed setup
      const savedStep = profile?.onboarding_step || 1;
      
      // FIX: Only force step 1 for brand new users on INITIAL load
      // On subsequent re-checks (after tenant creation, token refresh, etc.), respect the saved step
      // This prevents the wizard from resetting to step 1 mid-session
      const isInitialCheck = !hasInitiallyChecked.current;
      const startStep = (isNewUser && isInitialCheck) ? 1 : savedStep;
      
      // Track if returning user has partial progress (not brand new, step > 1)
      // ONLY set this on initial load, not on subsequent re-checks (e.g., after refreshTenants)
      const partialProgress = !isNewUser && savedStep > 1;
      if (isInitialCheck) {
        setHasPartialProgress(partialProgress);
        hasInitiallyChecked.current = true;
      }
      
      // Restore saved onboarding data from database
      const savedOnboardingData = (profile?.onboarding_data as Partial<OnboardingData>) || {};
      const restoredData: OnboardingData = {
        ...initialData,
        ...savedOnboardingData,
        email: savedOnboardingData.email || profile?.email || user.email || '',
      };
      
      // Check if critical data is missing for a resumed session
      const hasCriticalData = !partialProgress || (restoredData.shopName && restoredData.shopSlug);
      
      console.log('[Onboarding] checkOnboardingStatus: step=', startStep, 'hasCriticalData=', hasCriticalData, 'restoredData=', restoredData);
      
      setState(prev => ({
        ...prev,
        currentStep: startStep,
        isOpen: true,
        isLoading: false,
        data: restoredData,
      }));
      
      // Flag if we have partial progress but missing critical data
      if (partialProgress && !hasCriticalData) {
        setHasPartialProgress(true); // Force dialog to show
      }
    } catch (err) {
      console.error('Onboarding check error:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  // FIX 2: Remove tenants and currentTenant from dependencies
  // These were causing re-runs after refreshTenants() which flipped the step back
  // Refs: Console log analyse - onboarding step flip (step 1 <-> step 4)
  }, [user, tenantsLoading]);

  // FIX 2: Debounce the status check to prevent rapid re-runs
  // Refs: Console log analyse - multiple rapid checkOnboardingStatus calls
  useEffect(() => {
    // Clear any pending debounce
    if (checkDebounceRef.current) {
      clearTimeout(checkDebounceRef.current);
    }
    
    // Debounce the check by 150ms
    checkDebounceRef.current = setTimeout(() => {
      checkOnboardingStatus();
    }, 150);
    
    return () => {
      if (checkDebounceRef.current) {
        clearTimeout(checkDebounceRef.current);
      }
    };
  }, [checkOnboardingStatus]);

  // Persist onboarding data to database (debounced)
  const persistOnboardingData = useCallback(async (data: OnboardingData) => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_data: data as any })
        .eq('id', user.id);
      console.log('[Onboarding] Data persisted to database');
    } catch (err) {
      console.warn('[Onboarding] Failed to persist data:', err);
    }
  }, [user]);

  // Update data and persist to database
  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setState(prev => {
      const newData = { ...prev.data, ...updates };
      // Persist in background (non-blocking)
      persistOnboardingData(newData);
      return { ...prev, data: newData };
    });
  }, [persistOnboardingData]);

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
      
      // CRITICAL: Refresh tenants to load the newly created tenant
      // Without this, the Dashboard shows "Geen winkel gevonden"
      try {
        await refreshTenants();
      } catch (error) {
        console.warn('[Onboarding] refreshTenants failed on complete:', error);
      }
    }
    
    setState(prev => ({ ...prev, isOpen: false }));
  }, [user, refreshTenants]);

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
    
    // Reset the initial check flag so future page loads can show resume dialog if needed
    hasInitiallyChecked.current = false;
    setHasPartialProgress(false);
    
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

    // CRITICAL VALIDATION: Check if shopName and shopSlug are filled in
    const { shopName, shopSlug } = state.data;
    if (!shopName?.trim() || !shopSlug?.trim()) {
      console.error('[Onboarding] createTenant: shopName or shopSlug is empty!', { shopName, shopSlug });
      throw new Error('MISSING_SHOP_DATA');
    }

    // PRE-FLIGHT CHECK: Verify slug is still available before proceeding
    console.log('[Onboarding] createTenant: pre-flight slug check...');
    const slugStillAvailable = await checkSlugAvailable(shopSlug);
    
    if (!slugStillAvailable) {
      console.log('[Onboarding] createTenant: slug no longer available, finding alternative...');
      const suggestedSlug = await findAlternativeSlug(shopSlug);
      setState(prev => ({
        ...prev,
        slugConflict: {
          original: shopSlug,
          suggested: suggestedSlug,
        },
      }));
      throw new Error('SLUG_CONFLICT');
    }

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

    const { businessName, email, address, postalCode, city, country, vatNumber, chamberOfCommerce } = state.data;

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

    // Helper: verify tenant is readable (RLS propagation can have delay)
    const verifyTenantReadable = async (tenantId: string, maxRetries = 5, delayMs = 250): Promise<boolean> => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const { data, error } = await authedDb
          .from('tenants')
          .select('id')
          .eq('id', tenantId)
          .maybeSingle();
        
        if (data) {
          console.log(`[Onboarding] verifyTenantReadable: tenant readable on attempt ${attempt}`);
          return true;
        }
        
        if (attempt < maxRetries) {
          console.log(`[Onboarding] verifyTenantReadable: attempt ${attempt} failed, retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      console.warn('[Onboarding] verifyTenantReadable: tenant NOT readable after max retries');
      return false;
    };

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

      // ============================================
      // PAYLOAD SEPARATION: tenantInsertPayload for DB, functionPayload for Edge Function
      // selected_plan_id does NOT exist in tenants table - only pass to Edge Function
      // ============================================
      const tenantInsertPayload = {
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
        // NOTE: NO selected_plan_id here - it doesn't exist in the tenants table!
      };

      const selectedPlanId = state.data.selectedPlanId || 'free';
      const functionPayload = {
        ...tenantInsertPayload,
        selected_plan_id: selectedPlanId, // Only for Edge Function, which handles tenant_subscriptions
      };

      // ============================================
      // PRIMARY: Use Edge Function (handles plan correctly + bypasses RLS issues)
      // ============================================
      console.log('[Onboarding] createTenant: attempting via Edge Function (primary)...');
      try {
        const fnTenant = await createTenantViaFunction<any>(accessToken, functionPayload);
        console.log('[Onboarding] createTenant: Edge Function succeeded:', fnTenant?.id);
        
        // Verify tenant is readable before proceeding (prevents step-flip)
        if (fnTenant?.id) {
          const isReadable = await verifyTenantReadable(fnTenant.id);
          if (!isReadable) {
            console.warn('[Onboarding] createTenant: tenant created but not yet readable - proceeding anyway');
          }
        }
        
        return { tenant: fnTenant, tenantError: null, wasExisting: false };
      } catch (fnError: any) {
        // Handle slug conflict from Edge Function
        if (fnError instanceof SlugConflictError) {
          console.log('[Onboarding] createTenant: Edge Function returned slug conflict');
          setState(prev => ({
            ...prev,
            slugConflict: {
              original: fnError.originalSlug,
              suggested: fnError.suggestedSlug,
            },
          }));
          throw new Error('SLUG_CONFLICT');
        }
        
        // For auth/infra errors, try fallback
        console.warn('[Onboarding] createTenant: Edge Function failed, trying direct insert fallback...', fnError);
      }

      // ============================================
      // FALLBACK: Direct DB insert (without selected_plan_id!)
      // ============================================
      console.log('[Onboarding] createTenant: trying direct insert fallback...');
      const { data: tenant, error: tenantError } = await authedDb
        .from('tenants')
        .insert(tenantInsertPayload) // Note: NO selected_plan_id
        .select()
        .single();

      // If we still get an RLS error here, try a raw REST fallback with explicit Authorization header.
      if (tenantError && (tenantError.code === '42501' || tenantError.message?.includes('row-level security'))) {
        console.warn('[Onboarding] createTenant: RLS error via supabase-js, trying REST fallback...');
        try {
          const restTenant = await restInsertSingle<any>('tenants', accessToken, tenantInsertPayload);
          console.log('[Onboarding] createTenant: REST fallback succeeded:', restTenant?.id);
          
          // Update subscription if non-free plan was selected (fallback route)
          if (restTenant?.id && selectedPlanId !== 'free') {
            await updateSubscriptionPlan(restTenant.id, selectedPlanId);
          }
          
          return { tenant: restTenant, tenantError: null, wasExisting: false };
        } catch (restErr) {
          console.error('[Onboarding] createTenant: All fallbacks failed', restErr);
          throw restErr;
        }
      }

      // If direct insert succeeded but plan is not free, update subscription
      if (tenant && !tenantError && selectedPlanId !== 'free') {
        await updateSubscriptionPlan(tenant.id, selectedPlanId);
      }

      // Verify tenant is readable before proceeding
      if (tenant?.id) {
        const isReadable = await verifyTenantReadable(tenant.id);
        if (!isReadable) {
          console.warn('[Onboarding] createTenant: tenant created but not yet readable - proceeding anyway');
        }
      }

      return { tenant, tenantError, wasExisting: false };
    };

    // Helper to update subscription plan when fallback route is used
    const updateSubscriptionPlan = async (tenantId: string, planId: string) => {
      console.log('[Onboarding] updateSubscriptionPlan: updating plan for fallback-created tenant...');
      try {
        // Wait a moment for the trigger to create the subscription row
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { error } = await authedDb
          .from('tenant_subscriptions')
          .update({ plan_id: planId })
          .eq('tenant_id', tenantId);
        
        if (error) {
          console.warn('[Onboarding] updateSubscriptionPlan: failed', error);
        } else {
          console.log('[Onboarding] updateSubscriptionPlan: success');
        }
      } catch (err) {
        console.warn('[Onboarding] updateSubscriptionPlan: exception', err);
      }
    };

    try {
      const { tenant, tenantError, wasExisting } = await attemptCreate();

      // ============================================
      // SUCCESS PATH - return immediately, no extra checks
      // ============================================
      if (tenant && !tenantError) {
        // FIX 2: Mark that we created a tenant - prevents checkOnboardingStatus re-runs
        hasCreatedTenantRef.current = true;
        
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

        // NOTE: Subscription plan update is now handled in the Edge Function (create-tenant)
        // This ensures it runs with service_role privileges and won't fail due to RLS

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
          images: productImageUrl ? [productImageUrl] : [],
          featured_image: productImageUrl || null,
          product_type: 'physical' as const,
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

  // Find an alternative slug when the original is taken
  const findAlternativeSlug = useCallback(async (baseSlug: string): Promise<string> => {
    // Try numbered variants: slug-2, slug-3, etc.
    for (let i = 2; i <= 10; i++) {
      const candidate = `${baseSlug}-${i}`;
      const isAvailable = await checkSlugAvailable(candidate);
      if (isAvailable) {
        return candidate;
      }
    }
    
    // Fallback: slug + random suffix
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    return `${baseSlug}-${randomSuffix}`;
  }, [checkSlugAvailable]);

  // Function to clear partial progress flag (after user makes choice)
  const clearPartialProgress = useCallback(() => {
    setHasPartialProgress(false);
  }, []);

  // Clear slug conflict and optionally accept a new slug
  const handleSlugConflictAccept = useCallback((newSlug: string) => {
    updateData({ shopSlug: newSlug });
    setState(prev => ({ ...prev, slugConflict: null }));
  }, [updateData]);

  // Clear slug conflict and go back to step 1
  const handleSlugConflictGoToStep1 = useCallback(() => {
    setState(prev => ({ ...prev, slugConflict: null, currentStep: 1 }));
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

  // Check if critical data is missing (needed for resume dialog)
  const isMissingCriticalData = useCallback(() => {
    const { shopName, shopSlug } = state.data;
    return !shopName?.trim() || !shopSlug?.trim();
  }, [state.data]);

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
    findAlternativeSlug,
    handleSlugConflictAccept,
    handleSlugConflictGoToStep1,
    refreshOnboarding: checkOnboardingStatus,
    handleSessionExpiredRelogin,
    clearSessionExpired,
    isMissingCriticalData,
  };
}
