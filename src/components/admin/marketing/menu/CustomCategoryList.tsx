import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, EyeOff, Eye, Trash2, X, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  RESERVED_CATEGORY_KEYS,
  slugifyCategoryName,
} from '@/config/contentMenuCategories';
import type {
  TenantContentCategory,
  TenantContentCategoryInput,
} from '@/types/content-menu';

interface CustomCategoryListProps {
  categories: TenantContentCategory[];
  onCreate: (input: TenantContentCategoryInput) => Promise<unknown>;
  onUpdate: (args: {
    id: string;
    changes: Partial<TenantContentCategoryInput> & { is_active?: boolean };
  }) => Promise<unknown>;
  onDeactivate: (id: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

interface DraftState {
  name: string;
  instructions: string;
}

const EMPTY_DRAFT: DraftState = { name: '', instructions: '' };

export function CustomCategoryList({
  categories,
  onCreate,
  onUpdate,
  onDeactivate,
  onDelete,
}: CustomCategoryListProps) {
  const { t } = useTranslation();

  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [pendingDelete, setPendingDelete] = useState<TenantContentCategory | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  /**
   * Valideert een concept. Geeft een i18n-key terug of null. De lege
   * omschrijving staat hier én als CHECK in de database: de UI weigert wat de
   * database ook zou weigeren, zodat de tenant een veldfout ziet in plaats van
   * een 400.
   */
  const validate = (state: DraftState, excludeId?: string): string | null => {
    const name = state.name.trim();
    const instructions = state.instructions.trim();

    if (!name) return 'content_menu.custom.errors.name_required';
    if (!instructions) return 'content_menu.custom.errors.instructions_required';

    const slug = slugifyCategoryName(name);
    if (!slug) return 'content_menu.custom.errors.name_invalid';
    if (RESERVED_CATEGORY_KEYS.has(slug)) return 'content_menu.custom.errors.name_reserved';

    const clash = categories.some((c) => c.slug === slug && c.id !== excludeId);
    if (clash) return 'content_menu.custom.errors.name_taken';

    return null;
  };

  const draftError = isAdding ? validate(draft) : null;
  const editError = editingId ? validate(editDraft, editingId) : null;

  // Foutmeldingen pas tonen zodra er iets ingevuld is — niet bij een leeg,
  // net geopend formulier.
  const showDraftError = isAdding && draftError && (draft.name || draft.instructions);
  const showEditError = editingId && editError && (editDraft.name || editDraft.instructions);

  const submitDraft = async () => {
    if (draftError) return;
    setIsBusy(true);
    try {
      await onCreate({
        slug: slugifyCategoryName(draft.name),
        name: draft.name.trim(),
        instructions: draft.instructions.trim(),
        sort_order: categories.length,
      });
      setDraft(EMPTY_DRAFT);
      setIsAdding(false);
    } finally {
      setIsBusy(false);
    }
  };

  const startEdit = (category: TenantContentCategory) => {
    setEditingId(category.id);
    setEditDraft({ name: category.name, instructions: category.instructions });
  };

  const submitEdit = async () => {
    if (!editingId || editError) return;
    setIsBusy(true);
    try {
      await onUpdate({
        id: editingId,
        changes: {
          slug: slugifyCategoryName(editDraft.name),
          name: editDraft.name.trim(),
          instructions: editDraft.instructions.trim(),
        },
      });
      setEditingId(null);
    } finally {
      setIsBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsBusy(true);
    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>{t('content_menu.custom.title')}</Label>
        <p className="text-xs text-muted-foreground">{t('content_menu.custom.help')}</p>
      </div>

      {categories.length === 0 && !isAdding && (
        <p className="text-sm text-muted-foreground">{t('content_menu.custom.empty')}</p>
      )}

      {categories.map((category) =>
        editingId === category.id ? (
          <div key={category.id} className="rounded-lg border p-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`edit-name-${category.id}`}>
                {t('content_menu.custom.name.label')}
              </Label>
              <Input
                id={`edit-name-${category.id}`}
                value={editDraft.name}
                onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder={t('content_menu.custom.name.placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-instructions-${category.id}`}>
                {t('content_menu.custom.instructions.label')}
              </Label>
              <Textarea
                id={`edit-instructions-${category.id}`}
                rows={3}
                value={editDraft.instructions}
                onChange={(e) => setEditDraft((d) => ({ ...d, instructions: e.target.value }))}
                placeholder={t('content_menu.custom.instructions.placeholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('content_menu.custom.instructions.help')}
              </p>
            </div>
            {showEditError && (
              <p className="text-sm text-destructive">{t(editError as string)}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                <X className="h-4 w-4 mr-1" />
                {t('content_menu.actions.cancel')}
              </Button>
              <Button size="sm" onClick={submitEdit} disabled={!!editError || isBusy}>
                <Check className="h-4 w-4 mr-1" />
                {t('content_menu.actions.save')}
              </Button>
            </div>
          </div>
        ) : (
          <div
            key={category.id}
            className="flex items-start justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{category.name}</span>
                {!category.is_active && (
                  <Badge variant="outline" className="text-[10px]">
                    {t('content_menu.custom.hidden_badge')}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{category.instructions}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => startEdit(category)}
                aria-label={t('content_menu.custom.edit_label', { name: category.name })}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {category.is_active ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDeactivate(category.id)}
                  aria-label={t('content_menu.custom.hide_label', { name: category.name })}
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onUpdate({ id: category.id, changes: { is_active: true } })}
                  aria-label={t('content_menu.custom.show_label', { name: category.name })}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => setPendingDelete(category)}
                aria-label={t('content_menu.custom.delete_label', { name: category.name })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ),
      )}

      {isAdding ? (
        <div className="rounded-lg border border-dashed p-3 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="new-category-name">{t('content_menu.custom.name.label')}</Label>
            <Input
              id="new-category-name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder={t('content_menu.custom.name.placeholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-category-instructions">
              {t('content_menu.custom.instructions.label')}
            </Label>
            <Textarea
              id="new-category-instructions"
              rows={3}
              value={draft.instructions}
              onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
              placeholder={t('content_menu.custom.instructions.placeholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('content_menu.custom.instructions.help')}
            </p>
          </div>
          {showDraftError && (
            <p className="text-sm text-destructive">{t(draftError as string)}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setDraft(EMPTY_DRAFT);
              }}
            >
              <X className="h-4 w-4 mr-1" />
              {t('content_menu.actions.cancel')}
            </Button>
            <Button size="sm" onClick={submitDraft} disabled={!!draftError || isBusy}>
              <Check className="h-4 w-4 mr-1" />
              {t('content_menu.custom.add')}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {t('content_menu.custom.add')}
        </Button>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('content_menu.custom.delete_confirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('content_menu.custom.delete_confirm.description', {
                name: pendingDelete?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('content_menu.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isBusy}>
              {t('content_menu.custom.delete_confirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
