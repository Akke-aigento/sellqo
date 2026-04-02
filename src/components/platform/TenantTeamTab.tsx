import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Mail, UserPlus, Trash2, RefreshCw, Shield, UserCog, Calculator, Warehouse, Eye, Users, Clock } from 'lucide-react';

type InvitationRole = 'tenant_admin' | 'staff' | 'accountant' | 'warehouse' | 'viewer';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  email: string | null;
  full_name: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

const roleOptions: { value: InvitationRole; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'tenant_admin', label: 'Admin', icon: Shield },
  { value: 'staff', label: 'Medewerker', icon: UserCog },
  { value: 'accountant', label: 'Boekhouder', icon: Calculator },
  { value: 'warehouse', label: 'Magazijn', icon: Warehouse },
  { value: 'viewer', label: 'Kijker', icon: Eye },
];

const roleLabelMap: Record<string, string> = {
  platform_admin: 'Platform Admin',
  tenant_admin: 'Admin',
  staff: 'Medewerker',
  accountant: 'Boekhouder',
  warehouse: 'Magazijn',
  viewer: 'Kijker',
};

export function TenantTeamTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('tenant_admin');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rolesRes, invRes] = await Promise.all([
        supabase.from('user_roles').select('id, user_id, role, created_at').eq('tenant_id', tenantId),
        supabase.from('team_invitations').select('*').eq('tenant_id', tenantId).is('accepted_at', null).order('created_at', { ascending: false }),
      ]);

      if (rolesRes.data && rolesRes.data.length > 0) {
        const userIds = rolesRes.data.map(r => r.user_id);
        const { data: profiles } = await supabase.from('profiles').select('id, email, full_name').in('id', userIds);
        setMembers(rolesRes.data.map(r => {
          const p = profiles?.find(p => p.id === r.user_id);
          return { id: r.id, user_id: r.user_id, role: r.role, email: p?.email || null, full_name: p?.full_name || null };
        }));
      } else {
        setMembers([]);
      }

      setInvitations((invRes.data || []) as Invitation[]);
    } catch (e) {
      console.error('Error fetching team data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await supabase.functions.invoke('send-team-invitation', {
        body: { email: email.trim(), role, tenantId },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      toast({ title: 'Uitnodiging verzonden', description: `Uitnodiging verstuurd naar ${email}` });
      setEmail('');
      setRole('tenant_admin');
      setDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      toast({ title: 'Fout', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelInvite = async (id: string) => {
    const { error } = await supabase.from('team_invitations').delete().eq('id', id);
    if (error) { toast({ title: 'Fout', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Uitnodiging geannuleerd' });
    await fetchData();
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return '?';
  };

  return (
    <div className="space-y-6">
      {/* Team Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Teamleden ({members.length})</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Mail className="h-4 w-4 mr-2" /> Uitnodigen</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Teamlid uitnodigen</DialogTitle>
                <DialogDescription>Stuur een uitnodiging per e-mail naar deze tenant.</DialogDescription>
              </DialogHeader>
              <form onSubmit={sendInvite}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">E-mailadres</Label>
                    <Input id="invite-email" type="email" placeholder="gebruiker@voorbeeld.nl" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Select value={role} onValueChange={v => setRole(v as InvitationRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roleOptions.map(o => (
                          <SelectItem key={o.value} value={o.value}>
                            <div className="flex items-center gap-2"><o.icon className="h-4 w-4" />{o.label}</div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuleren</Button>
                  <Button type="submit" disabled={isSubmitting || !email.trim()}>{isSubmitting ? 'Verzenden...' : 'Versturen'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Laden...</p>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground text-sm">Geen teamleden gevonden voor deze tenant.</p>
          ) : (
            <div className="space-y-3">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">{getInitials(m.full_name, m.email)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{m.full_name || m.email || 'Onbekend'}</p>
                      {m.full_name && m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                    </div>
                  </div>
                  <Badge variant="secondary">{roleLabelMap[m.role] || m.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Openstaande uitnodigingen ({invitations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">Rol: {roleLabelMap[inv.role] || inv.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => cancelInvite(inv.id)} title="Annuleren">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
