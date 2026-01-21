import type { AggregateReviewData } from '@/types/reviews-hub';

interface ReviewsStructuredDataProps {
  aggregate: AggregateReviewData;
  businessName: string;
}

export function ReviewsStructuredData({ aggregate, businessName }: ReviewsStructuredDataProps) {
  if (!aggregate || aggregate.total_reviews === 0) {
    return null;
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": businessName,
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": aggregate.average_rating.toFixed(1),
      "reviewCount": aggregate.total_reviews,
      "bestRating": "5",
      "worstRating": "1"
    }
  };

  return (
    <script 
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
