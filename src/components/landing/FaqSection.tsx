import { useState } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'Hoe werkt de gratis trial?',
    answer: '14 dagen volledig gratis, alle features beschikbaar. Geen creditcard nodig. Je kunt op elk moment upgraden naar een betaald plan.',
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
    answer: 'Absoluut! We ondersteunen BTW-vrijgestelde transacties, netto prijzen, klantenspecifieke prijzen, en automatische Peppol e-invoicing voor zakelijke klanten.',
  },
  {
    question: 'Hoe werken de AI credits?',
    answer: 'AI credits worden gebruikt voor het genereren van content zoals social posts, emails en productbeschrijvingen. Pro krijgt 500 credits/maand, Enterprise onbeperkt. Extra credits kun je bijkopen voor €9 per 500 credits.',
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
    answer: 'Vanaf 2026 is elektronische facturatie via Peppol verplicht voor alle B2B transacties in België. SellQo genereert automatisch Peppol-compliant facturen, zodat jij klaar bent voor de toekomst.',
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
            'max-w-3xl mx-auto bg-card rounded-2xl border border-border shadow-sellqo p-6 md:p-8',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
          style={{ animationDelay: '0.2s' }}
        >
          {faqs.map((faq, index) => (
            <FaqItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
