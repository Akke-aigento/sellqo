import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SandboxBannerProps {
  isDemo: boolean;
  className?: string;
}

/**
 * Visual indicator for demo/sandbox tenants. Renders a sticky amber banner
 * at the top of the parent container. Dismiss is in-memory only, so the
 * banner reappears on every page reload (per spec).
 */
export function SandboxBanner({ isDemo, className }: SandboxBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!isDemo || dismissed) return null;

  return (
    <div
      role="status"
      className={cn(
        'sticky top-0 z-50 w-full border-b px-4 py-2 text-sm text-center',
        'bg-amber-100 dark:bg-amber-950/40',
        'border-amber-300 dark:border-amber-800',
        'text-amber-900 dark:text-amber-100',
        'flex items-center justify-center gap-2',
        className
      )}
    >
      <span className="flex-1">
        🧪 <strong>SANDBOX MODE</strong> — dit is een testomgeving. Bestellingen
        gebruiken Stripe testkaarten, er worden geen echte betalingen verwerkt.
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
        aria-label="Sluiten"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}