import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChangelogPlatform,
  ChangeType,
  ImpactLevel,
  PLATFORM_LABELS,
  CHANGE_TYPE_LABELS,
  IMPACT_LABELS,
  PlatformChangelog,
} from '@/hooks/usePlatformChangelogs';

interface ChangelogFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<PlatformChangelog>) => void;
  isLoading: boolean;
  changelog?: PlatformChangelog | null;
}

export function ChangelogFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  changelog,
}: ChangelogFormDialogProps) {
  const [formData, setFormData] = useState({
    platform: 'other' as ChangelogPlatform,
    change_type: 'feature' as ChangeType,
    impact_level: 'low' as ImpactLevel,
    title: '',
    description: '',
    version: '',
    source_url: '',
    deadline_date: '',
    action_required: false,
    affected_features: [] as string[],
  });
  const [featuresInput, setFeaturesInput] = useState('');

  useEffect(() => {
    if (changelog) {
      setFormData({
        platform: changelog.platform,
        change_type: changelog.change_type,
        impact_level: changelog.impact_level,
        title: changelog.title,
        description: changelog.description || '',
        version: changelog.version || '',
        source_url: changelog.source_url || '',
        deadline_date: changelog.deadline_date?.split('T')[0] || '',
        action_required: changelog.action_required,
        affected_features: changelog.affected_features || [],
      });
      setFeaturesInput(changelog.affected_features?.join(', ') || '');
    } else {
      setFormData({
        platform: 'other',
        change_type: 'feature',
        impact_level: 'low',
        title: '',
        description: '',
        version: '',
        source_url: '',
        deadline_date: '',
        action_required: false,
        affected_features: [],
      });
      setFeaturesInput('');
    }
  }, [changelog, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const affected = featuresInput
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);
    
    onSubmit({
      ...formData,
      affected_features: affected,
      deadline_date: formData.deadline_date || null,
      version: formData.version || null,
      source_url: formData.source_url || null,
      description: formData.description || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {changelog ? 'Changelog Bewerken' : 'Nieuwe Changelog'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={formData.platform}
                onValueChange={(v) => setFormData({ ...formData, platform: v as ChangelogPlatform })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type wijziging</Label>
              <Select
                value={formData.change_type}
                onValueChange={(v) => setFormData({ ...formData, change_type: v as ChangeType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHANGE_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Impact niveau</Label>
              <Select
                value={formData.impact_level}
                onValueChange={(v) => setFormData({ ...formData, impact_level: v as ImpactLevel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(IMPACT_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Versie (optioneel)</Label>
              <Input
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                placeholder="v2.1.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Korte beschrijving van de wijziging"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Beschrijving</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Uitgebreide beschrijving..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Getroffen features (komma-gescheiden)</Label>
            <Input
              value={featuresInput}
              onChange={(e) => setFeaturesInput(e.target.value)}
              placeholder="Orders, Products, API"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bron URL</Label>
              <Input
                type="url"
                value={formData.source_url}
                onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label>Deadline</Label>
              <Input
                type="date"
                value={formData.deadline_date}
                onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="action_required"
              checked={formData.action_required}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, action_required: !!checked })
              }
            />
            <Label htmlFor="action_required" className="cursor-pointer">
              Actie vereist van tenants
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={isLoading || !formData.title}>
              {isLoading ? 'Opslaan...' : changelog ? 'Bijwerken' : 'Toevoegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
