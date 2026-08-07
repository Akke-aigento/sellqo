import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BookOpen, ExternalLink, Trash2, Pencil, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useAdminBlogPosts,
  estimateReadingMinutes,
  type BlogPost,
} from '@/hooks/useBlogPosts';
import { BLOG_CATEGORIES } from '@/lib/blogCategories';

interface EditState {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  cover_image_url: string;
  meta_title: string;
  meta_description: string;
}

export default function PlatformBlog() {
  const queryClient = useQueryClient();
  const { data: posts, isLoading } = useAdminBlogPosts();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
  };

  const togglePublish = useMutation({
    mutationFn: async (post: BlogPost) => {
      const publish = post.status !== 'published';
      const payload: Record<string, unknown> = publish
        ? { status: 'published', published_at: post.published_at ?? new Date().toISOString() }
        : { status: 'draft' };

      if (publish && !post.reading_minutes) {
        const { data: full, error: readError } = await supabase
          .from('blog_posts')
          .select('content')
          .eq('id', post.id)
          .maybeSingle();
        if (readError) throw readError;
        payload.reading_minutes = estimateReadingMinutes(full?.content as string | null);
      }

      const { data, error } = await supabase
        .from('blog_posts')
        .update(payload)
        .eq('id', post.id)
        .select('id, status')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Geen rij bijgewerkt — controleer je platform-admin rechten.');
      return data;
    },
    onSuccess: (_data, post) => {
      invalidate();
      toast.success(post.status === 'published' ? 'Artikel gedepubliceerd' : 'Artikel gepubliceerd');
    },
    onError: (e: Error) => toast.error('Bijwerken mislukt', { description: e.message }),
  });

  const saveEdit = useMutation({
    mutationFn: async (state: EditState) => {
      const { data, error } = await supabase
        .from('blog_posts')
        .update({
          title: state.title,
          excerpt: state.excerpt || null,
          category: state.category,
          cover_image_url: state.cover_image_url || null,
          meta_title: state.meta_title || null,
          meta_description: state.meta_description || null,
        })
        .eq('id', state.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Geen rij bijgewerkt — controleer je platform-admin rechten.');
      return data;
    },
    onSuccess: () => {
      invalidate();
      setEdit(null);
      toast.success('Artikel bijgewerkt');
    },
    onError: (e: Error) => toast.error('Opslaan mislukt', { description: e.message }),
  });

  const removePost = useMutation({
    mutationFn: async (post: BlogPost) => {
      const { error } = await supabase.from('blog_posts').delete().eq('id', post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success('Artikel verwijderd');
    },
    onError: (e: Error) => toast.error('Verwijderen mislukt', { description: e.message }),
  });

  const openEdit = (post: BlogPost) =>
    setEdit({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt ?? '',
      category: post.category,
      cover_image_url: post.cover_image_url ?? '',
      meta_title: post.meta_title ?? '',
      meta_description: post.meta_description ?? '',
    });

  const rowActions = (post: BlogPost) => (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <div className="flex items-center gap-2">
        <Switch
          checked={post.status === 'published'}
          disabled={togglePublish.isPending}
          onCheckedChange={() => togglePublish.mutate(post)}
          aria-label="Publiceren"
        />
        <span className="text-xs text-muted-foreground">
          {post.status === 'published' ? 'Live' : 'Concept'}
        </span>
      </div>
      <Button variant="ghost" size="icon" asChild>
        <Link to={`/blog/${post.slug}`} target="_blank" rel="noreferrer" aria-label="Preview">
          <ExternalLink className="h-4 w-4" />
        </Link>
      </Button>
      <Button variant="ghost" size="icon" onClick={() => openEdit(post)} aria-label="Bewerken">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setDeleteTarget(post)}
        aria-label="Verwijderen"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Blog
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Reviewen en publiceren van SellQo-blogartikelen. Content wordt via de database
          aangeleverd; hier keur je goed en zet je live.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Artikelen</CardTitle>
          <CardDescription>
            {posts ? `${posts.length} artikel(en)` : 'Laden…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !posts || posts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nog geen artikelen. Voeg er een toe via de database.
            </p>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titel</TableHead>
                      <TableHead>Categorie</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Leestijd</TableHead>
                      <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="font-medium max-w-[280px]">
                          <div className="truncate">{post.title}</div>
                          <div className="text-xs text-muted-foreground truncate">/{post.slug}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{post.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                            {post.status === 'published' ? 'Gepubliceerd' : 'Concept'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {post.published_at
                            ? new Date(post.published_at).toLocaleDateString('nl-BE')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {post.reading_minutes ? `${post.reading_minutes} min` : '—'}
                        </TableCell>
                        <TableCell>{rowActions(post)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="rounded-lg border border-border p-4 space-y-3">
                    <div>
                      <div className="font-medium">{post.title}</div>
                      <div className="text-xs text-muted-foreground">/{post.slug}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{post.category}</Badge>
                      <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                        {post.status === 'published' ? 'Gepubliceerd' : 'Concept'}
                      </Badge>
                      {post.reading_minutes ? (
                        <span className="text-xs text-muted-foreground">
                          {post.reading_minutes} min
                        </span>
                      ) : null}
                    </div>
                    {rowActions(post)}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Artikel bijwerken</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="blog-title">Titel (NL)</Label>
                <Input
                  id="blog-title"
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-excerpt">Samenvatting (NL)</Label>
                <Textarea
                  id="blog-excerpt"
                  rows={3}
                  value={edit.excerpt}
                  onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Categorie</Label>
                <Select
                  value={edit.category}
                  onValueChange={(v) => setEdit({ ...edit, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOG_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-cover">Cover-afbeelding URL</Label>
                <Input
                  id="blog-cover"
                  value={edit.cover_image_url}
                  onChange={(e) => setEdit({ ...edit, cover_image_url: e.target.value })}
                  placeholder="https://…/marketing-assets/blog/…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-meta-title">SEO-titel</Label>
                <Input
                  id="blog-meta-title"
                  value={edit.meta_title}
                  onChange={(e) => setEdit({ ...edit, meta_title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-meta-desc">SEO-omschrijving</Label>
                <Textarea
                  id="blog-meta-desc"
                  rows={2}
                  value={edit.meta_description}
                  onChange={(e) => setEdit({ ...edit, meta_description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Annuleren
            </Button>
            <Button
              onClick={() => edit && saveEdit.mutate(edit)}
              disabled={saveEdit.isPending}
            >
              {saveEdit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Artikel verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” wordt definitief verwijderd. Dit kan niet ongedaan
              gemaakt worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && removePost.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
