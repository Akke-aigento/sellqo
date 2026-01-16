import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { TrendingUp, Package, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

const logos = [
  'Shopify', 'WooCommerce', 'Bol.com', 'Amazon', 'Stripe', 
  'Mollie', 'PostNL', 'bPost', 'Exact', 'Odoo'
];

const stats = [
  { icon: TrendingUp, value: 2400000, prefix: '€', suffix: '+', label: 'Verwerkte Omzet' },
  { icon: Package, value: 15000, suffix: '+', label: 'Producten Beheerd' },
  { icon: Shield, value: 99.9, suffix: '%', label: 'Uptime Gegarandeerd' },
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
    <section className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Headline */}
        <div
          ref={ref}
          className={cn(
            'text-center mb-12',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Vertrouwd Door 500+ Ondernemers in de Benelux
          </h2>
        </div>

        {/* Logo carousel */}
        <div className="relative overflow-hidden mb-16">
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-secondary/30 to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-secondary/30 to-transparent z-10" />
          
          <div className="flex animate-scroll-x">
            {[...logos, ...logos].map((logo, index) => (
              <div
                key={index}
                className="flex-shrink-0 mx-8 px-6 py-3 bg-background rounded-lg border border-border grayscale hover:grayscale-0 transition-all duration-300"
              >
                <span className="text-lg font-semibold text-muted-foreground hover:text-foreground">
                  {logo}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={cn(
                'text-center p-6 bg-background rounded-2xl border border-border shadow-sellqo',
                isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center">
                <stat.icon className="w-7 h-7 text-primary" />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              </div>
              <p className="text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
