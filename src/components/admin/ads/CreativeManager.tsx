import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Image, Type, Film, Trash2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { AdCreative } from '@/types/ads';

interface CreativeManagerProps {
  campaignId: string;
}

export function CreativeManager({ campaignId }: CreativeManagerProps) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    creative_type: 'text' as 'image' | 'carousel' | 'video' | 'text',
    headline: '',
    description: '',
    call_to_action: 'Bekijk nu',
    variant_label: '',
  });

  const { data: creatives = [], isLoading } = useQuery({
    queryKey: ['ad-creatives', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_creatives')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AdCreative[];
    },
  });

  const createCreative = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');
      const { error } = await supabase.from('ad_creatives').insert({
        campaign_id: campaignId,
        tenant_id: currentTenant.id,
        creative_type: form.creative_type,
        headline: form.headline || null,
        description: form.description || null,
        call_to_action: form.call_to_action || null,
        variant_label: form.variant_label || null,
        status: 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-creatives', campaignId] });
      toast({ title: 'Creative toegevoegd' });
      setDialogOpen(false);
      setForm({ creative_type: 'text', headline: '', description: '', call_to_action: 'Bekijk nu', variant_label: '' });
    },
    onError: (err: Error) => {
      toast({ title: 'Fout', description: err.message, variant: 'destructive' });
    },
  });

  const deleteCreative = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ad_creatives').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-creatives', campaignId] });
      toast({ title: 'Creative verwijderd' });
    },
  });

  const typeIcons = {
    text: <Type className="h-4 w-4" />,
    image: <Image className="h-4 w-4" />,
    carousel: <Image className="h-4 w-4" />,
    video: <Film className="h-4 w-4" />,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Creatives</h3>
          <p className="text-sm text-muted-foreground">Beheer headlines, beschrijvingen en afbeeldingen</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Creative Toevoegen
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : creatives.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Image className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">Geen creatives</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Voeg headlines, beschrijvingen en visuals toe aan je campagne
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Eerste Creative
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {creatives.map(creative => (
            <Card key={creative.id} className="relative group">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {typeIcons[creative.creative_type as keyof typeof typeIcons]}
                    <CardTitle className="text-sm capitalize">{creative.creative_type}</CardTitle>
                    {creative.variant_label && (
                      <Badge variant="outline" className="text-xs">{creative.variant_label}</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteCreative.mutate(creative.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {creative.headline && (
                  <p className="font-semibold text-sm">{creative.headline}</p>
                )}
                {creative.description && (
                  <p className="text-sm text-muted-foreground">{creative.description}</p>
                )}
                {creative.call_to_action && (
                  <Badge variant="secondary" className="text-xs">{creative.call_to_action}</Badge>
                )}
                <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                  <span>{creative.impressions?.toLocaleString('nl-NL') || 0} impressies</span>
                  <span>{creative.clicks?.toLocaleString('nl-NL') || 0} clicks</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Creative Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Creative Toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.creative_type} onValueChange={(v) => setForm({ ...form, creative_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Tekst</SelectItem>
                  <SelectItem value="image">Afbeelding</SelectItem>
                  <SelectItem value="carousel">Carousel</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Variant Label (optioneel)</Label>
              <Input
                placeholder="bijv. Variant A"
                value={form.variant_label}
                onChange={(e) => setForm({ ...form, variant_label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Headline</Label>
              <Input
                placeholder="Pakkende titel..."
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Beschrijving</Label>
              <Textarea
                placeholder="Beschrijving van de advertentie..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Call to Action</Label>
              <Select value={form.call_to_action} onValueChange={(v) => setForm({ ...form, call_to_action: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bekijk nu">Bekijk nu</SelectItem>
                  <SelectItem value="Koop nu">Koop nu</SelectItem>
                  <SelectItem value="Meer info">Meer info</SelectItem>
                  <SelectItem value="Ontdek meer">Ontdek meer</SelectItem>
                  <SelectItem value="Bestel nu">Bestel nu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuleren</Button>
            <Button onClick={() => createCreative.mutate()} disabled={createCreative.isPending}>
              {createCreative.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
