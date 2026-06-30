import { useState } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const faqs = (t('landing.faq.items', { returnObjects: true }) as Array<{ q: string; a: string }>).map((f) => ({
    question: f.q,
    answer: f.a,
  }));

  // Split FAQs into two columns for desktop
  const midPoint = Math.ceil(faqs.length / 2);
  const leftColumnFaqs = faqs.slice(0, midPoint);
  const rightColumnFaqs = faqs.slice(midPoint);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  return (
    <section id="faq" className="py-20 md:py-28 bg-secondary/20">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16',
            isIntersecting ? 'animate-fade-in-up' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            {t('landing.faq.heading')}
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
