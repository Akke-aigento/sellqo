import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/landing/PublicPageLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Rocket, Clock, ArrowRight } from 'lucide-react';
import { PageMeta } from '@/components/seo/PageMeta';
import { useTranslation } from 'react-i18next';
import {
  usePublicBlogPosts,
  resolveBlogField,
  useBlogLanguage,
  type BlogPost,
} from '@/hooks/useBlogPosts';
import { blogCategoryLabelKey } from '@/lib/blogCategories';

function formatDate(value: string | null, lang: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(lang, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function BlogCard({ post, lang }: { post: BlogPost; lang: string }) {
  const { t } = useTranslation();
  const title = resolveBlogField(post, 'title', lang) ?? post.title;
  const excerpt = resolveBlogField(post, 'excerpt', lang);
  const categoryLabel = t(blogCategoryLabelKey(post.category), {
    defaultValue: post.category,
  });

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex flex-col bg-card rounded-2xl border border-border overflow-hidden hover:border-accent/60 transition-colors"
    >
      {post.cover_image_url ? (
        <img
          src={post.cover_image_url}
          alt={title}
          loading="lazy"
          className="w-full aspect-[16/9] object-cover"
        />
      ) : (
        <div className="w-full aspect-[16/9] bg-muted flex items-center justify-center">
          <BookOpen className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{categoryLabel}</Badge>
          <span className="text-xs text-muted-foreground">
            {formatDate(post.published_at, lang)}
          </span>
          {post.reading_minutes ? (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {t('public.blog.readingTime', { count: post.reading_minutes })}
            </span>
          ) : null}
        </div>
        <h2 className="text-lg font-bold text-foreground group-hover:text-accent transition-colors">
          {title}
        </h2>
        {excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-3">{excerpt}</p>
        )}
        <span className="mt-auto text-sm font-medium text-accent inline-flex items-center gap-1">
          {t('public.blog.readMore')}
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}

export default function Blog() {
  const { t } = useTranslation();
  const lang = useBlogLanguage();
  const { data: posts, isLoading } = usePublicBlogPosts();

  return (
    <>
      <PageMeta
        title={t('public.blog.meta.title')}
        description={t('public.blog.meta.description')}
        path="/blog"
      />
      <PublicPageLayout title={t('public.blog.title')} subtitle={t('public.blog.subtitle')}>
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} lang={lang} />
            ))}
          </div>
        ) : (
          <section className="max-w-2xl mx-auto text-center">
            <div className="bg-card rounded-2xl border border-border p-10">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-5">
                <BookOpen className="w-7 h-7 text-accent" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">{t('public.blog.emptyTitle')}</h2>
              <p className="text-muted-foreground mb-8">{t('public.blog.emptyText')}</p>
              <Button asChild>
                <Link to="/changelog">
                  <Rocket className="w-4 h-4 mr-2" />
                  {t('public.blog.changelogButton')}
                </Link>
              </Button>
            </div>
          </section>
        )}
      </PublicPageLayout>
    </>
  );
}
