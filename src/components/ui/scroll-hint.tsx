import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useScrollHint } from '@/hooks/use-scroll-hint';

/**
 * De pijltjes die over een scroller heen komen.
 *
 * Ze staan bewust búiten de scroller, zodat de mask ze niet raakt: ze blijven
 * volledig zichtbaar op de plek waar de inhoud juist wegvalt. De ouder moet dus
 * `position: relative` zijn en zelf niet scrollen.
 *
 * De pijltjes staan stil. Een blijvend pulserend element pal naast aantikbare
 * knoppen trekt de aandacht juist wég van de inhoud; wil je het toch, dan is
 * `motion-safe:animate-pulse` genoeg (en alleen achter `motion-safe:`, zodat
 * prefers-reduced-motion gerespecteerd blijft).
 */
export function ScrollHintArrows({
  canScrollLeft,
  canScrollRight,
}: {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}) {
  return (
    <>
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
    </>
  );
}

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
 * Let op: gebruik dit component *niet* om een `<Table>` heen. Die rendert zijn
 * eigen `overflow-x-auto`-wrapper, dus de binnenste div scrolt en deze niet —
 * je krijgt dan nooit een pijltje te zien. Zet daar `scrollHint` op de `Table`
 * zelf.
 */
export function ScrollHint({ children, className }: ScrollHintProps) {
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const { canScrollLeft, canScrollRight, maskImage } = useScrollHint(scrollerRef);

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
          className="no-scrollbar overflow-x-auto"
          style={{ maskImage, WebkitMaskImage: maskImage }}
        >
          {children}
        </div>

        <ScrollHintArrows canScrollLeft={canScrollLeft} canScrollRight={canScrollRight} />
      </div>
    </div>
  );
}
