import { useState } from 'react';
import { Plus, FileText, Pencil, Trash2, Eye, EyeOff, GripVertical, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStorefront } from '@/hooks/useStorefront';
import { RichTextEditor } from './RichTextEditor';
import type { StorefrontPage } from '@/types/storefront';

interface PageFormData {
  slug: string;
  title: string;
  content: string;
  meta_title: string;
  meta_description: string;
  is_published: boolean;
  show_in_nav: boolean;
  nav_order: number;
}

const DEFAULT_PAGES = [
  { slug: 'about', title: 'Over ons', template: 'Vertel je verhaal...' },
  { slug: 'contact', title: 'Contact', template: 'Neem contact met ons op...' },
  { slug: 'faq', title: 'Veelgestelde vragen', template: '## Vraag 1?\nAntwoord...' },
  { slug: 'shipping', title: 'Verzending', template: 'Informatie over verzending...' },
  { slug: 'returns', title: 'Retourneren', template: 'Ons retourbeleid...' },
  { slug: 'privacy', title: 'Privacy', template: 'Privacyverklaring...' },
  { slug: 'terms', title: 'Algemene Voorwaarden', template: 'Onze voorwaarden...' },
];

export function StorefrontPagesManager() {
  const { pages, pagesLoading, createPage, updatePage, deletePage } = useStorefront();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<StorefrontPage | null>(null);
  const [formData, setFormData] = useState<PageFormData>({
    slug: '',
    title: '',
    content: '',
    meta_title: '',
    meta_description: '',
    is_published: true,
    show_in_nav: true,
    nav_order: 0,
  });

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleOpenNew = (template?: typeof DEFAULT_PAGES[0]) => {
    setEditingPage(null);
    setFormData({
      slug: template?.slug || '',
      title: template?.title || '',
      content: template?.template || '',
      meta_title: '',
      meta_description: '',
      is_published: true,
      show_in_nav: true,
      nav_order: pages.length,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (page: StorefrontPage) => {
    setEditingPage(page);
    setFormData({
      slug: page.slug,
      title: page.title,
      content: page.content || '',
      meta_title: page.meta_title || '',
      meta_description: page.meta_description || '',
      is_published: page.is_published,
      show_in_nav: page.show_in_nav,
      nav_order: page.nav_order,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editingPage) {
      updatePage.mutate({
        id: editingPage.id,
        ...formData,
      });
    } else {
      createPage.mutate(formData);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Weet je zeker dat je deze pagina wilt verwijderen?')) {
      deletePage.mutate(id);
    }
  };

  const handleTogglePublish = (page: StorefrontPage) => {
    updatePage.mutate({
      id: page.id,
      is_published: !page.is_published,
    });
  };

  // Find which default pages are not yet created
  const existingSlugs = pages.map(p => p.slug);
  const suggestedPages = DEFAULT_PAGES.filter(p => !existingSlugs.includes(p.slug));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Pagina's
            </CardTitle>
            <CardDescription>
              Beheer statische pagina's zoals Contact, Over ons en FAQ
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenNew()}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe Pagina
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingPage ? 'Pagina Bewerken' : 'Nieuwe Pagina'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Titel</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => {
                        setFormData({ 
                          ...formData, 
                          title: e.target.value,
                          slug: !editingPage ? generateSlug(e.target.value) : formData.slug,
                        });
                      }}
                      placeholder="Over ons"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug (URL)</Label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 bg-muted text-muted-foreground text-sm">
                        /
                      </span>
                      <Input
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        className="rounded-l-none"
                        placeholder="about"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Inhoud</Label>
                  <RichTextEditor
                    content={formData.content}
                    onChange={(html) => setFormData({ ...formData, content: html })}
                    placeholder="Schrijf je pagina inhoud hier..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SEO Titel (optioneel)</Label>
                    <Input
                      value={formData.meta_title}
                      onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                      placeholder="Over ons | Jouw Webshop"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SEO Beschrijving (optioneel)</Label>
                    <Input
                      value={formData.meta_description}
                      onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                      placeholder="Leer meer over ons bedrijf..."
                    />
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_published}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                    />
                    <Label>Gepubliceerd</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.show_in_nav}
                      onCheckedChange={(checked) => setFormData({ ...formData, show_in_nav: checked })}
                    />
                    <Label>Toon in navigatie</Label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Annuleren
                  </Button>
                  <Button onClick={handleSave}>
                    {editingPage ? 'Opslaan' : 'Aanmaken'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Suggested Pages */}
        {suggestedPages.length > 0 && (
          <div className="mb-6 p-4 rounded-lg border border-dashed bg-muted/30">
            <p className="text-sm font-medium mb-3">Aanbevolen pagina's om toe te voegen:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedPages.map((page) => (
                <Button
                  key={page.slug}
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenNew(page)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {page.title}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Pages Table */}
        {pagesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nog geen pagina's aangemaakt</p>
            <p className="text-sm">Klik op "Nieuwe Pagina" of kies een aanbevolen pagina hierboven</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>In menu</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </TableCell>
                  <TableCell className="font-medium">{page.title}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">/{page.slug}</code>
                  </TableCell>
                  <TableCell>
                    {page.show_in_nav ? (
                      <Badge variant="secondary">Ja</Badge>
                    ) : (
                      <span className="text-muted-foreground">Nee</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={page.is_published ? 'default' : 'secondary'}>
                      {page.is_published ? 'Live' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTogglePublish(page)}
                      >
                        {page.is_published ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(page)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(page.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
