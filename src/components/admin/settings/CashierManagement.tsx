import { useState } from 'react';
import { Plus, Edit2, Trash2, KeyRound, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { usePOSCashiers, type POSCashier } from '@/hooks/usePOSCashiers';

const AVATAR_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

export function CashierManagement() {
  const { allCashiers, isLoading, createCashier, updateCashier, updatePin } = usePOSCashiers();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState<POSCashier | null>(null);
  const [editCashier, setEditCashier] = useState<POSCashier | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [newPin, setNewPin] = useState('');

  const resetForm = () => { setName(''); setPin(''); setColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]); };

  const handleCreate = async () => {
    if (!name.trim() || pin.length !== 4) return;
    await createCashier.mutateAsync({ displayName: name.trim(), pin, avatarColor: color });
    resetForm();
    setShowCreateDialog(false);
  };

  const handleUpdate = async () => {
    if (!editCashier || !name.trim()) return;
    await updateCashier.mutateAsync({ id: editCashier.id, displayName: name.trim(), avatarColor: color });
    setEditCashier(null);
    resetForm();
  };

  const handleUpdatePin = async () => {
    if (!showPinDialog || newPin.length !== 4) return;
    await updatePin.mutateAsync({ cashierId: showPinDialog.id, newPin });
    setShowPinDialog(null);
    setNewPin('');
  };

  const toggleActive = async (cashier: POSCashier) => {
    await updateCashier.mutateAsync({ id: cashier.id, isActive: !cashier.is_active });
  };

  const openEdit = (c: POSCashier) => {
    setName(c.display_name);
    setColor(c.avatar_color || AVATAR_COLORS[0]);
    setEditCashier(c);
  };

  const getInitials = (n: string) => n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Kassa medewerkers</CardTitle>
              <CardDescription>
                Medewerkers die de kassa gebruiken met een PIN-code — geen account nodig
              </CardDescription>
            </div>
          </div>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" />Toevoegen
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Laden...</p>
        ) : allCashiers.length === 0 ? (
          <div className="text-center py-8">
            <KeyRound className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nog geen kassamedewerkers</h3>
            <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
              Voeg medewerkers toe zodat zij de kassa kunnen gebruiken met alleen hun naam en een 4-cijferige PIN.
            </p>
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="mr-2 h-4 w-4" />Eerste medewerker toevoegen
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {allCashiers.map((c) => (
              <div key={c.id} className={`flex items-center gap-4 p-3 rounded-lg border ${!c.is_active ? 'opacity-50' : ''}`}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: c.avatar_color || '#3b82f6' }}
                >
                  {getInitials(c.display_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.is_active ? 'Actief' : 'Inactief'}
                  </p>
                </div>
                {!c.is_active && <Badge variant="outline">Inactief</Badge>}
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} title="Bewerken">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPinDialog(c)} title="PIN wijzigen">
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(c)} title={c.is_active ? 'Deactiveren' : 'Activeren'}>
                    {c.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
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
              <div className="flex gap-2 mt-2">
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
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annuleren</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || pin.length !== 4 || createCashier.isPending}>
              {createCashier.isPending ? 'Aanmaken...' : 'Toevoegen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editCashier} onOpenChange={(o) => { if (!o) { setEditCashier(null); resetForm(); } }}>
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
              <div className="flex gap-2 mt-2">
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
            <Button variant="outline" onClick={() => { setEditCashier(null); resetForm(); }}>Annuleren</Button>
            <Button onClick={handleUpdate} disabled={!name.trim() || updateCashier.isPending}>
              {updateCashier.isPending ? 'Opslaan...' : 'Opslaan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIN Change Dialog */}
      <Dialog open={!!showPinDialog} onOpenChange={(o) => { if (!o) { setShowPinDialog(null); setNewPin(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>PIN wijzigen</DialogTitle>
            <DialogDescription>Nieuwe 4-cijferige PIN voor {showPinDialog?.display_name}</DialogDescription>
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
            <Button variant="outline" onClick={() => { setShowPinDialog(null); setNewPin(''); }}>Annuleren</Button>
            <Button onClick={handleUpdatePin} disabled={newPin.length !== 4 || updatePin.isPending}>
              {updatePin.isPending ? 'Opslaan...' : 'PIN Opslaan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
