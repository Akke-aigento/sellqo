import { useState } from 'react';
import { Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useTeamInvitations, type InvitationRole } from '@/hooks/useTeamInvitations';
import { usePOSCashiers } from '@/hooks/usePOSCashiers';

type MemberType = null | 'email' | 'cashier';

const ROLE_OPTIONS: { value: InvitationRole; label: string }[] = [
  { value: 'tenant_admin', label: 'Admin' },
  { value: 'staff', label: 'Medewerker' },
  { value: 'accountant', label: 'Boekhouder' },
  { value: 'warehouse', label: 'Magazijn' },
  { value: 'viewer', label: 'Kijker' },
];

const AVATAR_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

interface AddTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTeamMemberDialog({ open, onOpenChange }: AddTeamMemberDialogProps) {
  const [type, setType] = useState<MemberType>(null);

  // Email form
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('staff');
  const { sendInvitation } = useTeamInvitations();

  // Cashier form
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  const { createCashier } = usePOSCashiers();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setType(null);
    setEmail('');
    setRole('staff');
    setName('');
    setPin('');
    setColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleSubmitEmail = async () => {
    if (!email.trim()) return;
    setIsSubmitting(true);
    const success = await sendInvitation(email.trim(), role);
    setIsSubmitting(false);
    if (success) handleClose(false);
  };

  const handleSubmitCashier = async () => {
    if (!name.trim() || pin.length !== 4) return;
    setIsSubmitting(true);
    try {
      await createCashier.mutateAsync({ displayName: name.trim(), pin, avatarColor: color });
      handleClose(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Medewerker toevoegen</DialogTitle>
          <DialogDescription>
            {!type && 'Kies hoe je een medewerker wilt toevoegen.'}
            {type === 'email' && 'Stuur een uitnodiging per e-mail.'}
            {type === 'cashier' && 'Maak een kassamedewerker aan met PIN-code.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Type selection */}
        {!type && (
          <div className="grid grid-cols-2 gap-3 py-4">
            <button
              onClick={() => setType('email')}
              className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-border bg-card hover:border-primary hover:bg-accent transition-all text-center"
            >
              <div className="p-3 rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Met e-mail</p>
                <p className="text-xs text-muted-foreground mt-1">Uitnodiging versturen</p>
              </div>
            </button>
            <button
              onClick={() => setType('cashier')}
              className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-border bg-card hover:border-primary hover:bg-accent transition-all text-center"
            >
              <div className="p-3 rounded-full bg-primary/10">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Kassa (PIN)</p>
                <p className="text-xs text-muted-foreground mt-1">Geen account nodig</p>
              </div>
            </button>
          </div>
        )}

        {/* Step 2a: Email invitation form */}
        {type === 'email' && (
          <form onSubmit={(e) => { e.preventDefault(); handleSubmitEmail(); }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-email">E-mailadres</Label>
                <Input
                  id="add-email"
                  type="email"
                  placeholder="collega@voorbeeld.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-role">Rol</Label>
                <Select value={role} onValueChange={(v) => setRole(v as InvitationRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setType(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Terug
              </Button>
              <Button type="submit" disabled={isSubmitting || !email.trim()}>
                {isSubmitting ? 'Verzenden...' : 'Uitnodiging versturen'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* Step 2b: Cashier form */}
        {type === 'cashier' && (
          <form onSubmit={(e) => { e.preventDefault(); handleSubmitCashier(); }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Naam</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Bijv. Jan"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>PIN (4 cijfers)</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="text-center text-lg tracking-[0.5em]"
                />
              </div>
              <div className="space-y-2">
                <Label>Kleur</Label>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setType(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Terug
              </Button>
              <Button type="submit" disabled={isSubmitting || !name.trim() || pin.length !== 4}>
                {isSubmitting ? 'Aanmaken...' : 'Toevoegen'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
