import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Over hoeveel pixels de inhoud aan een scrollbare kant wegvalt. Breed genoeg
 * om als verloop te lezen, smal genoeg om niet een half label op te eten.
 */
const FADE_PX = 48;

interface ScrollHintProps {
  /** De rij die horizontaal scrollt; krijgt zelf géén overflow-klasse meer mee. */
  children: React.ReactNode;
  /** Klassen voor de buitenste wrapper: marges, padding, breakpoint-verberging. */
  className?: string;
}

/**
 * Laat zien dat een horizontale rij verder loopt dan het scherm.
 *
 * Een rij die netjes tegen de schermrand eindigt ziet eruit als een complete
 * rij; dat er nog items achter zitten is onzichtbaar. Dit component laat de
 * inhoud daarom wegvagen aan de kant waar nog meer staat, met een pijltje
 * erbij — en haalt dat weg zodra het niet meer zo is. Past alles, dan staat er
 * niets.
 *
 * Het verloop is een `mask-image` op de scroller, en nadrukkelijk niet een
 * gradient in de achtergrondkleur eroverheen. Dat laatste is geprobeerd en zag
 * er fout uit: een knop met een eigen vulling wordt er niet door verborgen maar
 * *gebleekt*, want je legt de paginakleur over een andere kleur heen. Een mask
 * maakt de inhoud echt doorzichtig, dus het werkt op elke ondergrond — kaart,
 * paneel, gekleurde sectie — zonder dat een aanroeper een kleur hoeft door te
 * geven. Beide schrijfwijzen worden gezet: de WKWebView van de native app
 * kent `-webkit-mask-image` het langst.
 *
 * ScrollHint is zelf de scroll-container: de wrapper eromheen moet
 * `position: relative` houden zonder mee te scrollen, anders schuiven de
 * pijltjes met de inhoud mee het beeld uit. Vandaar twee elementen in plaats
 * van één.
 *
 * De pijltjes staan bewust stil. Een blijvend pulserend element pal naast
 * aantikbare knoppen trekt de aandacht juist wég van de inhoud; wil je het
 * toch, dan is `motion-safe:animate-pulse` genoeg (en alleen achter
 * `motion-safe:`, zodat prefers-reduced-motion gerespecteerd blijft).
 */
export function ScrollHint({ children, className }: ScrollHintProps) {
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

  // Alleen een scrollbare kant vervaagt. Past alles, dan blijft de mask weg en
  // is er geen enkel verschil met een gewone rij.
  const stops = [
    canScrollLeft ? `transparent 0, #000 ${FADE_PX}px` : '#000 0',
    canScrollRight ? `#000 calc(100% - ${FADE_PX}px), transparent 100%` : '#000 100%',
  ].join(', ');
  const maskImage =
    canScrollLeft || canScrollRight ? `linear-gradient(to right, ${stops})` : undefined;

  return (
    <div className={className}>
      {/*
        `relative` zit bewust op een eigen laag tussen de className van de
        aanroeper en de scroller. Stond het op de buitenste div, dan spant
        inset-y-0 mee over diens padding (Storefront geeft pb-2 mee) en zakt het
        pijltje de helft daarvan omlaag, weg van het midden van de rij. Padding
        van een aanroeper hoort de hint nooit te verschuiven.
      */}
      <div className="relative">
        <div
          ref={scrollerRef}
          className="overflow-x-auto"
          style={{ maskImage, WebkitMaskImage: maskImage }}
        >
          {children}
        </div>

        {/*
          De pijltjes staan buiten de scroller, dus de mask raakt ze niet: ze
          blijven volledig zichtbaar op de plek waar de inhoud juist wegvalt.
        */}
        {canScrollLeft && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex w-6 items-center justify-start"
          >
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/70" />
          </div>
        )}

        {canScrollRight && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 flex w-6 items-center justify-end"
          >
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70" />
          </div>
        )}
      </div>
    </div>
  );
}
