import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

export type InvitationRole =
  | 'tenant_admin'
  | 'staff'
  | 'accountant'
  | 'warehouse'
  | 'viewer'
  | 'marketing';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked' | 'rejected';

export interface TeamInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: InvitationRole;
  invited_by: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  status: InvitationStatus;
  revoked_at: string | null;
  revoked_by: string | null;
  last_reminder_sent_at: string | null;
  created_at: string;
}

export interface UseTeamInvitationsOptions {
  /** Filter by status. 'all' returns every invitation. */
  statusFilter?: InvitationStatus | 'all';
}

export function useTeamInvitations(options: UseTeamInvitationsOptions = {}) {
  const { statusFilter = 'pending' } = options;
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const fetchInvitations = useCallback(async () => {
    if (!currentTenant?.id) {
      setInvitations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let query = supabase
        .from('team_invitations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvitations((data || []) as TeamInvitation[]);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, statusFilter]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    const channel = supabase
      .channel(`team-invitations-${currentTenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_invitations',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        () => fetchInvitations(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, fetchInvitations]);

  const sendInvitation = async (email: string, role: InvitationRole) => {
    if (!currentTenant?.id) {
      toast({ title: 'Fout', description: 'Geen winkel geselecteerd', variant: 'destructive' });
      return false;
    }
    try {
      const response = await supabase.functions.invoke('send-team-invitation', {
        body: { email, role, tenantId: currentTenant.id },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast({ title: 'Uitnodiging verzonden', description: `Verzonden naar ${email}` });
      await fetchInvitations();
      return true;
    } catch (error: any) {
      toast({ title: 'Fout bij verzenden', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const revokeInvitation = async (invitationId: string) => {
    // Optimistic update
    const previous = invitations;
    setInvitations((prev) =>
      prev.map((i) => (i.id === invitationId ? { ...i, status: 'revoked' as InvitationStatus } : i)),
    );
    try {
      const { data, error } = await supabase.functions.invoke('revoke-team-invitation', {
        body: { invitation_id: invitationId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Uitnodiging ingetrokken' });
      await fetchInvitations();
      return true;
    } catch (error: any) {
      setInvitations(previous);
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const resendInvitation = async (invitationId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('resend-team-invitation', {
        body: { invitation_id: invitationId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Uitnodiging opnieuw verzonden' });
      await fetchInvitations();
      return true;
    } catch (error: any) {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  /** @deprecated use revokeInvitation. Kept for backwards compat with TeamSettings. */
  const cancelInvitation = revokeInvitation;

  return {
    invitations,
    isLoading,
    sendInvitation,
    revokeInvitation,
    resendInvitation,
    cancelInvitation,
    refetch: fetchInvitations,
  };
}