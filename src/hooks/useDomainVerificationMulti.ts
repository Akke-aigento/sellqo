import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { TenantDomain } from '@/hooks/useTenantDomains';

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

interface SSLCheckResult {
  ssl_active: boolean;
  ssl_issuer: string | null;
  ssl_expires_at: string | null;
  error?: string;
  domain_reachable: boolean;
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

const POLL_INTERVAL = 30000;
const MAX_POLL_DURATION = 300000;

export function useDomainVerificationMulti(domain: TenantDomain) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<DomainVerificationStatus | null>(null);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [sslStatus, setSSLStatus] = useState<SSLCheckResult | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const invalidateDomains = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tenant-domains', currentTenant?.id] });
  }, [queryClient, currentTenant?.id]);

  const verifyDomain = useCallback(async (): Promise<DomainVerificationStatus | null> => {
    if (!currentTenant?.id) return null;
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke<DomainVerificationStatus>('verify-domain', {
        body: { tenant_id: currentTenant.id, domain_id: domain.id },
      });
      if (error) throw error;
      if (!data) throw new Error('No data returned');
      setVerificationStatus(data);

      if (data.success) {
        toast.success('DNS geverifieerd! SSL wordt nu gecontroleerd.');
        invalidateDomains();
        // Check SSL after DNS verified
        checkSSL();
      }
      return data;
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast.error('Kon DNS niet controleren. Probeer het later opnieuw.');
      return null;
    } finally {
      setIsVerifying(false);
    }
  }, [currentTenant?.id, domain.id]);

  const checkSSL = useCallback(async (): Promise<SSLCheckResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke<SSLCheckResult>('check-domain-ssl', {
        body: { domain: domain.domain, tenant_id: currentTenant?.id, domain_id: domain.id },
      });
      if (error) throw error;
      if (!data) throw new Error('No data');
      setSSLStatus(data);
      if (data.ssl_active) {
        invalidateDomains();
      }
      return data;
    } catch (error) {
      console.error('Error checking SSL:', error);
      return null;
    }
  }, [domain.domain, domain.id, currentTenant?.id]);

  const detectProvider = useCallback(async (): Promise<ProviderInfo | null> => {
    setIsDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke<ProviderInfo>('detect-domain-provider', {
        body: { domain: domain.domain },
      });
      if (error) throw error;
      setProviderInfo(data);
      return data;
    } catch (error) {
      console.error('Error detecting provider:', error);
      const fallback: ProviderInfo = {
        provider: 'unknown', provider_name: 'Onbekend',
        supports_auto_connect: false, connect_method: null, nameservers: [],
      };
      setProviderInfo(fallback);
      return fallback;
    } finally {
      setIsDetecting(false);
    }
  }, [domain.domain]);

  const connectWithApiToken = useCallback(async (apiToken: string): Promise<CloudflareConnectResult> => {
    if (!currentTenant?.id) return { success: false, error: 'Geen tenant' };
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke<CloudflareConnectResult>('cloudflare-api-connect', {
        body: { tenant_id: currentTenant.id, domain: domain.domain, api_token: apiToken },
      });
      if (error) throw error;
      if (!data) throw new Error('Geen response');
      if (data.success) {
        toast.success(`DNS records automatisch geconfigureerd voor ${domain.domain}`);
        invalidateDomains();
        setTimeout(() => checkSSL(), 2000);
      } else {
        toast.error(data.error || 'Koppeling mislukt');
      }
      return data;
    } catch (error) {
      console.error('Error connecting:', error);
      toast.error('Fout bij koppelen. Probeer het opnieuw.');
      return { success: false, error: 'Fout bij koppelen' };
    } finally {
      setIsConnecting(false);
    }
  }, [currentTenant?.id, domain.domain, domain.id, checkSSL, invalidateDomains]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollStartTimeRef.current = null;
    setIsPolling(false);
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    setIsPolling(true);
    pollStartTimeRef.current = Date.now();
    verifyDomain();

    pollingRef.current = setInterval(async () => {
      if (pollStartTimeRef.current && Date.now() - pollStartTimeRef.current > MAX_POLL_DURATION) {
        stopPolling();
        toast.info('Automatische controle gestopt na 5 minuten. Probeer het handmatig opnieuw.');
        return;
      }
      const result = await verifyDomain();
      if (result?.success) stopPolling();
    }, POLL_INTERVAL);
  }, [verifyDomain, stopPolling]);

  return {
    isVerifying,
    isDetecting,
    isConnecting,
    isPolling,
    verificationStatus,
    providerInfo,
    sslStatus,
    verifyDomain,
    checkSSL,
    detectProvider,
    connectWithApiToken,
    startPolling,
    stopPolling,
  };
}
