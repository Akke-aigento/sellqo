import { useState } from 'react';
import { Mail, UserPlus, Calculator, Warehouse, Eye, Shield, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeamInvitations, InvitationRole } from '@/hooks/useTeamInvitations';

interface RoleOption {
  value: InvitationRole;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const roleOptions: RoleOption[] = [
  {
    value: 'tenant_admin',
    label: 'Admin',
    description: 'Volledige toegang, inclusief instellingen en teamleden',
    icon: Shield,
  },
  {
    value: 'staff',
    label: 'Medewerker',
    description: 'Producten, orders en klanten beheren',
    icon: UserCog,
  },
  {
    value: 'accountant',
    label: 'Boekhouder',
    description: 'Facturen, rapporten, BTW en financiële gegevens',
    icon: Calculator,
  },
  {
    value: 'warehouse',
    label: 'Magazijn',
    description: 'Voorraad, verzending en pakbonnen',
    icon: Warehouse,
  },
  {
    value: 'viewer',
    label: 'Kijker',
    description: 'Alleen lezen, geen wijzigingen mogelijk',
    icon: Eye,
  },
];

interface InviteTeamMemberDialogProps {
  trigger?: React.ReactNode;
}

export function InviteTeamMemberDialog({ trigger }: InviteTeamMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('staff');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { sendInvitation } = useTeamInvitations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    const success = await sendInvitation(email.trim(), role);
    setIsSubmitting(false);

    if (success) {
      setEmail('');
      setRole('staff');
      setOpen(false);
    }
  };

  const selectedRole = roleOptions.find(r => r.value === role);

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
      <DialogContent className="sm:max-w-[425px]">
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={isSubmitting || !email.trim()}>
              {isSubmitting ? 'Verzenden...' : 'Uitnodiging versturen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
