import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

export type InvitationRole = 'tenant_admin' | 'staff' | 'accountant' | 'warehouse' | 'viewer';

export interface TeamInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: InvitationRole;
  invited_by: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export function useTeamInvitations() {
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
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations((data || []) as TeamInvitation[]);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const sendInvitation = async (email: string, role: InvitationRole) => {
    if (!currentTenant?.id) {
      toast({
        title: 'Fout',
        description: 'Geen winkel geselecteerd',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Niet ingelogd');

      const response = await supabase.functions.invoke('send-team-invitation', {
        body: {
          email,
          role,
          tenantId: currentTenant.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: 'Uitnodiging verzonden',
        description: `Een uitnodiging is verzonden naar ${email}`,
      });

      await fetchInvitations();
      return true;
    } catch (error: any) {
      toast({
        title: 'Fout bij verzenden',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: 'Uitnodiging geannuleerd',
        description: 'De uitnodiging is verwijderd',
      });

      await fetchInvitations();
      return true;
    } catch (error: any) {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const resendInvitation = async (invitationId: string) => {
    const invitation = invitations.find(i => i.id === invitationId);
    if (!invitation) return false;

    // Delete old and create new
    await cancelInvitation(invitationId);
    return sendInvitation(invitation.email, invitation.role);
  };

  return {
    invitations,
    isLoading,
    sendInvitation,
    cancelInvitation,
    resendInvitation,
    refetch: fetchInvitations,
  };
}
