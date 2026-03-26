import { Users, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCustomerSegments } from '@/hooks/useCustomerSegments';

interface SegmentSelectorProps {
  value: string;
  onChange: (segmentId: string) => void;
  label?: string;
  placeholder?: string;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
}

export function SegmentSelector({
  value,
  onChange,
  label = 'Klantsegment',
  placeholder = 'Kies segment...',
  showCreateButton = false,
  onCreateClick,
}: SegmentSelectorProps) {
  const { segments, isLoading } = useCustomerSegments();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {showCreateButton && onCreateClick && (
          <Button variant="ghost" size="sm" onClick={onCreateClick} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Nieuw segment
          </Button>
        )}
      </div>
      <Select value={value || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Geen segment (alle klanten)</SelectItem>
          {isLoading ? (
            <SelectItem value="loading" disabled>Laden...</SelectItem>
          ) : (
            segments.map(seg => (
              <SelectItem key={seg.id} value={seg.id}>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{seg.name}</span>
                  <span className="text-muted-foreground text-xs">({seg.member_count})</span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
