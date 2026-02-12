import { useState, useEffect } from 'react';
import { RichTextEditor } from '@/components/admin/storefront/RichTextEditor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSaveArticle, type DocArticle, type DocCategory } from '@/hooks/useDocumentation';
import { toast } from 'sonner';

interface DocArticleEditorProps {
  article?: DocArticle | null;
  categories: DocCategory[];
  docLevel: 'tenant' | 'platform';
  onSaved: () => void;
  onCancel: () => void;
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function DocArticleEditor({ article, categories, docLevel, onSaved, onCancel }: DocArticleEditorProps) {
  const [title, setTitle] = useState(article?.title || '');
  const [slug, setSlug] = useState(article?.slug || '');
  const [content, setContent] = useState(article?.content || '');
  const [excerpt, setExcerpt] = useState(article?.excerpt || '');
  const [categoryId, setCategoryId] = useState(article?.category_id || categories[0]?.id || '');
  const [isPublished, setIsPublished] = useState(article?.is_published ?? true);
  const [contextPath, setContextPath] = useState(article?.context_path || '');
  const [tagsStr, setTagsStr] = useState((article?.tags || []).join(', '));

  const saveArticle = useSaveArticle();

  useEffect(() => {
    if (!article && title) setSlug(slugify(title));
  }, [title, article]);

  const handleSave = () => {
    if (!title || !categoryId) {
      toast.error('Titel en categorie zijn verplicht');
      return;
    }
    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
    saveArticle.mutate(
      {
        ...(article?.id ? { id: article.id } : {}),
        doc_level: docLevel,
        title,
        slug,
        content,
        excerpt: excerpt || null,
        tags,
        category_id: categoryId,
        is_published: isPublished,
        context_path: contextPath || null,
        sort_order: article?.sort_order ?? 0,
      },
      {
        onSuccess: () => {
          toast.success('Artikel opgeslagen');
          onSaved();
        },
        onError: (e) => toast.error('Fout: ' + e.message),
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Titel</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Categorie</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Context pad (optioneel)</Label>
          <Input value={contextPath} onChange={(e) => setContextPath(e.target.value)} placeholder="/admin/products" />
        </div>
      </div>
      <div>
        <Label>Samenvatting</Label>
        <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
      </div>
      <div>
        <Label>Tags (kommagescheiden)</Label>
        <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="producten, varianten" />
      </div>
      <div>
        <Label>Content</Label>
        <RichTextEditor content={content} onChange={setContent} />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={isPublished} onCheckedChange={setIsPublished} />
        <Label>Gepubliceerd</Label>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Annuleren</Button>
        <Button onClick={handleSave} disabled={saveArticle.isPending}>
          {saveArticle.isPending ? 'Opslaan...' : 'Opslaan'}
        </Button>
      </div>
    </div>
  );
}
