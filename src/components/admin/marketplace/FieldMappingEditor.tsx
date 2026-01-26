import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldMapping } from '@/types/syncRules';

interface FieldMappingEditorProps {
  mappings: FieldMapping[];
  onToggle: (fieldId: string, enabled: boolean) => void;
  disabled?: boolean;
}

export function FieldMappingEditor({
  mappings,
  onToggle,
  disabled = false,
}: FieldMappingEditorProps) {
  const enabledCount = mappings.filter(m => m.enabled).length;
  const requiredCount = mappings.filter(m => m.required).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Velden synchroniseren</Label>
        <span className="text-xs text-muted-foreground">
          {enabledCount} van {mappings.length} geselecteerd
        </span>
      </div>
      
      <div className="border rounded-lg divide-y">
        {mappings.map((mapping) => (
          <div
            key={mapping.id}
            className={cn(
              "flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors",
              disabled && "opacity-50"
            )}
          >
            <Checkbox
              id={`field-${mapping.id}`}
              checked={mapping.enabled}
              onCheckedChange={(checked) => onToggle(mapping.id, checked === true)}
              disabled={disabled || mapping.required}
            />
            
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Label
                  htmlFor={`field-${mapping.id}`}
                  className={cn(
                    "text-sm cursor-pointer truncate",
                    mapping.enabled ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {mapping.label}
                </Label>
                
                {mapping.required && (
                  <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              
              <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              
              <code className={cn(
                "text-xs px-2 py-0.5 rounded bg-muted truncate max-w-[140px]",
                mapping.enabled ? "text-foreground" : "text-muted-foreground"
              )}>
                {mapping.targetField}
              </code>
            </div>
            
            {mapping.required && (
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                Verplicht
              </Badge>
            )}
          </div>
        ))}
      </div>
      
      {requiredCount > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Lock className="w-3 h-3" />
          {requiredCount} verplichte veld{requiredCount > 1 ? 'en' : ''} kunnen niet worden uitgeschakeld
        </p>
      )}
    </div>
  );
}
