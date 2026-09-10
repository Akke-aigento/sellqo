import * as React from 'react';

/**
 * Over hoeveel pixels de inhoud aan een scrollbare kant wegvalt. Breed genoeg
 * om als verloop te lezen, smal genoeg om niet een half label op te eten.
 */
const FADE_PX = 48;

/**
 * Meet of een scroll-container aan een van beide kanten nog inhoud verbergt, en
 * geeft de bijbehorende `mask-image` terug.
 *
 * Apart van ScrollHint omdat niet elke scroller er zelf een kan zijn: `Table`
 * rendert zijn eigen `overflow-x-auto`-wrapper, dus een ScrollHint eromheen
 * scrolt nooit en toont dus ook nooit iets. Met deze hook kan dat component de
 * hint op zijn eigen wrapper zetten. Gemeten voordat dit bestond: de buitenste
 * scroller kwam op 293/293 uit terwijl de binnenste 293→640 liep.
 *
 * De marge van 1px vangt subpixel-afronding op. Zonder dat blijft de rechterpijl
 * aan het eind van de rij hangen, want `scrollLeft + clientWidth` komt daar op
 * een fractie na `scrollWidth` uit.
 */
export function useScrollHint(ref: React.RefObject<HTMLElement>, enabled = true) {
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    // `enabled` bestaat voor Table: dat component roept deze hook onvoorwaardelijk
    // aan (hooks mogen niet achter een if), maar 66 bestanden gebruiken Table
    // zonder hint. Zonder deze uitweg zou elk van die tabellen een
    // ResizeObserver optuigen en bij elke scroll-frame opnieuw renderen, voor
    // een uitkomst die niemand toont.
    if (!el || !enabled) return;

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
  }, [ref, enabled]);

  // Alleen een scrollbare kant vervaagt. Past alles, dan blijft de mask weg en
  // is er geen enkel verschil met een gewone scroller.
  const stops = [
    canScrollLeft ? `transparent 0, #000 ${FADE_PX}px` : '#000 0',
    canScrollRight ? `#000 calc(100% - ${FADE_PX}px), transparent 100%` : '#000 100%',
  ].join(', ');
  const maskImage =
    canScrollLeft || canScrollRight ? `linear-gradient(to right, ${stops})` : undefined;

  return { canScrollLeft, canScrollRight, maskImage };
}
