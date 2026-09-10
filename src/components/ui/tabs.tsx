import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";
import { ScrollHintArrows } from "@/components/ui/scroll-hint";
import { useScrollHint } from "@/hooks/use-scroll-hint";

const Tabs = TabsPrimitive.Root;

interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  /**
   * Toon een vervaging met een pijltje aan de kant waar de rij nog doorloopt.
   *
   * Opt-in, net als bij `Table`: een rij zonder deze prop rendert dezelfde DOM
   * als hiervoor en tuigt geen ResizeObserver op. Zet hem aan zodra een tabrij
   * op mobiel breder is dan zijn container — de scrollbalk is via
   * `no-scrollbar` verborgen, dus zonder hint verraadt niets meer dat er nog
   * tabs achter de rand staan.
   */
  scrollHint?: boolean;
}

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, scrollHint, ...props }, ref) => {
    // Anders dan bij Table is de scroller hier het element dat de aanroeper ook
    // via ref kan opvragen. Vandaar een callback die beide bedient; een eigen
    // regel of vier is hier goedkoper dan @radix-ui/react-compose-refs, dat
    // alleen als transitieve dependency in de boom zit.
    const listRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        listRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );
    const { canScrollLeft, canScrollRight, maskImage } = useScrollHint(listRef, !!scrollHint);

    const lijst = (
      <TabsPrimitive.List
        ref={setRefs}
        className={cn(
          // max-w-full + overflow-x-auto: een inline-flex groeit mee met zijn inhoud,
          // dus een rij met veel tabs werd breder dan het scherm en werd afgeknipt
          // door de overflow-x-hidden op <main>. Gemeten: de zes Bol.com-tabs staken
          // 204px buiten hun container, die van CustomerDetail 89px.
          //
          // justify-start en niet justify-center: in een scrollcontainer met
          // gecentreerde inhoud belandt het begin buiten het scrollgebied en is het
          // onbereikbaar — gemeten stond de eerste tab dan op -102px. Nagemeten dat
          // justify-center hier verder overal een no-op was: van de 28 TabsList in
          // de app had er precies één vrije ruimte om in te centreren
          // (AIMarketingHub), en die zet het zelf terug met sm:justify-center.
          "no-scrollbar inline-flex h-10 max-w-full items-center justify-start overflow-x-auto rounded-md bg-muted p-1 text-muted-foreground",
          className,
        )}
        style={scrollHint ? { maskImage, WebkitMaskImage: maskImage } : undefined}
        {...props}
      />
    );

    if (!scrollHint) return lijst;

    // De pijltjes horen buiten de scroller: binnenin zou de mask ze mee laten
    // vervagen, en zouden ze bovendien meescrollen.
    return (
      <div className="relative">
        {lijst}
        <ScrollHintArrows canScrollLeft={canScrollLeft} canScrollRight={canScrollRight} />
      </div>
    );
  },
);
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
