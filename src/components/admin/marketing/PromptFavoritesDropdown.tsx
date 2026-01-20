import { useState } from 'react';
import { Star, Trash2, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { usePromptFavorites, type PromptFavorite } from '@/hooks/usePromptFavorites';
import { cn } from '@/lib/utils';

interface PromptFavoritesDropdownProps {
  promptType: 'social' | 'email' | 'image';
  onSelect: (favorite: PromptFavorite) => void;
  className?: string;
}

export function PromptFavoritesDropdown({ 
  promptType, 
  onSelect,
  className 
}: PromptFavoritesDropdownProps) {
  const { favorites, isLoading, deleteFavorite, incrementUsage } = usePromptFavorites(promptType);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSelect = async (favorite: PromptFavorite) => {
    await incrementUsage.mutateAsync(favorite.id);
    onSelect(favorite);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    await deleteFavorite.mutateAsync(id);
    setDeletingId(null);
  };

  if (favorites.length === 0 && !isLoading) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-2', className)}>
          <Star className="h-4 w-4" />
          Favorieten
          <Badge variant="secondary" className="ml-1">
            {favorites.length}
          </Badge>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {isLoading ? (
          <div className="p-4 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {favorites.map((fav) => (
              <DropdownMenuItem
                key={fav.id}
                onClick={() => handleSelect(fav)}
                className="flex items-start justify-between gap-2 cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{fav.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {fav.prompt_text}
                  </p>
                  {fav.usage_count > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {fav.usage_count}x gebruikt
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 hover:bg-destructive/20 hover:text-destructive"
                  onClick={(e) => handleDelete(e, fav.id)}
                  disabled={deletingId === fav.id}
                >
                  {deletingId === fav.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              </DropdownMenuItem>
            ))}
            {favorites.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Klik om prompt te laden
                </div>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
