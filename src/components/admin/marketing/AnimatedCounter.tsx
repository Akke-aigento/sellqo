import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  locale?: string;
}

export function AnimatedCounter({ 
  value, 
  duration = 1000, 
  className,
  locale = 'nl-NL'
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const startValueRef = useRef(0);

  useEffect(() => {
    // MAIL-UX-1: een tabblad op de achtergrond krijgt geen animatieframes. De teller bleef dan op
    // een tussenstand staan (live: 18 i.p.v. 19 abonnees, ease-out met Math.floor). Zonder
    // zichtbare pagina of met "minder beweging" meteen de echte waarde; bij terugkeer ook.
    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (typeof document === 'undefined' || document.hidden || reduceMotion) {
      setDisplayValue(value);
      return;
    }
    const finish = () => {
      if (!document.hidden) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setDisplayValue(value);
    };
    document.addEventListener('visibilitychange', finish);

    startValueRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = Math.floor(
        startValueRef.current + (value - startValueRef.current) * easeOut
      );

      setDisplayValue(currentValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('visibilitychange', finish);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
    // displayValue is bewust geen afhankelijkheid: het is het startpunt, geen trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <span className={cn("tabular-nums", className)}>
      {displayValue.toLocaleString(locale)}
    </span>
  );
}
