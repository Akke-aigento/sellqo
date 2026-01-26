import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

interface DomainVerificationStatus {
  success: boolean;
  a_record_valid: boolean;
  txt_record_valid: boolean;
  current_a_record: string | null;
  current_txt_record: string | null;
  error?: string;
  error_type?: 'wrong_ip' | 'cname_conflict' | 'not_propagated' | 'domain_not_found' | 'unknown';
  error_details?: string;
}

export interface ProviderInfo {
  provider: string;
  provider_name: string;
  supports_auto_connect: boolean;
  connect_method: string | null;
  nameservers: string[];
}

interface CloudflareConnectResult {
  success: boolean;
  records_created?: number;
  records_updated?: number;
  domain?: string;
  error?: string;
  error_type?: string;
  available_zones?: string[];
}

interface SSLCheckResult {
  ssl_active: boolean;
  ssl_issuer: string | null;
  ssl_expires_at: string | null;
  error?: string;
  domain_reachable: boolean;
}

interface UseDomainVerificationReturn {
  isLoading: boolean;
  isSaving: boolean;
  isVerifying: boolean;
  isDetecting: boolean;
  isConnecting: boolean;
  isPolling: boolean;
  verificationStatus: DomainVerificationStatus | null;
  providerInfo: ProviderInfo | null;
  sslStatus: SSLCheckResult | null;
  saveDomain: (domain: string) => Promise<boolean>;
  verifyDomain: () => Promise<DomainVerificationStatus | null>;
  removeDomain: () => Promise<boolean>;
  generateVerificationToken: () => string;
  detectProvider: (domain: string) => Promise<ProviderInfo | null>;
  connectWithApiToken: (domain: string, apiToken: string) => Promise<CloudflareConnectResult>;
  checkSSL: (domain: string) => Promise<SSLCheckResult | null>;
  startPolling: () => void;
  stopPolling: () => void;
}

const POLL_INTERVAL = 30000; // 30 seconds
const MAX_POLL_DURATION = 300000; // 5 minutes

export function useDomainVerification(): UseDomainVerificationReturn {
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<DomainVerificationStatus | null>(null);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [sslStatus, setSSLStatus] = useState<SSLCheckResult | null>(null);
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const generateVerificationToken = useCallback((): string => {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  }, []);

  const validateDomainFormat = (domain: string): boolean => {
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    return domainRegex.test(cleanDomain);
  };

  const checkSSL = useCallback(async (domain: string): Promise<SSLCheckResult | null> => {
    try {
      const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase();
      
      const { data, error } = await supabase.functions.invoke<SSLCheckResult>('check-domain-ssl', {
        body: { 
          domain: cleanDomain,
          tenant_id: currentTenant?.id,
        },
      });

      if (error) throw error;
      if (!data) throw new Error('No data returned');
      
      setSSLStatus(data);
      return data;
    } catch (error) {
      console.error('Error checking SSL:', error);
      return null;
    }
  }, [currentTenant?.id]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollStartTimeRef.current = null;
    setIsPolling(false);
  }, []);

  const detectProvider = useCallback(async (domain: string): Promise<ProviderInfo | null> => {
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase();
    
    if (!validateDomainFormat(cleanDomain)) {
      return null;
    }

    setIsDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke<ProviderInfo>('detect-domain-provider', {
        body: { domain: cleanDomain },
      });

      if (error) throw error;
      if (!data) throw new Error('No data returned');
      
      setProviderInfo(data);
      return data;
    } catch (error) {
      console.error('Error detecting provider:', error);
      const fallback: ProviderInfo = {
        provider: 'unknown',
        provider_name: 'Onbekend',
        supports_auto_connect: false,
        connect_method: null,
        nameservers: [],
      };
      setProviderInfo(fallback);
      return fallback;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  const verifyDomain = useCallback(async (): Promise<DomainVerificationStatus | null> => {
    if (!currentTenant?.id) {
      toast({
        title: 'Fout',
        description: 'Geen tenant gevonden',
        variant: 'destructive',
      });
      return null;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke<DomainVerificationStatus>('verify-domain', {
        body: { tenant_id: currentTenant.id },
      });

      if (error) throw error;
      if (!data) throw new Error('No data returned');
      setVerificationStatus(data);

      if (data.success) {
        toast({
          title: 'DNS Geverifieerd!',
          description: 'De DNS records zijn correct geconfigureerd. SSL wordt nu geactiveerd.',
        });
        await refreshTenants();
        stopPolling();
        
        // Check SSL after DNS verification
        if (currentTenant.custom_domain) {
          await checkSSL(currentTenant.custom_domain);
        }
      } else {
        // Show specific error message
        const errorMessage = data.error_details || 'DNS records zijn nog niet correct geconfigureerd. Dit kan tot 48 uur duren.';
        toast({
          title: data.error || 'Verificatie niet voltooid',
          description: errorMessage,
          variant: 'destructive',
        });
      }

      return data;
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast({
        title: 'Verificatie mislukt',
        description: 'Kon de DNS records niet controleren. Probeer het later opnieuw.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsVerifying(false);
    }
  }, [currentTenant?.id, currentTenant?.custom_domain, toast, refreshTenants, stopPolling, checkSSL]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return; // Already polling
    
    setIsPolling(true);
    pollStartTimeRef.current = Date.now();
    
    // Immediately verify once
    verifyDomain();
    
    pollingRef.current = setInterval(async () => {
      // Check if we've exceeded max poll duration
      if (pollStartTimeRef.current && Date.now() - pollStartTimeRef.current > MAX_POLL_DURATION) {
        stopPolling();
        toast({
          title: 'Polling gestopt',
          description: 'Automatische controle gestopt na 5 minuten. Klik op "DNS Controleren" om opnieuw te proberen.',
        });
        return;
      }
      
      const result = await verifyDomain();
      if (result?.success) {
        stopPolling();
      }
    }, POLL_INTERVAL);
  }, [verifyDomain, stopPolling, toast]);

  const connectWithApiToken = useCallback(async (domain: string, apiToken: string): Promise<CloudflareConnectResult> => {
    if (!currentTenant?.id) {
      toast({
        title: 'Fout',
        description: 'Geen tenant gevonden',
        variant: 'destructive',
      });
      return { success: false, error: 'Geen tenant gevonden' };
    }

    if (!apiToken.trim()) {
      toast({
        title: 'Fout',
        description: 'Voer een API token in',
        variant: 'destructive',
      });
      return { success: false, error: 'Voer een API token in' };
    }

    setIsConnecting(true);
    try {
      const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase();
      
      const { data, error } = await supabase.functions.invoke<CloudflareConnectResult>('cloudflare-api-connect', {
        body: { 
          tenant_id: currentTenant.id,
          domain: cleanDomain,
          api_token: apiToken,
        },
      });

      if (error) throw error;
      if (!data) throw new Error('Geen response ontvangen');

      if (data.success) {
        toast({
          title: 'Domein gekoppeld!',
          description: `DNS records zijn automatisch geconfigureerd voor ${data.domain}`,
        });
        await refreshTenants();
        
        // Start SSL check after successful connection
        setTimeout(() => checkSSL(cleanDomain), 2000);
      } else {
        toast({
          title: 'Koppeling mislukt',
          description: data.error || 'Er is een fout opgetreden',
          variant: 'destructive',
        });
      }

      return data;
    } catch (error) {
      console.error('Error connecting with API token:', error);
      const errorMessage = 'Er is een fout opgetreden bij het koppelen. Probeer het opnieuw.';
      toast({
        title: 'Fout bij koppelen',
        description: errorMessage,
        variant: 'destructive',
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsConnecting(false);
    }
  }, [currentTenant?.id, toast, refreshTenants, checkSSL]);

  const saveDomain = useCallback(async (domain: string): Promise<boolean> => {
    if (!currentTenant?.id) {
      toast({
        title: 'Fout',
        description: 'Geen tenant gevonden',
        variant: 'destructive',
      });
      return false;
    }

    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase();
    
    if (!validateDomainFormat(cleanDomain)) {
      toast({
        title: 'Ongeldig domein',
        description: 'Voer een geldig domeinnaam in (bijv. mijnwebshop.be)',
        variant: 'destructive',
      });
      return false;
    }

    setIsSaving(true);
    try {
      const token = generateVerificationToken();
      
      const { error } = await supabase
        .from('tenants' as const)
        .update({
          custom_domain: cleanDomain,
          domain_verified: false,
          domain_verification_token: token,
          ssl_status: 'pending',
        } as any)
        .eq('id', currentTenant.id);

      if (error) throw error;

      toast({
        title: 'Domein opgeslagen',
        description: 'Configureer nu de DNS records bij je domeinprovider',
      });
      
      await refreshTenants();
      return true;
    } catch (error) {
      console.error('Error saving domain:', error);
      toast({
        title: 'Fout bij opslaan',
        description: 'Kon het domein niet opslaan. Probeer het opnieuw.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [currentTenant?.id, toast, refreshTenants, generateVerificationToken]);

  const removeDomain = useCallback(async (): Promise<boolean> => {
    if (!currentTenant?.id) {
      toast({
        title: 'Fout',
        description: 'Geen tenant gevonden',
        variant: 'destructive',
      });
      return false;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tenants' as const)
        .update({
          custom_domain: null,
          domain_verified: false,
          domain_verification_token: null,
          ssl_status: null,
          ssl_checked_at: null,
          ssl_expires_at: null,
        })
        .eq('id', currentTenant.id);

      if (error) throw error;

      toast({
        title: 'Domein verwijderd',
        description: 'Je custom domein is losgekoppeld',
      });
      
      setVerificationStatus(null);
      setProviderInfo(null);
      setSSLStatus(null);
      stopPolling();
      await refreshTenants();
      return true;
    } catch (error) {
      console.error('Error removing domain:', error);
      toast({
        title: 'Fout bij verwijderen',
        description: 'Kon het domein niet verwijderen. Probeer het opnieuw.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toast, refreshTenants, stopPolling]);

  return {
    isLoading,
    isSaving,
    isVerifying,
    isDetecting,
    isConnecting,
    isPolling,
    verificationStatus,
    providerInfo,
    sslStatus,
    saveDomain,
    verifyDomain,
    removeDomain,
    generateVerificationToken,
    detectProvider,
    connectWithApiToken,
    checkSSL,
    startPolling,
    stopPolling,
  };
}
