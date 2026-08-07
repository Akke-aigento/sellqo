// BLOG-1 — Blogcategorieën als conventie (geen DB CHECK), zodat een nieuwe
// rubriek geen migratie vereist. Labels komen uit i18n.
export const BLOG_CATEGORIES = [
  'product-updates',
  'boekhouding',
  'tips',
  'bedrijfsnieuws',
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export function blogCategoryLabelKey(category: string): string {
  return `public.blog.categories.${category}`;
}
