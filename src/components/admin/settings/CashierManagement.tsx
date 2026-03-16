import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { usePOSCashiers, type POSCashier } from '@/hooks/usePOSCashiers';

const AVATAR_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

/* ─── Create Dialog ─── */
export function CashierCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { createCashier } = usePOSCashiers();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);

  const reset = () => { setName(''); setPin(''); setColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]); };

  const handleCreate = async () => {
    if (!name.trim() || pin.length !== 4) return;
    await createCashier.mutateAsync({ displayName: name.trim(), pin, avatarColor: color });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kassamedewerker toevoegen</DialogTitle>
          <DialogDescription>Naam en een 4-cijferige PIN — meer is niet nodig.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Naam</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Jan" className="mt-1" />
          </div>
          <div>
            <Label>PIN (4 cijfers)</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="mt-1 text-center text-lg tracking-[0.5em]"
            />
          </div>
          <div>
            <Label>Kleur</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Annuleren</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || pin.length !== 4 || createCashier.isPending}>
            {createCashier.isPending ? 'Aanmaken...' : 'Toevoegen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit Dialog ─── */
export function CashierEditDialog({ cashier, onOpenChange }: { cashier: POSCashier | null; onOpenChange: (o: boolean) => void }) {
  const { updateCashier } = usePOSCashiers();
  const [name, setName] = useState(cashier?.display_name || '');
  const [color, setColor] = useState(cashier?.avatar_color || AVATAR_COLORS[0]);
  const [prevId, setPrevId] = useState<string | null>(null);

  // Sync state when cashier changes
  if (cashier && cashier.id !== prevId) {
    setPrevId(cashier.id);
    setName(cashier.display_name);
    setColor(cashier.avatar_color || AVATAR_COLORS[0]);
  }

  const handleUpdate = async () => {
    if (!cashier || !name.trim()) return;
    await updateCashier.mutateAsync({ id: cashier.id, displayName: name.trim(), avatarColor: color });
    onOpenChange(false);
  };

  return (
    <Dialog open={!!cashier} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Medewerker bewerken</DialogTitle>
          <DialogDescription>Pas naam of kleur aan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Naam</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Kleur</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={handleUpdate} disabled={!name.trim() || updateCashier.isPending}>
            {updateCashier.isPending ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── PIN Change Dialog ─── */
export function CashierPinDialog({ cashier, onOpenChange }: { cashier: POSCashier | null; onOpenChange: (o: boolean) => void }) {
  const { updatePin } = usePOSCashiers();
  const [newPin, setNewPin] = useState('');

  const handleUpdatePin = async () => {
    if (!cashier || newPin.length !== 4) return;
    await updatePin.mutateAsync({ cashierId: cashier.id, newPin });
    setNewPin('');
    onOpenChange(false);
  };

  return (
    <Dialog open={!!cashier} onOpenChange={(o) => { if (!o) setNewPin(''); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>PIN wijzigen</DialogTitle>
          <DialogDescription>Nieuwe 4-cijferige PIN voor {cashier?.display_name}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            className="text-center text-lg tracking-[0.5em]"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setNewPin(''); onOpenChange(false); }}>Annuleren</Button>
          <Button onClick={handleUpdatePin} disabled={newPin.length !== 4 || updatePin.isPending}>
            {updatePin.isPending ? 'Opslaan...' : 'PIN Opslaan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
