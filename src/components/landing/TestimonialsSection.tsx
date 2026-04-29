import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Quote } from 'lucide-react';

const testimonials = [
  {
    quote: 'SellQo heeft ons €500/maand bespaard aan apptarieven en ik heb eindelijk overzicht over onze winstmarges. Game changer.',
    name: 'Sarah van Berg',
    company: 'Founder, Nordic Living',
    initials: 'SB',
    color: 'bg-primary',
  },
  {
    quote: 'De unified inbox en automatische BTW/OSS berekening besparen me uren per week. Mijn boekhouder is er ook blij mee.',
    name: 'Thomas Hermans',
    company: 'CEO, TechGear België',
    initials: 'TH',
    color: 'bg-accent',
  },
  {
    quote: 'Binnen 2 uur gemigreerd van Shopify naar SellQo. De support is next level - ze denken met je mee.',
    name: 'Lisa Janssen',
    company: 'Owner, BabyBoutique.nl',
    initials: 'LJ',
    color: 'bg-green-500',
  },
];

export function TestimonialsSection() {
  const { ref, isIntersecting } = useIntersectionObserver();

  return (
    <section className="pt-12 pb-20 md:pt-16 md:pb-28 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Dit Zeggen Onze Klanten
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className={cn(
                'p-6 md:p-8 bg-card rounded-2xl border border-border shadow-sellqo hover:shadow-sellqo-lg transition-all duration-300',
                isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <Quote className="w-8 h-8 text-accent/30 mb-4" />
              
              <p className="text-foreground mb-6 italic">"{testimonial.quote}"</p>
              
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center text-white font-bold',
                  testimonial.color
                )}>
                  {testimonial.initials}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
