import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import type { Category, CategoryFormData } from '@/types/product';

const categorySchema = z.object({
  name: z.string().min(1, 'Naam is verplicht').max(100, 'Naam mag maximaal 100 tekens zijn'),
  slug: z.string().min(1, 'Slug is verplicht').max(100, 'Slug mag maximaal 100 tekens zijn')
    .regex(/^[a-z0-9-]+$/, 'Slug mag alleen kleine letters, cijfers en streepjes bevatten'),
  description: z.string().max(500, 'Beschrijving mag maximaal 500 tekens zijn').optional(),
  parent_id: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().optional(),
  image_url: z.string().url('Ongeldige URL').optional().or(z.literal('')),
});

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  parentId?: string | null;
  categories: Category[];
  onSubmit: (data: CategoryFormData) => Promise<void>;
  isLoading?: boolean;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  parentId,
  categories,
  onSubmit,
  isLoading,
}: CategoryFormDialogProps) {
  const isEditing = !!category;

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      parent_id: null,
      is_active: true,
      sort_order: 0,
      image_url: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (category) {
        form.reset({
          name: category.name,
          slug: category.slug,
          description: category.description || '',
          parent_id: category.parent_id || null,
          is_active: category.is_active ?? true,
          sort_order: category.sort_order ?? 0,
          image_url: category.image_url || '',
        });
      } else {
        form.reset({
          name: '',
          slug: '',
          description: '',
          parent_id: parentId || null,
          is_active: true,
          sort_order: 0,
          image_url: '',
        });
      }
    }
  }, [open, category, parentId, form]);

  // Auto-generate slug from name
  const watchName = form.watch('name');
  useEffect(() => {
    if (!isEditing && watchName) {
      const slug = watchName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      form.setValue('slug', slug);
    }
  }, [watchName, isEditing, form]);

  const handleSubmit = async (data: CategoryFormData) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  // Filter out current category and its children from parent options
  const getAvailableParents = (cats: Category[], excludeId?: string): Category[] => {
    return cats.filter(c => c.id !== excludeId).map(c => ({
      ...c,
      children: c.children ? getAvailableParents(c.children, excludeId) : [],
    }));
  };

  const flattenCategories = (cats: Category[], prefix = ''): { id: string; label: string }[] => {
    return cats.flatMap(c => [
      { id: c.id, label: prefix + c.name },
      ...(c.children ? flattenCategories(c.children, prefix + '— ') : []),
    ]);
  };

  const availableParents = flattenCategories(getAvailableParents(categories, category?.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Categorie bewerken' : 'Nieuwe categorie'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Naam *</FormLabel>
                  <FormControl>
                    <Input placeholder="Bijv. Elektronica" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug *</FormLabel>
                  <FormControl>
                    <Input placeholder="elektronica" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschrijving</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Beschrijf de categorie..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hoofdcategorie</FormLabel>
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Geen (hoofdcategorie)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Geen (hoofdcategorie)</SelectItem>
                      {availableParents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Afbeelding URL</FormLabel>
                  <FormControl>
                    <Input 
                      type="url"
                      placeholder="https://..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-4">
              <FormField
                control={form.control}
                name="sort_order"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Sorteervolgorde</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 pt-6">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Actief</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Opslaan' : 'Toevoegen'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
