import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { Zap, Activity, Bot, MessageSquare, Wallet, Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const advantages = [
  {
    icon: Zap,
    emoji: '⚡',
    title: '5-Minuten Setup',
    description: 'Geen developer nodig. Onze wizard helpt je stap voor stap. Binnen 5 minuten is je eerste product online.',
    highlight: 'Geen technische kennis vereist',
  },
  {
    icon: Activity,
    emoji: '📊',
    title: 'Shop Health Score',
    description: 'Real-time gezondheidscheck van je shop: voorraadniveaus, winstmarges, SEO-score, alles op één blik.',
    highlight: 'Exclusief bij SellQo',
  },
  {
    icon: Bot,
    emoji: '🤖',
    title: 'Proactieve AI Coach',
    description: 'Krijg advies VOORDAT er problemen ontstaan. "Je voorraad van X raakt op", "Tijd voor een actie op Y".',
    highlight: 'AI die meedenkt',
  },
  {
    icon: MessageSquare,
    emoji: '💬',
    title: 'AI Chatbot 24/7',
    description: 'Je webshop heeft een slimme chatbot die vragen beantwoordt op basis van je producten, FAQ en policies.',
    highlight: 'Klantenservice op automatische piloot',
  },
  {
    icon: Wallet,
    emoji: '💸',
    title: '€0 Transactiekosten',
    description: 'Met Bank Transfer QR-codes betalen klanten direct via iDEAL/Bancontact zonder Stripe fees.',
    highlight: 'Bespaar honderden euro\'s',
  },
  {
    icon: Inbox,
    emoji: '📬',
    title: 'Unified Inbox',
    description: 'Email, WhatsApp, Facebook Messenger, Instagram DMs én marketplace berichten in één inbox. AI stelt antwoorden voor.',
    highlight: 'Alle kanalen op één plek',
  },
];

export function UniqueAdvantagesSection() {
  const { ref, isIntersecting } = useIntersectionObserver();

  return (
    <section id="why-sellqo" className="py-20 md:py-28 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <Badge variant="secondary" className="mb-4 bg-accent/10 text-accent border-accent/20">
            Wat ons uniek maakt
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Functies Die Je Nergens Anders Vindt
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Dit is waarom slimme ondernemers kiezen voor SellQo boven Shopify of Lightspeed.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
          {advantages.map((advantage, index) => (
            <div
              key={index}
              className={cn(
                'group p-6 md:p-8 bg-card rounded-2xl border border-border shadow-sellqo',
                'hover:shadow-sellqo-lg hover:-translate-y-1 transition-all duration-300',
                isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <advantage.icon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-2xl">{advantage.emoji}</span>
              </div>
              
              <h3 className="text-xl font-bold text-foreground mb-3">{advantage.title}</h3>
              <p className="text-muted-foreground mb-4">{advantage.description}</p>
              
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                {advantage.highlight}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
