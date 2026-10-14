// MKT-3 — "Eén bestelling, overal tegelijk". Een korte, geanimeerde scène die toont hoe
// een bestelling in de webshop meteen in de rest van SellQo verschijnt: in de keuken, in
// de voorraad, aan de deur. Puur React/CSS (geen iframe, geen video): laadt meteen.
// Respecteert prefers-reduced-motion: dan staat de eindtoestand stil in beeld.
import { useEffect, useRef, useState } from 'react';
import { BellRing, Check, ChefHat, Package, QrCode, ScanLine, ShoppingBag, Ticket, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type SceneSector = 'retail' | 'horeca' | 'events';

// Stappen: 0 product · 1 knop ingedrukt · 2 besteld, verschijnt rechts · 3 verwerkt · 4 klaar
const STEP_MS = [1500, 700, 1700, 1700, 2600];
export const SCENE_LOOP_MS = STEP_MS.reduce((a, b) => a + b, 0);
const LAST = STEP_MS.length - 1;

const ICONS: Record<SceneSector, { product: LucideIcon; screen: LucideIcon }> = {
  retail: { product: ShoppingBag, screen: Package },
  horeca: { product: UtensilsCrossed, screen: ChefHat },
  events: { product: Ticket, screen: ScanLine },
};
// Echte foto's uit de demowinkels, verkleind geserveerd (Supabase image transformations).
const SB = 'https://gczmfcabnoofnmfpzeop.supabase.co/storage/v1/render/image/public/ai-images';
const PHOTO: Partial<Record<SceneSector, string>> = {
  retail: `${SB}/0e06e256-308a-4903-8b27-64959418a9ad/nano/a32fbfd1-f803-47e9-a11a-4f59fc3e3f93.jpg?width=480&quality=70`,
  horeca: `${SB}/7879b472-2672-4212-8531-4c587870752d/nano/605861ed-fb9c-4685-8dde-74fcafaaee4f.jpg?width=480&quality=70`,
};
const TINT: Record<SceneSector, string> = {
  retail: 'from-[#e8eef6] to-[#d5e0ee]',
  horeca: 'from-[#fde7dc] to-[#f9cdb7]',
  events: 'from-[#e5e7f8] to-[#cfd3f1]',
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!m) return;
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

export function LiveScene({ sector, paused = false, onLoopEnd, className }: {
  sector: SceneSector; paused?: boolean; onLoopEnd?: () => void; className?: string;
}) {
  const { t } = useTranslation();
  const k = (x: string, o?: Record<string, unknown>) => t(`landing.scene.${sector}.${x}`, o);
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => { setStep(reduced ? LAST : 0); }, [sector, reduced]);
  useEffect(() => {
    if (reduced || paused) return;
    const id = window.setTimeout(() => {
      if (step === LAST) { onLoopEnd?.(); setStep(0); } else setStep(step + 1);
    }, STEP_MS[step]);
    return () => window.clearTimeout(id);
  }, [step, paused, reduced, onLoopEnd]);

  // De scène is ontworpen op 560 × 440 en schaalt als geheel mee op smalle schermen,
  // zodat telefoon en scherm in verhouding blijven.
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / 560)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const P = ICONS[sector].product;
  const S = ICONS[sector].screen;
  const ordered = step >= 2;
  const processed = step >= 3;
  const done = step >= 4;

  return (
    <div ref={wrap} className={cn('mx-auto w-full max-w-[560px] overflow-hidden', className)} style={{ height: 440 * scale }} aria-hidden="true">
    <div className="relative h-[440px] w-[560px] origin-top-left select-none" style={{ transform: scale < 1 ? `scale(${scale})` : undefined }}>
      {/* Beheerscherm (achter) */}
      <div className="absolute right-0 top-6 w-[78%] overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgba(4,16,40,0.55)] ring-1 ring-white/10">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <S className="h-4 w-4 text-[#1E3A5F]" />
          <span className="text-sm font-semibold text-[#1E3A5F]">{k('screen_title')}</span>
          <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{t('landing.scene.live')}</span>
        </div>
        <div className="space-y-2.5 p-4 pl-[34%]">
          {[k('row_old_1'), k('row_old_2')].map((r) => (
            <div key={r} className="rounded-lg border border-slate-100 px-3 py-2 text-xs text-slate-400">{r}</div>
          ))}
          <div className={cn('rounded-lg border px-3 py-2.5 transition-all duration-500',
            ordered ? 'translate-x-0 border-[#FF6B35]/40 bg-[#FF6B35]/[0.06] opacity-100' : 'translate-x-6 border-transparent opacity-0')}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[#1E3A5F]">{k('row_new')}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors duration-300',
                done ? 'bg-emerald-100 text-emerald-700' : processed ? 'bg-amber-100 text-amber-800' : 'bg-[#FF6B35] text-white')}>
                {done ? k('status_done') : processed ? k('status_busy') : k('status_new')}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{k('row_new_detail')}</p>
          </div>
          <div className={cn('flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs transition-opacity duration-500', processed ? 'opacity-100' : 'opacity-0')}>
            <span className="text-slate-500">{k('metric_label')}</span>
            <span className="font-semibold tabular-nums text-[#1E3A5F]">
              <span className={cn('transition-colors', done ? 'text-slate-400 line-through' : '')}>{k('metric_before')}</span>
              {done ? <span className="ml-1.5">{k('metric_after')}</span> : null}
            </span>
          </div>
        </div>
      </div>

      {/* Telefoon van de klant (voor) */}
      <div className="absolute bottom-0 left-0 w-[44%] rounded-[2rem] bg-[#0d1b30] p-2 shadow-[0_30px_60px_-15px_rgba(4,16,40,0.7)] ring-1 ring-white/10">
        <div className="overflow-hidden rounded-[1.6rem] bg-white">
          <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
            <span className="text-xs font-bold text-[#1E3A5F]">{k('shop')}</span>
            <span className="relative">
              <ShoppingBag className="h-4 w-4 text-[#1E3A5F]" />
              <span className={cn('absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FF6B35] text-[9px] font-bold text-white transition-transform duration-300', step >= 1 && !ordered ? 'scale-100' : 'scale-0')}>1</span>
            </span>
          </div>
          <div className="relative h-[300px] px-3.5 pb-3.5">
            {/* product */}
            <div className={cn('absolute inset-x-3.5 top-0 transition-all duration-500', ordered ? '-translate-y-4 opacity-0' : 'opacity-100')}>
              <div className={cn('flex h-32 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br', TINT[sector])}>
                {PHOTO[sector] ? <img src={PHOTO[sector]} alt="" className="h-full w-full object-cover" /> : <P className="h-12 w-12 text-[#1E3A5F]/70" strokeWidth={1.4} />}
              </div>
              <p className="mt-3 text-sm font-bold text-[#1E3A5F]">{k('product')}</p>
              <p className="text-xs text-slate-500">{k('product_detail')}</p>
              <p className="mt-1 text-sm font-bold text-[#1E3A5F]">{k('price')}</p>
              <div className={cn('mt-3 rounded-lg py-2.5 text-center text-xs font-bold text-white transition-transform duration-150',
                step === 1 ? 'scale-95 bg-[#e85a28]' : 'bg-[#FF6B35]')}>{k('button')}</div>
            </div>
            {/* bevestiging */}
            <div className={cn('absolute inset-x-3.5 top-2 flex flex-col items-center text-center transition-all duration-500', ordered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0')}>
              {sector === 'events' ? (
                <div className="flex h-28 w-28 items-center justify-center rounded-xl border-2 border-dashed border-[#1E3A5F]/25">
                  <QrCode className="h-16 w-16 text-[#1E3A5F]" strokeWidth={1.3} />
                </div>
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-6 w-6" /></span>
              )}
              <p className="mt-3 text-sm font-bold text-[#1E3A5F]">{k('confirm_title')}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{k('confirm_text')}</p>
              <div className="mt-4 w-full rounded-lg bg-slate-50 px-3 py-2.5 text-left">
                <div className="flex items-center justify-between text-xs"><span className="text-slate-500">{k('product')}</span><span className="font-semibold text-[#1E3A5F]">{k('price')}</span></div>
                <div className="mt-1 text-[11px] text-slate-400">{k('product_detail')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Melding die het verhaal afmaakt */}
      <div className={cn('absolute right-2 top-[62%] flex max-w-[60%] items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 shadow-xl ring-1 ring-black/5 transition-all duration-500',
        done ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0')}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F] text-white"><BellRing className="h-3.5 w-3.5" /></span>
        <span className="text-xs font-medium leading-snug text-[#1E3A5F]">{k('toast')}</span>
      </div>
    </div>
    </div>
  );
}
