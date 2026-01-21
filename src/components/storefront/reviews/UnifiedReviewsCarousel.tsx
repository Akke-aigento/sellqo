import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLATFORM_INFO, type ExternalReview } from '@/types/reviews-hub';

interface UnifiedReviewsCarouselProps {
  reviews: ExternalReview[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showPlatformBadge?: boolean;
}

export function UnifiedReviewsCarousel({
  reviews,
  autoPlay = true,
  autoPlayInterval = 5000,
  showPlatformBadge = true,
}: UnifiedReviewsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!autoPlay || reviews.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % reviews.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, reviews.length]);

  if (reviews.length === 0) {
    return null;
  }

  const currentReview = reviews[currentIndex];
  const platformInfo = PLATFORM_INFO[currentReview.platform];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % reviews.length);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="bg-card rounded-xl p-6 md:p-8 shadow-sm border">
        {/* Quote icon */}
        <Quote className="w-8 h-8 text-primary/20 mb-4" />

        {/* Review text */}
        <blockquote className="text-lg md:text-xl text-foreground mb-6 min-h-[80px]">
          "{currentReview.text || currentReview.title || 'Geweldige ervaring!'}"
        </blockquote>

        {/* Rating stars */}
        <div className="flex items-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-5 h-5 ${
                star <= currentReview.rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-muted text-muted'
              }`}
            />
          ))}
        </div>

        {/* Author and platform */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentReview.author_avatar_url ? (
              <img
                src={currentReview.author_avatar_url}
                alt={currentReview.author_name || 'Reviewer'}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-medium">
                  {(currentReview.author_name || 'A')[0].toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="font-medium text-foreground">
                {currentReview.author_name || 'Anoniem'}
              </p>
              {currentReview.review_date && (
                <p className="text-sm text-muted-foreground">
                  {new Date(currentReview.review_date).toLocaleDateString('nl-NL', {
                    year: 'numeric',
                    month: 'long',
                  })}
                </p>
              )}
            </div>
          </div>

          {showPlatformBadge && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full">
              <img
                src={platformInfo.logo}
                alt={platformInfo.name}
                className="w-4 h-4 object-contain"
              />
              <span className="text-sm text-muted-foreground">
                via {platformInfo.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      {reviews.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-background shadow-md hover:bg-muted"
            onClick={goToPrevious}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-background shadow-md hover:bg-muted"
            onClick={goToNext}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>

          {/* Dots indicator */}
          <div className="flex justify-center gap-2 mt-4">
            {reviews.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
