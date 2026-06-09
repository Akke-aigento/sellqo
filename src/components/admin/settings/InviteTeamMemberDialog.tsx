import { useEffect, useState } from 'react';
import {
  Mail, UserPlus, Calculator, Warehouse, Eye, Shield, UserCog, Megaphone,
  Loader2, CheckCircle2, Info, AlertTriangle,
} from 'lucide-react';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useTeamInvitations, InvitationRole } from '@/hooks/useTeamInvitations';

interface RoleOption {
  value: InvitationRole;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const roleOptions: RoleOption[] = [
  { value: 'tenant_admin', label: 'Admin', description: 'Volledige toegang, inclusief instellingen en teamleden', icon: Shield },
  { value: 'staff', label: 'Medewerker', description: 'Producten, orders en klanten beheren', icon: UserCog },
  { value: 'accountant', label: 'Boekhouder', description: 'Facturen, rapporten, BTW en financiële gegevens', icon: Calculator },
  { value: 'warehouse', label: 'Magazijn', description: 'Voorraad, verzending en pakbonnen', icon: Warehouse },
  { value: 'marketing', label: 'Marketing', description: 'Campagnes, kortingen, ads, CMS en SEO — geen financiële data', icon: Megaphone },
  { value: 'viewer', label: 'Kijker', description: 'Alleen lezen, geen wijzigingen mogelijk', icon: Eye },
];

type CheckResult = {
  accountExists: boolean;
  alreadyMember: boolean;
  hasPendingInvite: boolean;
  pendingInviteId: string | null;
};

interface InviteTeamMemberDialogProps {
  trigger?: React.ReactNode;
  onInvited?: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteTeamMemberDialog({ trigger, onInvited }: InviteTeamMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('staff');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  const { sendInvitation, resendInvitation } = useTeamInvitations({ statusFilter: 'all' });
  const { enforceLimit } = useUsageLimits();
  const { currentTenant } = useTenant();

  // Debounced email check
  useEffect(() => {
    const trimmed = email.trim();
    setCheckResult(null);
    if (!open || !trimmed || !EMAIL_RE.test(trimmed) || !currentTenant?.id) {
      setChecking(false);
      return;
    }
    setChecking(true);
    const handle = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-invite-email', {
          body: { email: trimmed, tenant_id: currentTenant.id },
        });
        if (error || data?.error) throw new Error(error?.message || data?.error);
        setCheckResult({
          accountExists: !!data.accountExists,
          alreadyMember: !!data.alreadyMember,
          hasPendingInvite: !!data.hasPendingInvite,
          pendingInviteId: data.pendingInviteId ?? null,
        });
      } catch (e) {
        setCheckResult(null);
      } finally {
        setChecking(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [email, open, currentTenant?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (checkResult?.alreadyMember) return;

    const limitResult = await enforceLimit('users');
    if (!limitResult.allowed) return;

    setIsSubmitting(true);
    const success = await sendInvitation(email.trim(), role);
    setIsSubmitting(false);

    if (success) {
      setEmail('');
      setRole('staff');
      setCheckResult(null);
      setOpen(false);
      onInvited?.();
    }
  };

  const handleResendPending = async () => {
    if (!checkResult?.pendingInviteId) return;
    setIsSubmitting(true);
    const ok = await resendInvitation(checkResult.pendingInviteId);
    setIsSubmitting(false);
    if (ok) {
      setEmail('');
      setCheckResult(null);
      setOpen(false);
      onInvited?.();
    }
  };

  const selectedRole = roleOptions.find(r => r.value === role);
  const disabled = isSubmitting || !email.trim() || checking || checkResult?.alreadyMember === true;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Mail className="h-4 w-4 mr-2" />
            Uitnodigen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Teamlid uitnodigen
          </DialogTitle>
          <DialogDescription>
            Stuur een uitnodiging per e-mail. De ontvanger kan een account aanmaken of inloggen om deel te nemen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres</Label>
              <Input
                id="email"
                type="email"
                placeholder="collega@voorbeeld.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <EmailCheckBanner
                checking={checking}
                result={checkResult}
                onResend={handleResendPending}
                resending={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as InvitationRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRole && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <selectedRole.icon className="h-4 w-4" />
                  {selectedRole.label}
                </div>
                <p className="text-muted-foreground">{selectedRole.description}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Annuleren
            </Button>
            <Button type="submit" disabled={disabled}>
              {isSubmitting ? 'Verzenden...' : 'Uitnodiging versturen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmailCheckBanner({
  checking, result, onResend, resending,
}: {
  checking: boolean;
  result: CheckResult | null;
  onResend: () => void;
  resending: boolean;
}) {
  if (checking) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        E-mail controleren...
      </div>
    );
  }
  if (!result) return null;

  if (result.alreadyMember) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <span>Deze gebruiker is al lid van dit team.</span>
      </div>
    );
  }
  if (result.hasPendingInvite) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/5 p-2 text-xs">
        <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          Er staat al een pending uitnodiging voor dit adres.{' '}
          <button type="button" className="underline font-medium" onClick={onResend} disabled={resending}>
            {resending ? 'Verzenden...' : 'Verzend opnieuw'}
          </button>
        </div>
      </div>
    );
  }
  if (result.accountExists) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/5 p-2 text-xs">
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <span>Deze gebruiker heeft al een SellQo-account — krijgt één-klik bevestiging.</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-md border border-blue-500/40 bg-blue-500/5 p-2 text-xs">
      <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
      <span>Nieuwe gebruiker — krijgt account-aanmaak via e-mail (code-verificatie).</span>
    </div>
  );
}