import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Fingerprint, Save, Plus, X, Hash } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { TagInput } from '@/components/ui/tag-input';
import type { TenantBrandDnaInput, HashtagSets } from '@/types/content-menu';

/** Alleen de merk-DNA-velden; het ochtendmenu zit in MorningMenuCard. */
type BrandFields = Pick<
  TenantBrandDnaInput,
  | 'brand_mission'
  | 'target_audience'
  | 'tone_keywords'
  | 'usps'
  | 'dos'
  | 'donts'
  | 'themes'
  | 'hashtag_sets'
  | 'free_dna'
>;

interface BrandDnaCardProps {
  saved: TenantBrandDnaInput;
  onSave: (fields: BrandFields) => void;
  isSaving: boolean;
}

const pickBrandFields = (source: TenantBrandDnaInput): BrandFields => ({
  brand_mission: source.brand_mission,
  target_audience: source.target_audience,
  tone_keywords: source.tone_keywords,
  usps: source.usps,
  dos: source.dos,
  donts: source.donts,
  themes: source.themes,
  hashtag_sets: source.hashtag_sets,
  free_dna: source.free_dna,
});

/** Lege tekstvelden gaan als NULL naar de database, niet als lege string. */
const toNullable = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function BrandDnaCard({ saved, onSave, isSaving }: BrandDnaCardProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<BrandFields>(() => pickBrandFields(saved));
  const [newSetName, setNewSetName] = useState('');

  // Serverwaarden opnieuw overnemen zodra ze veranderen (na opslaan of refetch).
  const savedBrand = useMemo(() => pickBrandFields(saved), [saved]);
  const savedSignature = useMemo(() => JSON.stringify(savedBrand), [savedBrand]);
  useEffect(() => {
    setForm(pickBrandFields(saved));
    // savedSignature dekt de volledige inhoud; `saved` zelf is elke render een
    // nieuw object en zou de reset onnodig laten vuren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSignature]);

  const isDirty = JSON.stringify(form) !== savedSignature;

  const update = <K extends keyof BrandFields>(key: K, value: BrandFields[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const hashtagSets: HashtagSets = form.hashtag_sets ?? {};

  const addHashtagSet = () => {
    const name = newSetName.trim();
    if (!name || hashtagSets[name]) return;
    update('hashtag_sets', { ...hashtagSets, [name]: [] });
    setNewSetName('');
  };

  const removeHashtagSet = (name: string) => {
    const next = { ...hashtagSets };
    delete next[name];
    update('hashtag_sets', next);
  };

  const setHashtags = (name: string, tags: string[]) =>
    update('hashtag_sets', { ...hashtagSets, [name]: tags });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5 text-muted-foreground" />
          {t('content_menu.brand_dna.title')}
        </CardTitle>
        <CardDescription>{t('content_menu.brand_dna.description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brand-mission">{t('content_menu.brand_dna.mission.label')}</Label>
            <Textarea
              id="brand-mission"
              rows={3}
              value={form.brand_mission ?? ''}
              onChange={(e) => update('brand_mission', toNullable(e.target.value))}
              placeholder={t('content_menu.brand_dna.mission.placeholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('content_menu.brand_dna.mission.help')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-audience">{t('content_menu.brand_dna.audience.label')}</Label>
            <Textarea
              id="target-audience"
              rows={3}
              value={form.target_audience ?? ''}
              onChange={(e) => update('target_audience', toNullable(e.target.value))}
              placeholder={t('content_menu.brand_dna.audience.placeholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('content_menu.brand_dna.audience.help')}
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>{t('content_menu.brand_dna.tone.label')}</Label>
          <TagInput
            values={form.tone_keywords}
            onChange={(values) => update('tone_keywords', values)}
            placeholder={t('content_menu.brand_dna.tone.placeholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('content_menu.brand_dna.tone.help')}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t('content_menu.brand_dna.usps.label')}</Label>
          <TagInput
            values={form.usps}
            onChange={(values) => update('usps', values)}
            placeholder={t('content_menu.brand_dna.usps.placeholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('content_menu.brand_dna.usps.help')}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t('content_menu.brand_dna.themes.label')}</Label>
          <TagInput
            values={form.themes}
            onChange={(values) => update('themes', values)}
            placeholder={t('content_menu.brand_dna.themes.placeholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('content_menu.brand_dna.themes.help')}
          </p>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brand-dos">{t('content_menu.brand_dna.dos.label')}</Label>
            <Textarea
              id="brand-dos"
              rows={4}
              value={form.dos ?? ''}
              onChange={(e) => update('dos', toNullable(e.target.value))}
              placeholder={t('content_menu.brand_dna.dos.placeholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-donts">{t('content_menu.brand_dna.donts.label')}</Label>
            <Textarea
              id="brand-donts"
              rows={4}
              value={form.donts ?? ''}
              onChange={(e) => update('donts', toNullable(e.target.value))}
              placeholder={t('content_menu.brand_dna.donts.placeholder')}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <Label>{t('content_menu.brand_dna.hashtags.label')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('content_menu.brand_dna.hashtags.help')}
            </p>
          </div>

          {Object.keys(hashtagSets).length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('content_menu.brand_dna.hashtags.empty')}
            </p>
          )}

          {Object.entries(hashtagSets).map(([name, tags]) => (
            <div key={name} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  {name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeHashtagSet(name)}
                  aria-label={t('content_menu.brand_dna.hashtags.remove_set', { name })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <TagInput
                values={tags}
                onChange={(values) => setHashtags(name, values)}
                placeholder={t('content_menu.brand_dna.hashtags.tag_placeholder')}
              />
            </div>
          ))}

          <div className="flex items-center gap-2">
            <Input
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              placeholder={t('content_menu.brand_dna.hashtags.new_set_placeholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addHashtagSet();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addHashtagSet}
              disabled={!newSetName.trim() || !!hashtagSets[newSetName.trim()]}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('content_menu.brand_dna.hashtags.add_set')}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="free-dna">{t('content_menu.brand_dna.free.label')}</Label>
          <Textarea
            id="free-dna"
            rows={5}
            value={form.free_dna ?? ''}
            onChange={(e) => update('free_dna', toNullable(e.target.value))}
            placeholder={t('content_menu.brand_dna.free.placeholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('content_menu.brand_dna.free.help')}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {isDirty && (
            <span className="text-sm text-muted-foreground">
              {t('content_menu.actions.unsaved')}
            </span>
          )}
          <Button onClick={() => onSave(form)} disabled={!isDirty || isSaving}>
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? t('content_menu.actions.saving') : t('content_menu.actions.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
