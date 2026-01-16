import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Globe, CreditCard, Zap, Headphones } from 'lucide-react';

const reasons = [
  {
    icon: Globe,
    emoji: '🇧🇪🇳🇱',
    title: 'Gebouwd Voor Jouw Markt',
    points: [
      'Niet zomaar een Shopify-kloon. SellQo begrijpt de Belgische en Nederlandse markt.',
      'Peppol e-invoicing, OSS BTW, lokale betaalmethoden - gewoon ingebakken.',
    ],
  },
  {
    icon: CreditCard,
    title: 'Eerlijke Prijzen, Geen Verrassingen',
    points: [
      'Transparante maandelijkse prijzen. Geen verborgen transactiekosten, geen dure apps die je móét hebben.',
      'Alles zit erin, vanaf dag één.',
    ],
  },
  {
    icon: Zap,
    title: 'Razendsnel Opgezet',
    points: [
      'Binnen 5 minuten ben je live. Onze setup wizard doet het zware werk.',
      'Migratie hulp? Die krijg je gratis bij een Business plan.',
    ],
  },
  {
    icon: Headphones,
    title: 'Nederlandse Support Die Snapt Hoe Het Werkt',
    points: [
      'Geen chatbots, geen offshore callcenters. Echte e-commerce experts die je taal spreken.',
      'Email, chat én phone support (vanaf Pro plan).',
    ],
  },
];

export function WhySellqoSection() {
  const { ref, isIntersecting } = useIntersectionObserver();

  return (
    <section id="why-sellqo" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Waarom Kiezen Slimme Ondernemers Voor SellQo?
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {reasons.map((reason, index) => (
            <div
              key={index}
              className={cn(
                'p-6 bg-card rounded-2xl border border-border shadow-sellqo hover:shadow-sellqo-lg transition-all duration-300 hover:-translate-y-1',
                isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <reason.icon className="w-6 h-6 text-primary" />
                </div>
                {reason.emoji && <span className="text-2xl">{reason.emoji}</span>}
              </div>
              
              <h3 className="text-lg font-bold text-foreground mb-4">{reason.title}</h3>
              
              <div className="space-y-3">
                {reason.points.map((point, i) => (
                  <p key={i} className="text-sm text-muted-foreground">{point}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
