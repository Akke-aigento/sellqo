// HORECA-NU-1 — één grote tegel van het Nu-paneel (beheer en kassa): titel, de huidige stand groot
// ("AAN", "DICHT", "3 op"), met één tik te bedienen. Kan iets niet, dan staat de tegel uitgegrijsd met de
// reden (en zo mogelijk een link die het oplost): nooit een tegel die pas na de tik "geen rechten" zegt.
import { forwardRef, type ComponentType, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NowTone = 'on' | 'off' | 'alert' | 'neutral';

const TONE: Record<NowTone, string> = {
  on: 'border-emerald-500/70 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-50',
  off: 'border-border bg-card text-foreground',
  alert: 'border-orange-400 bg-orange-50 text-orange-950 dark:bg-orange-950/60 dark:text-orange-50',
  neutral: 'border-border bg-card text-foreground',
};

export interface NowTileProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  state: string;
  tone: NowTone;
  /** Extra regel onder de stand ("tot 19:45", "Soep, Stoofvlees"). */
  sub?: string | null;
  busy?: boolean;
  disabled?: boolean;
  /** Waarom de tegel niet kan (met link). Enkel bij disabled. */
  reason?: ReactNode;
  pressed?: boolean;
  onClick?: () => void;
  testId?: string;
}

export const NowTile = forwardRef<HTMLButtonElement, NowTileProps>(function NowTile(
  { icon: Icon, title, state, tone, sub, busy, disabled, reason, pressed, onClick, testId, ...rest }, ref,
) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        ref={ref}
        type="button"
        data-testid={testId}
        aria-pressed={pressed}
        disabled={disabled || busy}
        onClick={onClick}
        // Radix-triggers (DropdownMenuTrigger asChild) geven hun eigen props door.
        {...rest}
        className={cn(
          'flex min-h-[104px] w-full min-w-0 flex-col justify-between gap-2 rounded-2xl border-2 p-3 text-left transition active:scale-[0.98] md:p-4',
          TONE[tone],
          disabled && 'cursor-not-allowed opacity-60 active:scale-100',
        )}
      >
        {/* Op 390 px past een lange titel niet op één regel: twee regels, nooit afgekapt midden in een woord. */}
        <span className="flex items-start gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
          {busy ? <Loader2 className="mt-px h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Icon className="mt-px h-4 w-4 shrink-0" aria-hidden />}
          <span className="line-clamp-2 min-w-0 break-words">{title}</span>
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2 break-words text-lg font-extrabold leading-tight md:text-2xl">{state}</span>
          {sub ? <span className="line-clamp-2 text-xs opacity-80">{sub}</span> : null}
        </span>
      </button>
      {disabled && reason ? <p className="px-1 text-xs text-muted-foreground">{reason}</p> : null}
    </div>
  );
});
