import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollHintProps {
  /** De rij die horizontaal scrollt; krijgt zelf géén overflow-klasse meer mee. */
  children: React.ReactNode;
  /** Klassen voor de buitenste wrapper: marges, padding, breakpoint-verberging. */
  className?: string;
  /**
   * Volledige Tailwind-klasse voor de kleur waar de fade naartoe loopt. Moet
   * matchen met de achtergrond waarop de rij staat, anders zie je een randje.
   *
   * Voluit meegeven (`to-card`, niet `to-${x}`): de JIT scant de broncode op
   * letterlijke klassenamen en genereert samengestelde namen niet.
   */
  fadeTo?: string;
}

/**
 * Laat zien dat een horizontale rij verder loopt dan het scherm.
 *
 * Een rij die netjes tegen de schermrand eindigt ziet eruit als een complete
 * rij; dat er nog items achter zitten is onzichtbaar. Dit component legt daarom
 * een fade met een pijltje over de kant waar nog inhoud staat — en haalt hem
 * weg zodra dat niet meer zo is. Past alles, dan staat er niets.
 *
 * ScrollHint is zelf de scroll-container: de wrapper eromheen moet
 * `position: relative` houden zonder mee te scrollen, anders schuiven de fades
 * met de inhoud mee het beeld uit. Vandaar twee elementen in plaats van één.
 *
 * De pijltjes staan bewust stil. Een blijvend pulserend element pal naast
 * aantikbare knoppen trekt de aandacht juist wég van de inhoud; wil je het
 * toch, dan is `motion-safe:animate-pulse` genoeg (en alleen achter
 * `motion-safe:`, zodat prefers-reduced-motion gerespecteerd blijft).
 */
export function ScrollHint({ children, className, fadeTo = 'to-background' }: ScrollHintProps) {
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    // De marge van 1px vangt subpixel-afronding op. Zonder dat blijft de
    // rechterpijl aan het eind van de rij hangen, want scrollLeft + clientWidth
    // komt daar op een fractie na scrollWidth uit.
    const measure = () => {
      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measure();
    el.addEventListener('scroll', onScroll, { passive: true });

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
      // Ook het kind observeren: wordt de inhoud breder terwijl de container
      // even breed blijft (een item erbij, een label dat langer wordt), dan
      // verandert alleen scrollWidth en vuurt de observer op de container niet.
      if (el.firstElementChild) ro.observe(el.firstElementChild);
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
      ro?.disconnect();
    };
  }, []);

  return (
    <div className={cn('relative', className)}>
      <div ref={scrollerRef} className="overflow-x-auto">
        {children}
      </div>

      {canScrollLeft && (
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 flex w-8 items-center justify-start',
            'bg-gradient-to-l from-transparent',
            fadeTo
          )}
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {canScrollRight && (
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 flex w-8 items-center justify-end',
            'bg-gradient-to-r from-transparent',
            fadeTo
          )}
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
