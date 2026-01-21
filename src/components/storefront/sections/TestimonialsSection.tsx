import { Star } from 'lucide-react';
import type { HomepageSection, TestimonialsContent } from '@/types/storefront';

interface TestimonialsSectionProps {
  section: HomepageSection;
}

export function TestimonialsSection({ section }: TestimonialsSectionProps) {
  const content = section.content as TestimonialsContent;
  const settings = section.settings;
  const reviews = content.reviews || [];

  if (reviews.length === 0) return null;

  return (
    <section 
      className="py-16"
      style={{
        backgroundColor: settings.background_color || undefined,
        color: settings.text_color || undefined,
        paddingTop: settings.padding_top || undefined,
        paddingBottom: settings.padding_bottom || undefined,
      }}
    >
      <div className="container mx-auto px-4">
        {/* Section Header */}
        {(section.title || section.subtitle) && (
          <div className="text-center mb-12">
            {section.title && (
              <h2 className="text-3xl font-bold mb-2">{section.title}</h2>
            )}
            {section.subtitle && (
              <p className="text-muted-foreground">{section.subtitle}</p>
            )}
          </div>
        )}

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {reviews.map((review, index) => (
            <div 
              key={index}
              className="bg-card rounded-lg p-6 shadow-sm border"
            >
              {/* Rating */}
              {review.rating && (
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      className={`h-4 w-4 ${
                        i < review.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Text */}
              <p className="text-muted-foreground mb-4">"{review.text}"</p>

              {/* Author */}
              <div className="flex items-center gap-3">
                {review.avatar_url ? (
                  <img 
                    src={review.avatar_url} 
                    alt={review.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {review.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="font-medium">{review.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
