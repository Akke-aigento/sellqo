import { Link, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Clock, Rocket, FileWarning } from 'lucide-react';
import { PageMeta } from '@/components/seo/PageMeta';
import { useTranslation } from 'react-i18next';
import { useBlogPost, resolveBlogField, useBlogLanguage } from '@/hooks/useBlogPosts';
import { blogCategoryLabelKey } from '@/lib/blogCategories';
import { generateArticleJsonLd } from '@/lib/structuredData';

const SITE_URL = 'https://sellqo.app';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const lang = useBlogLanguage();
  const { data: post, isLoading } = useBlogPost(slug);

  if (isLoading) {
    return (
      <PublicPageLayout title={t('public.blog.title')} subtitle={t('public.blog.subtitle')}>
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </PublicPageLayout>
    );
  }

  // Geen rij = niet gepubliceerd of onbestaand. RLS bepaalt dit, niet de UI.
  if (!post) {
    return (
      <>
        <PageMeta
          title={t('public.blog.notFoundTitle')}
          description={t('public.blog.notFoundText')}
          path={`/blog/${slug ?? ''}`}
          noindex
        />
        <PublicPageLayout title={t('public.blog.notFoundTitle')} subtitle={t('public.blog.notFoundText')}>
          <div className="max-w-lg mx-auto text-center bg-card rounded-2xl border border-border p-10">
            <FileWarning className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <Button asChild>
              <Link to="/blog">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('public.blog.backToBlog')}
              </Link>
            </Button>
          </div>
        </PublicPageLayout>
      </>
    );
  }

  const title = resolveBlogField(post, 'title', lang) ?? post.title;
  const excerpt = resolveBlogField(post, 'excerpt', lang) ?? '';
  const content = resolveBlogField(post, 'content', lang) ?? post.content;
  const metaTitle = resolveBlogField(post, 'meta_title', lang) ?? title;
  const metaDescription = resolveBlogField(post, 'meta_description', lang) ?? excerpt;
  const isDraft = post.status !== 'published';
  const categoryLabel = t(blogCategoryLabelKey(post.category), {
    defaultValue: post.category,
  });

  // Content wordt door platform-admins ingeschoten, maar we saneren altijd:
  // één foutieve import mag geen script kunnen uitvoeren.
  const safeContent = DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel', 'loading'],
  });

  const jsonLd = isDraft
    ? null
    : generateArticleJsonLd({
        headline: title,
        description: metaDescription || null,
        image: post.cover_image_url,
        url: `${SITE_URL}/blog/${post.slug}`,
        datePublished: post.published_at,
        dateModified: post.updated_at,
        author: post.author,
      });

  return (
    <>
      <PageMeta
        title={metaTitle}
        description={metaDescription}
        path={`/blog/${post.slug}`}
        type="article"
        image={post.cover_image_url}
        noindex={isDraft}
        jsonLd={jsonLd}
      />
      <PublicPageLayout title={title} subtitle={excerpt || undefined}>
        <article className="max-w-3xl mx-auto">
          {isDraft && (
            <div className="mb-6 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm font-medium text-orange-600 dark:text-orange-400">
              {t('public.blog.draftBadge')}
            </div>
          )}

          <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
            <Link to="/blog">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('public.blog.backToBlog')}
            </Link>
          </Button>

          {post.cover_image_url && (
            <img
              src={post.cover_image_url}
              alt={title}
              className="w-full rounded-2xl border border-border object-cover aspect-[16/9] mb-6"
            />
          )}

          <div className="flex items-center gap-3 flex-wrap mb-8 text-sm text-muted-foreground">
            <Badge variant="secondary">{categoryLabel}</Badge>
            {post.published_at && (
              <span>
                {new Date(post.published_at).toLocaleDateString(lang, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            )}
            {post.reading_minutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {t('public.blog.readingTime', { count: post.reading_minutes })}
              </span>
            ) : null}
            <span>{post.author}</span>
          </div>

          <div
            className="prose prose-neutral dark:prose-invert max-w-none prose-img:rounded-xl prose-a:text-accent"
            dangerouslySetInnerHTML={{ __html: safeContent }}
          />

          <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/blog">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('public.blog.backToBlog')}
              </Link>
            </Button>
            <Button asChild>
              <Link to="/changelog">
                <Rocket className="w-4 h-4 mr-2" />
                {t('public.blog.changelogButton')}
              </Link>
            </Button>
          </div>
        </article>
      </PublicPageLayout>
    </>
  );
}
