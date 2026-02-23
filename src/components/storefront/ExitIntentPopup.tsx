import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ExitIntentPopupProps {
  tenantSlug: string;
  incentiveText?: string | null;
}

const SESSION_KEY = 'exit-intent-shown';

export function ExitIntentPopup({ tenantSlug, incentiveText }: ExitIntentPopupProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = `${SESSION_KEY}-${tenantSlug}`;
    if (sessionStorage.getItem(key)) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        sessionStorage.setItem(key, '1');
        setVisible(true);
      }
    };

    // Only attach after a delay so it doesn't trigger immediately
    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, 5000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [tenantSlug]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4 p-8 text-center relative">
        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-bold mb-3">Wacht even!</h2>
        <p className="text-muted-foreground mb-6">
          {incentiveText || 'Schrijf je in voor onze nieuwsbrief en ontvang exclusieve aanbiedingen!'}
        </p>

        <div className="flex gap-2 max-w-sm mx-auto">
          <input
            type="email"
            placeholder="je@email.nl"
            className="flex-1 rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm"
          />
          <Button onClick={() => setVisible(false)}>
            Aanmelden
          </Button>
        </div>

        <button
          onClick={() => setVisible(false)}
          className="mt-4 text-sm text-muted-foreground hover:underline"
        >
          Nee bedankt
        </button>
      </div>
    </div>
  );
}
