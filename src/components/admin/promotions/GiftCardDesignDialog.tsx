import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, X } from 'lucide-react';
import {
  Form,
  FormControl,
  FormDescription,
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
import {
  useCreateGiftCardDesign,
  useUpdateGiftCardDesign,
} from '@/hooks/useGiftCardDesigns';
import { useImageUpload } from '@/hooks/useImageUpload';
import { giftCardThemes, type GiftCardDesign } from '@/types/giftCard';

const designSchema = z.object({
  name: z.string().min(1, 'Naam is verplicht'),
  theme: z.string().min(1, 'Thema is verplicht'),
  image_url: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
});

type FormValues = z.infer<typeof designSchema>;

interface GiftCardDesignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  design?: GiftCardDesign | null;
}

export function GiftCardDesignDialog({
  open,
  onOpenChange,
  design,
}: GiftCardDesignDialogProps) {
  const isEditing = !!design;
  const createDesign = useCreateGiftCardDesign();
  const updateDesign = useUpdateGiftCardDesign();
  const { uploadImage, uploading } = useImageUpload();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(designSchema),
    defaultValues: {
      name: '',
      theme: 'general',
      image_url: null,
      is_active: true,
      sort_order: 0,
    },
  });

  useEffect(() => {
    if (design) {
      form.reset({
        name: design.name,
        theme: design.theme,
        image_url: design.image_url,
        is_active: design.is_active,
        sort_order: design.sort_order,
      });
      setPreviewUrl(design.image_url || null);
    } else {
      form.reset({
        name: '',
        theme: 'general',
        image_url: null,
        is_active: true,
        sort_order: 0,
      });
      setPreviewUrl(null);
    }
  }, [design, form]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadImage(file);
    if (url) {
      form.setValue('image_url', url);
      setPreviewUrl(url);
    }
  };

  const handleRemoveImage = () => {
    form.setValue('image_url', null);
    setPreviewUrl(null);
  };

  const onSubmit = async (data: FormValues) => {
    const formData = {
      name: data.name,
      theme: data.theme,
      image_url: data.image_url ?? null,
      is_active: data.is_active,
      sort_order: data.sort_order,
    };
    
    if (isEditing && design) {
      await updateDesign.mutateAsync({
        id: design.id,
        formData,
      });
    } else {
      await createDesign.mutateAsync(formData);
    }
    onOpenChange(false);
  };

  const isSubmitting = createDesign.isPending || updateDesign.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Ontwerp bewerken' : 'Nieuw ontwerp'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Pas de instellingen van dit ontwerp aan'
              : 'Maak een nieuw cadeaukaart ontwerp'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <FormLabel>Afbeelding</FormLabel>
              {previewUrl ? (
                <div className="relative aspect-video rounded-lg overflow-hidden border">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center aspect-video rounded-lg border-2 border-dashed cursor-pointer hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Klik om afbeelding te uploaden
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        Aanbevolen: 1200x630 pixels (16:9)
                      </span>
                    </>
                  )}
                </label>
              )}
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Naam</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Bijv. Verjaardag Feestelijk" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="theme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thema</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer thema" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {giftCardThemes.map((theme) => (
                        <SelectItem key={theme.value} value={theme.value}>
                          {theme.label}
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
              name="sort_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Volgorde</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" min="0" />
                  </FormControl>
                  <FormDescription>
                    Lagere nummers worden eerst getoond
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Actief</FormLabel>
                    <FormDescription>
                      Toon dit ontwerp aan klanten
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuleren
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? 'Opslaan' : 'Aanmaken'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}