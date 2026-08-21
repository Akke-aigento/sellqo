import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sunrise, Save, Minus, Plus } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  CONTENT_MENU_CATEGORIES,
  FORMAT_EMPHASIS_VALUES,
  MAX_COUNT_PER_CATEGORY,
  formatEmphasisLabelKey,
  formatEmphasisDescriptionKey,
  type FormatEmphasis,
} from '@/config/contentMenuCategories';
import type {
  TenantBrandDnaInput,
  MenuCounts,
  TenantContentCategory,
  TenantContentCategoryInput,
} from '@/types/content-menu';

import { CustomCategoryList } from './CustomCategoryList';

type MenuFields = Pick<TenantBrandDnaInput, 'menu_counts' | 'format_emphasis'>;

interface MorningMenuCardProps {
  saved: TenantBrandDnaInput;
  categories: TenantContentCategory[];
  onSave: (fields: MenuFields) => void;
  isSaving: boolean;
  onCreateCategory: (input: TenantContentCategoryInput) => Promise<unknown>;
  onUpdateCategory: (args: {
    id: string;
    changes: Partial<TenantContentCategoryInput> & { is_active?: boolean };
  }) => Promise<unknown>;
  onDeactivateCategory: (id: string) => Promise<unknown>;
  onDeleteCategory: (id: string) => Promise<unknown>;
}

const pickMenuFields = (source: TenantBrandDnaInput): MenuFields => ({
  menu_counts: source.menu_counts,
  format_emphasis: source.format_emphasis,
});

interface CounterRowProps {
  label: string;
  description: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}

function CounterRow({
  label,
  description,
  icon,
  badge,
  value,
  onChange,
  decreaseLabel,
  increaseLabel,
}: CounterRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{label}</span>
            {badge}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          aria-label={decreaseLabel}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(Math.min(MAX_COUNT_PER_CATEGORY, value + 1))}
          disabled={value >= MAX_COUNT_PER_CATEGORY}
          aria-label={increaseLabel}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function MorningMenuCard({
  saved,
  categories,
  onSave,
  isSaving,
  onCreateCategory,
  onUpdateCategory,
  onDeactivateCategory,
  onDeleteCategory,
}: MorningMenuCardProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<MenuFields>(() => pickMenuFields(saved));

  const savedMenu = useMemo(() => pickMenuFields(saved), [saved]);
  const savedSignature = useMemo(() => JSON.stringify(savedMenu), [savedMenu]);
  useEffect(() => {
    setForm(pickMenuFields(saved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSignature]);

  const isDirty = JSON.stringify(form) !== savedSignature;
  const counts: MenuCounts = form.menu_counts ?? {};

  const countFor = (key: string, fallback: number) =>
    typeof counts[key] === 'number' ? counts[key] : fallback;

  const setCount = (key: string, value: number) =>
    setForm((prev) => ({ ...prev, menu_counts: { ...(prev.menu_counts ?? {}), [key]: value } }));

  const activeCategories = categories.filter((c) => c.is_active);

  const total =
    CONTENT_MENU_CATEGORIES.reduce((sum, c) => sum + countFor(c.key, c.defaultCount), 0) +
    activeCategories.reduce((sum, c) => sum + countFor(c.slug, 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sunrise className="h-5 w-5 text-muted-foreground" />
          {t('content_menu.morning_menu.title')}
        </CardTitle>
        <CardDescription>{t('content_menu.morning_menu.description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
          <span className="text-sm font-medium">{t('content_menu.morning_menu.total_label')}</span>
          <Badge variant="secondary" className="text-sm">
            {t('content_menu.morning_menu.total_value', { total })}
          </Badge>
        </div>

        <div className="divide-y">
          {CONTENT_MENU_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <CounterRow
                key={category.key}
                label={t(category.labelKey)}
                description={t(category.descriptionKey)}
                icon={<Icon className="h-4 w-4" />}
                badge={
                  category.isFreeform ? (
                    <Badge variant="outline" className="text-[10px]">
                      {t('content_menu.morning_menu.freeform_badge')}
                    </Badge>
                  ) : undefined
                }
                value={countFor(category.key, category.defaultCount)}
                onChange={(value) => setCount(category.key, value)}
                decreaseLabel={t('content_menu.morning_menu.decrease', {
                  category: t(category.labelKey),
                })}
                increaseLabel={t('content_menu.morning_menu.increase', {
                  category: t(category.labelKey),
                })}
              />
            );
          })}

          {activeCategories.map((category) => (
            <CounterRow
              key={category.id}
              label={category.name}
              description={category.instructions}
              badge={
                <Badge variant="outline" className="text-[10px]">
                  {t('content_menu.morning_menu.custom_badge')}
                </Badge>
              }
              value={countFor(category.slug, 0)}
              onChange={(value) => setCount(category.slug, value)}
              decreaseLabel={t('content_menu.morning_menu.decrease', {
                category: category.name,
              })}
              increaseLabel={t('content_menu.morning_menu.increase', {
                category: category.name,
              })}
            />
          ))}
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <Label>{t('content_menu.format_emphasis.label')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('content_menu.format_emphasis.help')}
            </p>
          </div>
          <RadioGroup
            value={form.format_emphasis}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, format_emphasis: value as FormatEmphasis }))
            }
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            {FORMAT_EMPHASIS_VALUES.map((value) => (
              <label
                key={value}
                htmlFor={`format-${value}`}
                className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
              >
                <RadioGroupItem value={value} id={`format-${value}`} className="mt-0.5" />
                <div className="min-w-0">
                  <span className="block text-sm font-medium">
                    {t(formatEmphasisLabelKey(value))}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(formatEmphasisDescriptionKey(value))}
                  </span>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex items-center justify-end gap-3">
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

        <Separator />

        <CustomCategoryList
          categories={categories}
          onCreate={onCreateCategory}
          onUpdate={onUpdateCategory}
          onDeactivate={onDeactivateCategory}
          onDelete={onDeleteCategory}
        />
      </CardContent>
    </Card>
  );
}
