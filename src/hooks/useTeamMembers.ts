import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useToast } from './use-toast';

export type AppRole = 'platform_admin' | 'tenant_admin' | 'staff' | 'accountant' | 'warehouse' | 'viewer';

export interface TeamMember {
  id: string;
  user_id: string;
  role: AppRole;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export function useTeamMembers() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!currentTenant?.id) {
      setMembers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch user roles for this tenant
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at')
        .eq('tenant_id', currentTenant.id);

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) {
        setMembers([]);
        setIsLoading(false);
        return;
      }

      // Fetch profile info for each user
      const userIds = roles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const combined: TeamMember[] = roles.map(role => {
        const profile = profiles?.find(p => p.id === role.user_id);
        return {
          id: role.id,
          user_id: role.user_id,
          role: role.role,
          email: profile?.email || null,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
          created_at: role.created_at,
        };
      });

      setMembers(combined);
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      toast({
        title: 'Fout bij laden teamleden',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const updateMemberRole = async (memberId: string, newRole: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      await fetchMembers();
      
      toast({
        title: 'Rol bijgewerkt',
        description: 'De gebruikersrol is succesvol gewijzigd.',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Fout bij wijzigen rol',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      await fetchMembers();
      
      toast({
        title: 'Teamlid verwijderd',
        description: 'Het teamlid heeft geen toegang meer tot deze winkel.',
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: 'Fout bij verwijderen',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    members,
    isLoading,
    fetchMembers,
    updateMemberRole,
    removeMember,
  };
}
