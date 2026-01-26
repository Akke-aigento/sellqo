import { useState, useCallback } from 'react';
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
}

export interface ProviderInfo {
  provider: string;
  provider_name: string;
  supports_auto_connect: boolean;
  connect_method: string | null;
  nameservers: string[];
}

interface UseDomainVerificationReturn {
  isLoading: boolean;
  isSaving: boolean;
  isVerifying: boolean;
  isDetecting: boolean;
  verificationStatus: DomainVerificationStatus | null;
  providerInfo: ProviderInfo | null;
  saveDomain: (domain: string) => Promise<boolean>;
  verifyDomain: () => Promise<DomainVerificationStatus | null>;
  removeDomain: () => Promise<boolean>;
  generateVerificationToken: () => string;
  detectProvider: (domain: string) => Promise<ProviderInfo | null>;
  initiateCloudflareOAuth: (domain: string) => Promise<string | null>;
}

export function useDomainVerification(): UseDomainVerificationReturn {
  const { currentTenant, refreshTenants } = useTenant();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<DomainVerificationStatus | null>(null);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);

  const generateVerificationToken = useCallback((): string => {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  }, []);

  const validateDomainFormat = (domain: string): boolean => {
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    return domainRegex.test(cleanDomain);
  };

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

  const initiateCloudflareOAuth = useCallback(async (domain: string): Promise<string | null> => {
    if (!currentTenant?.id) {
      toast({
        title: 'Fout',
        description: 'Geen tenant gevonden',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke<{ oauth_url?: string; configured: boolean; error?: string }>('cloudflare-oauth-init', {
        body: { 
          tenant_id: currentTenant.id,
          domain: domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase(),
        },
      });

      if (error) throw error;
      if (!data?.configured) {
        toast({
          title: 'Cloudflare niet geconfigureerd',
          description: 'Automatische koppeling is momenteel niet beschikbaar. Gebruik de handmatige configuratie.',
          variant: 'destructive',
        });
        return null;
      }
      
      return data.oauth_url || null;
    } catch (error) {
      console.error('Error initiating Cloudflare OAuth:', error);
      toast({
        title: 'Fout bij koppelen',
        description: 'Kon de automatische koppeling niet starten. Probeer handmatig te configureren.',
        variant: 'destructive',
      });
      return null;
    }
  }, [currentTenant?.id, toast]);

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
          title: 'Domein geverifieerd!',
          description: 'Je custom domein is nu actief',
        });
        await refreshTenants();
      } else {
        toast({
          title: 'Verificatie niet voltooid',
          description: 'DNS records zijn nog niet correct geconfigureerd. Dit kan tot 48 uur duren.',
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
  }, [currentTenant?.id, toast, refreshTenants]);

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
        })
        .eq('id', currentTenant.id);

      if (error) throw error;

      toast({
        title: 'Domein verwijderd',
        description: 'Je custom domein is losgekoppeld',
      });
      
      setVerificationStatus(null);
      setProviderInfo(null);
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
  }, [currentTenant?.id, toast, refreshTenants]);

  return {
    isLoading,
    isSaving,
    isVerifying,
    isDetecting,
    verificationStatus,
    providerInfo,
    saveDomain,
    verifyDomain,
    removeDomain,
    generateVerificationToken,
    detectProvider,
    initiateCloudflareOAuth,
  };
}
