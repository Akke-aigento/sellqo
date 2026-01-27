import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { TrendingUp, Users, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

const stats = [
  { icon: Users, value: 500, suffix: '+', label: 'Actieve Ondernemers' },
  { icon: TrendingUp, value: 2400000, prefix: '€', suffix: '+', label: 'Verwerkte Omzet' },
  { icon: Shield, value: 99.9, suffix: '%', label: 'Uptime Garantie' },
];

function AnimatedCounter({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, isIntersecting } = useIntersectionObserver({ triggerOnce: true });

  useEffect(() => {
    if (!isIntersecting) return;
    
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isIntersecting, value]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'K';
    }
    return num.toLocaleString('nl-NL');
  };

  return (
    <span ref={ref}>
      {prefix}{typeof value === 'number' && value < 100 ? count.toFixed(1) : formatNumber(count)}{suffix}
    </span>
  );
}

export function SocialProofSection() {
  const { ref, isIntersecting } = useIntersectionObserver();

  return (
    <section className="py-12 md:py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Stats Grid */}
        <div
          ref={ref}
          className="grid grid-cols-3 gap-4 md:gap-8 max-w-4xl mx-auto"
        >
          {stats.map((stat, index) => (
            <div
              key={index}
              className={cn(
                'text-center p-4 md:p-6 bg-background rounded-2xl border border-border shadow-sellqo',
                isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-10 h-10 md:w-14 md:h-14 mx-auto mb-3 md:mb-4 bg-primary/10 rounded-xl md:rounded-2xl flex items-center justify-center">
                <stat.icon className="w-5 h-5 md:w-7 md:h-7 text-primary" />
              </div>
              <div className="text-xl md:text-3xl lg:text-4xl font-bold text-foreground mb-1 md:mb-2">
                <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
