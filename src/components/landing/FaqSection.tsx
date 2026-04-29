import { useState } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'Hoe werkt de gratis trial?',
    answer: '14 dagen volledig gratis, alle features beschikbaar. Geen creditcard nodig. Je kiest je plan tijdens onboarding, maar betaalt pas na 14 dagen. Je kunt op elk moment upgraden naar een betaald plan.',
  },
  {
    question: 'Wat gebeurt er na de 14 dagen trial?',
    answer: 'Na 14 dagen word je gevraagd een plan te kiezen. Tot die tijd blijft je account actief maar worden nieuwe functies geblokkeerd. Je data blijft veilig behouden en je kunt op elk moment upgraden.',
  },
  {
    question: 'Hoe werkt het onboarding proces?',
    answer: 'Bij registratie doorloop je een 7-stappen wizard: winkelnaam, plan selectie, bedrijfsgegevens, logo upload, eerste product, betalingen en lancering. Je kunt stappen overslaan en later voltooien via je instellingen.',
  },
  {
    question: 'Wat is de Shop Health Score?',
    answer: 'Een realtime score (0-100%) die de gezondheid van je shop meet op 6 gebieden: fulfillment, voorraad, klantenservice, financiën, SEO en compliance. Je krijgt dagelijks gepersonaliseerde tips om je score te verbeteren.',
  },
  {
    question: 'Kan ik later van plan wisselen?',
    answer: 'Ja! Je kunt op elk moment upgraden of downgraden via Instellingen → Abonnement. Upgrades zijn direct actief, downgrades gaan in bij de volgende facturatieperiode. Geen verborgen kosten.',
  },
  {
    question: 'Welke talen ondersteunt SellQo?',
    answer: 'Nederlands, Engels, Frans en Duits. Zowel de admin interface als je webshop zijn volledig vertaalbaar. AI vertalingen zijn beschikbaar voor productbeschrijvingen en marketing content.',
  },
  {
    question: 'Kan ik mijn bestaande webshop migreren?',
    answer: 'Ja! We hebben import tools voor Shopify, WooCommerce en andere platforms. Enterprise plan klanten krijgen gratis migratie hulp ter waarde van €2000.',
  },
  {
    question: 'Welke betaalmethoden worden ondersteund?',
    answer: 'Via Stripe Connect ondersteun je iDEAL, Bancontact, creditcards, Apple Pay, Google Pay en 40+ andere methoden. Jouw klanten betalen direct op jouw Stripe account.',
  },
  {
    question: 'Is SellQo geschikt voor B2B verkoop?',
    answer: 'Absoluut! We ondersteunen BTW-vrijgestelde transacties, netto prijzen, klantenspecifieke prijzen, en automatische Peppol e-invoicing voor zakelijke klanten (binnenkort beschikbaar).',
  },
  {
    question: 'Hoe werken de AI credits?',
    answer: 'AI credits worden gebruikt voor het genereren van content zoals social posts, emails en productbeschrijvingen. Pro krijgt 500 credits/maand, Enterprise 5.000 credits/maand. Extra credits kun je bijkopen voor €19 per 500 credits.',
  },
  {
    question: 'Kan ik ook fysiek verkopen met SellQo?',
    answer: 'Ja! Met onze POS module heb je een complete kassa met touch-interface, barcode scanner, cadeaubon verkoop en Stripe Terminal integratie. Beschikbaar als add-on voor €29/maand of €15/maand bij Pro.',
  },
  {
    question: 'Welke promoties kan ik instellen?',
    answer: 'SellQo ondersteunt 8 promotietypen: kortingscodes, staffelkorting, BOGO (buy one get one), productbundels, klantgroepen met speciale prijzen, automatische kortingen, cadeaubonnen en een compleet loyaliteitsprogramma met punten.',
  },
  {
    question: 'Hoe bouw ik mijn eigen webshop?',
    answer: 'Met de ingebouwde Webshop Builder kies je een theme, pas je secties aan via drag & drop, en koppel je je eigen domein. Starter krijgt basis themes, Pro krijgt 1 premium theme, Enterprise alle themes.',
  },
  {
    question: 'Zijn er extra kosten bovenop het abonnement?',
    answer: 'Nee. Het enige wat je betaalt zijn de standaard Stripe betaalkosten (1,5% + €0,25 per transactie). Wij rekenen geen extra transactiekosten. Add-ons zoals POS zijn optioneel.',
  },
  {
    question: 'Wat is Peppol en waarom is het belangrijk?',
    answer: 'Vanaf 2026 is elektronische facturatie via Peppol verplicht voor alle B2B transacties in België. Onze Peppol-integratie is in ontwikkeling en wordt vóór de deadline gelanceerd, zodat jij op tijd compliant bent.',
  },
  {
    question: 'Wat gebeurt er met mijn data als ik stop?',
    answer: 'Je data blijft van jou. Je kunt alles exporteren (producten, klanten, bestellingen) in CSV, Excel of via API. We verwijderen je data pas 30 dagen na opzegging.',
  },
];

function FaqItem({ question, answer, isOpen, onToggle }: { 
  question: string; 
  answer: string; 
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        className="w-full py-5 flex items-center justify-between text-left group"
      >
        <span className="font-semibold text-foreground pr-4 group-hover:text-accent transition-colors">
          {question}
        </span>
        <ChevronDown
          className={cn(
            'w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          isOpen ? 'max-h-96 pb-5' : 'max-h-0'
        )}
      >
        <p className="text-muted-foreground">{answer}</p>
      </div>
    </div>
  );
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { ref, isIntersecting } = useIntersectionObserver();

  // Split FAQs into two columns for desktop
  const midPoint = Math.ceil(faqs.length / 2);
  const leftColumnFaqs = faqs.slice(0, midPoint);
  const rightColumnFaqs = faqs.slice(midPoint);

  return (
    <section id="faq" className="py-20 md:py-28 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Veelgestelde Vragen
          </h2>
        </div>

        <div
          className={cn(
            'max-w-6xl mx-auto grid md:grid-cols-2 gap-6',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
          style={{ animationDelay: '0.2s' }}
        >
          {/* Left Column */}
          <div className="bg-card rounded-2xl border border-border shadow-sellqo p-6 md:p-8">
            {leftColumnFaqs.map((faq, index) => (
              <FaqItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
          
          {/* Right Column */}
          <div className="bg-card rounded-2xl border border-border shadow-sellqo p-6 md:p-8">
            {rightColumnFaqs.map((faq, index) => {
              const actualIndex = index + midPoint;
              return (
                <FaqItem
                  key={actualIndex}
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openIndex === actualIndex}
                  onToggle={() => setOpenIndex(openIndex === actualIndex ? null : actualIndex)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
