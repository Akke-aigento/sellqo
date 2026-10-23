// PERSONEEL-1 — kassapersoneel beheren (pos_cashiers via de beveiligde functies).
// De tabel is enkel leesbaar zonder geheimen; schrijven gaat via kassa_staff_save en
// kassa_staff_set_insz (tenant_admin). PIN en INSZ komen nooit terug naar de admin.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

export const KASSA_ROLES = ['owner', 'manager', 'waiter', 'bartender', 'kitchen', 'technician'] as const;
export type KassaRole = (typeof KASSA_ROLES)[number];

export interface KassaStaffRow {
  id: string;
  display_name: string;
  role: KassaRole;
  employee_no: number | null;
  avatar_color: string | null;
  is_active: boolean;
  can_use_pos: boolean;
  insz_set_at: string | null;
  locked_until: string | null;
  last_login_at: string | null;
}

export interface KassaStaffInput {
  id?: string | null;
  display_name: string;
  role: KassaRole;
  employee_no?: number | null;
  avatar_color?: string | null;
  is_active: boolean;
  can_use_pos: boolean;
  pin?: string | null;
  /** undefined = niet wijzigen, null = wissen, tekst = zetten. */
  insz?: string | null;
}

export function useKassaStaff() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  const key = ['kassa-staff', currentTenant?.id];

  const list = useQuery({
    queryKey: key,
    enabled: !!currentTenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_cashiers' as never)
        .select('id, display_name, role, employee_no, avatar_color, is_active, can_use_pos, insz_set_at, locked_until, last_login_at')
        .eq('tenant_id' as never, currentTenant!.id as never)
        .order('employee_no' as never, { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as KassaStaffRow[];
    },
  });

  const save = useMutation({
    mutationFn: async (input: KassaStaffInput) => {
      if (!currentTenant) throw new Error('no tenant');
      const { data: id, error } = await supabase.rpc('kassa_staff_save' as never, {
        p_tenant_id: currentTenant.id,
        p_id: input.id ?? null,
        p_display_name: input.display_name,
        p_role: input.role,
        p_employee_no: input.employee_no ?? null,
        p_avatar_color: input.avatar_color ?? null,
        p_can_use_pos: input.can_use_pos,
        p_is_active: input.is_active,
        p_pin: input.pin || null,
      } as never);
      if (error) throw error;
      if (input.insz !== undefined) {
        const { error: e2 } = await supabase.rpc('kassa_staff_set_insz' as never, { p_cashier_id: id, p_insz: input.insz } as never);
        if (e2) throw e2;
      }
      return id as unknown as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { staff: list.data ?? [], isLoading: list.isLoading, error: list.error, save };
}
