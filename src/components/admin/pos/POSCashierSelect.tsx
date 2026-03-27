import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check } from 'lucide-react';
import type { POSCashier } from '@/hooks/usePOSCashiers';

interface POSCashierSelectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashiers: POSCashier[];
  onVerifyPin: (cashierId: string, pin: string) => Promise<boolean>;
  onCashierSelected: (cashier: POSCashier) => void;
  dismissable?: boolean;
}

export function POSCashierSelect({
  open,
  onOpenChange,
  cashiers,
  onVerifyPin,
  onCashierSelected,
  dismissable = true,
}: POSCashierSelectProps) {
  const [selectedCashier, setSelectedCashier] = useState<POSCashier | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedCashier) {
      setPin('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [selectedCashier]);

  useEffect(() => {
    if (!open) {
      setSelectedCashier(null);
      setPin('');
      setError('');
    }
  }, [open]);

  const handlePinChange = async (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError('');

    if (digits.length === 4 && selectedCashier) {
      setVerifying(true);
      const ok = await onVerifyPin(selectedCashier.id, digits);
      setVerifying(false);
      if (ok) {
        onCashierSelected(selectedCashier);
        onOpenChange(false);
      } else {
        setError('Onjuiste PIN');
        setPin('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={dismissable ? onOpenChange : undefined}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={dismissable ? undefined : (e) => e.preventDefault()}
        onEscapeKeyDown={dismissable ? undefined : (e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{selectedCashier ? `PIN voor ${selectedCashier.display_name}` : 'Wie ben je?'}</DialogTitle>
          <DialogDescription>
            {selectedCashier ? 'Voer je 4-cijferige PIN in' : 'Selecteer je naam om in te loggen'}
          </DialogDescription>
        </DialogHeader>

        {!selectedCashier ? (
          /* Avatar grid */
          <div className="grid grid-cols-3 gap-3 py-4">
            {cashiers.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCashier(c)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-transparent hover:border-primary/50 hover:bg-accent transition-all"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: c.avatar_color || '#3b82f6' }}
                >
                  {getInitials(c.display_name)}
                </div>
                <span className="text-sm font-medium truncate max-w-full">{c.display_name}</span>
              </button>
            ))}
          </div>
        ) : (
          /* PIN entry */
          <div className="flex flex-col items-center gap-4 py-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl"
              style={{ backgroundColor: selectedCashier.avatar_color || '#3b82f6' }}
            >
              {getInitials(selectedCashier.display_name)}
            </div>

            {/* Hidden real input for keyboard */}
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              className="sr-only"
              autoFocus
            />

            {/* PIN dots display */}
            <div className="flex gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  onClick={() => inputRef.current?.focus()}
                  className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all cursor-text ${
                    i < pin.length
                      ? 'border-primary bg-primary/10'
                      : 'border-muted-foreground/30'
                  } ${error ? 'border-destructive animate-shake' : ''}`}
                >
                  {i < pin.length ? '•' : ''}
                </div>
              ))}
            </div>

            {verifying && (
              <p className="text-sm text-muted-foreground">Verifiëren...</p>
            )}
            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <Button variant="ghost" size="sm" onClick={() => setSelectedCashier(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Terug
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
