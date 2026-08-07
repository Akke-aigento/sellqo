import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://sellqo.app';

interface PageMetaProps {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
  image?: string | null;
  noindex?: boolean;
  jsonLd?: object | null;
}

export function PageMeta({
  title,
  description,
  path,
  type = 'website',
  image,
  noindex = false,
  jsonLd,
}: PageMetaProps) {
  const url = `${SITE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta property="og:image" content={image} />}
      {image && <meta name="twitter:card" content="summary_large_image" />}
      {image && <meta name="twitter:image" content={image} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
