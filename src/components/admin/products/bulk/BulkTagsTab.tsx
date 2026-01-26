import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import type { BulkEditTabProps } from './BulkEditTypes';

export function BulkTagsTab({ state, onChange, enabledFields, onToggleField }: BulkEditTabProps) {
  const [newTagToAdd, setNewTagToAdd] = useState('');
  const [newTagToRemove, setNewTagToRemove] = useState('');
  const [newReplaceTag, setNewReplaceTag] = useState('');

  const tagsToAdd = state.tags_to_add || [];
  const tagsToRemove = state.tags_to_remove || [];
  const replaceAllTags = state.tags_replace_all || [];

  const addTag = (type: 'add' | 'remove' | 'replace') => {
    if (type === 'add' && newTagToAdd.trim()) {
      if (!tagsToAdd.includes(newTagToAdd.trim())) {
        onChange({ tags_to_add: [...tagsToAdd, newTagToAdd.trim()] });
      }
      setNewTagToAdd('');
    } else if (type === 'remove' && newTagToRemove.trim()) {
      if (!tagsToRemove.includes(newTagToRemove.trim())) {
        onChange({ tags_to_remove: [...tagsToRemove, newTagToRemove.trim()] });
      }
      setNewTagToRemove('');
    } else if (type === 'replace' && newReplaceTag.trim()) {
      if (!replaceAllTags.includes(newReplaceTag.trim())) {
        onChange({ tags_replace_all: [...replaceAllTags, newReplaceTag.trim()] });
      }
      setNewReplaceTag('');
    }
  };

  const removeTag = (type: 'add' | 'remove' | 'replace', tag: string) => {
    if (type === 'add') {
      onChange({ tags_to_add: tagsToAdd.filter(t => t !== tag) });
    } else if (type === 'remove') {
      onChange({ tags_to_remove: tagsToRemove.filter(t => t !== tag) });
    } else if (type === 'replace') {
      onChange({ tags_replace_all: replaceAllTags.filter(t => t !== tag) });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: 'add' | 'remove' | 'replace') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(type);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tags toevoegen */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-tags-add"
            checked={enabledFields.has('tags_to_add')}
            onCheckedChange={() => onToggleField('tags_to_add')}
          />
          <Label htmlFor="enable-tags-add" className="font-medium cursor-pointer">
            Tags toevoegen
          </Label>
        </div>
        {enabledFields.has('tags_to_add') && (
          <div className="pl-6 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Nieuwe tag..."
                value={newTagToAdd}
                onChange={(e) => setNewTagToAdd(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'add')}
                className="flex-1"
              />
              <Button type="button" size="sm" onClick={() => addTag('add')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {tagsToAdd.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag('add', tag)} />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tags verwijderen */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-tags-remove"
            checked={enabledFields.has('tags_to_remove')}
            onCheckedChange={() => onToggleField('tags_to_remove')}
          />
          <Label htmlFor="enable-tags-remove" className="font-medium cursor-pointer">
            Tags verwijderen
          </Label>
        </div>
        {enabledFields.has('tags_to_remove') && (
          <div className="pl-6 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Tag om te verwijderen..."
                value={newTagToRemove}
                onChange={(e) => setNewTagToRemove(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'remove')}
                className="flex-1"
              />
              <Button type="button" size="sm" variant="destructive" onClick={() => addTag('remove')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {tagsToRemove.map((tag) => (
                <Badge key={tag} variant="destructive" className="gap-1">
                  {tag}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag('remove', tag)} />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Alle tags vervangen */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="enable-tags-replace"
            checked={enabledFields.has('tags_replace_all')}
            onCheckedChange={() => onToggleField('tags_replace_all')}
          />
          <Label htmlFor="enable-tags-replace" className="font-medium cursor-pointer">
            Alle tags vervangen door
          </Label>
        </div>
        {enabledFields.has('tags_replace_all') && (
          <div className="pl-6 space-y-2">
            <p className="text-xs text-muted-foreground">
              ⚠️ Dit vervangt ALLE bestaande tags van de geselecteerde producten
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Nieuwe tag..."
                value={newReplaceTag}
                onChange={(e) => setNewReplaceTag(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'replace')}
                className="flex-1"
              />
              <Button type="button" size="sm" onClick={() => addTag('replace')}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {replaceAllTags.map((tag) => (
                <Badge key={tag} variant="outline" className="gap-1">
                  {tag}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag('replace', tag)} />
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
