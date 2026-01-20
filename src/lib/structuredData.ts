// Structured Data (JSON-LD) generators for SEO

export interface ProductStructuredData {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  images: string[];
  category?: string | null;
  inStock: boolean;
  brand?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
}

export interface BusinessStructuredData {
  name: string;
  description?: string | null;
  url: string;
  logo?: string | null;
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  phone?: string | null;
  email?: string | null;
  vatNumber?: string | null;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function generateProductJsonLd(
  product: ProductStructuredData,
  baseUrl: string
): object {
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    url: `${baseUrl}/products/${product.id}`,
  };

  if (product.description) {
    jsonLd.description = product.description;
  }

  if (product.sku) {
    jsonLd.sku = product.sku;
  }

  if (product.images && product.images.length > 0) {
    jsonLd.image = product.images;
  }

  if (product.brand) {
    jsonLd.brand = {
      '@type': 'Brand',
      name: product.brand,
    };
  }

  // Offers (pricing)
  jsonLd.offers = {
    '@type': 'Offer',
    price: product.price,
    priceCurrency: 'EUR',
    availability: product.inStock
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    url: `${baseUrl}/products/${product.id}`,
  };

  // Add sale price if available
  if (product.compareAtPrice && product.compareAtPrice > product.price) {
    jsonLd.offers.priceValidUntil = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString().split('T')[0];
  }

  // Aggregate rating if available
  if (product.rating && product.reviewCount) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return jsonLd;
}

export function generateOrganizationJsonLd(
  business: BusinessStructuredData
): object {
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: business.name,
    url: business.url,
  };

  if (business.description) {
    jsonLd.description = business.description;
  }

  if (business.logo) {
    jsonLd.logo = business.logo;
  }

  if (business.address) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      streetAddress: business.address.street,
      addressLocality: business.address.city,
      postalCode: business.address.postalCode,
      addressCountry: business.address.country,
    };
  }

  if (business.phone) {
    jsonLd.telephone = business.phone;
  }

  if (business.email) {
    jsonLd.email = business.email;
  }

  if (business.vatNumber) {
    jsonLd.vatID = business.vatNumber;
  }

  return jsonLd;
}

export function generateLocalBusinessJsonLd(
  business: BusinessStructuredData & { openingHours?: string[] }
): object {
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    url: business.url,
  };

  if (business.description) {
    jsonLd.description = business.description;
  }

  if (business.logo) {
    jsonLd.image = business.logo;
  }

  if (business.address) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      streetAddress: business.address.street,
      addressLocality: business.address.city,
      postalCode: business.address.postalCode,
      addressCountry: business.address.country,
    };
  }

  if (business.phone) {
    jsonLd.telephone = business.phone;
  }

  if (business.email) {
    jsonLd.email = business.email;
  }

  return jsonLd;
}

export function generateBreadcrumbJsonLd(
  items: BreadcrumbItem[]
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateFAQJsonLd(
  faqs: Array<{ question: string; answer: string }>
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function generateWebsiteJsonLd(
  name: string,
  url: string,
  searchUrl?: string
): object {
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
  };

  if (searchUrl) {
    jsonLd.potentialAction = {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${searchUrl}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    };
  }

  return jsonLd;
}

export function generateCollectionPageJsonLd(
  name: string,
  description: string | null,
  url: string,
  products: ProductStructuredData[],
  baseUrl: string
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description: description || undefined,
    url,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.slice(0, 10).map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: generateProductJsonLd(product, baseUrl),
      })),
    },
  };
}

// Helper to render JSON-LD script tag content
export function renderJsonLd(data: object): string {
  return JSON.stringify(data, null, 2);
}

// Validate JSON-LD structure
export function validateProductJsonLd(jsonLd: object): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data = jsonLd as any;

  // Required fields
  if (!data.name) errors.push('Product name is required');
  if (!data.offers?.price) errors.push('Product price is required');

  // Recommended fields
  if (!data.description) warnings.push('Description is recommended for better SEO');
  if (!data.image || data.image.length === 0) warnings.push('At least one image is recommended');
  if (!data.sku) warnings.push('SKU helps with product identification');
  if (!data.brand) warnings.push('Brand information improves visibility');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
