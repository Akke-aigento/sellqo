import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Pencil, Trash2, MoreVertical, Copy, Tag, Percent, Euro } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { DiscountCode } from '@/types/discount';
import { useToast } from '@/hooks/use-toast';

interface DiscountCodeCardProps {
  discountCode: DiscountCode;
  onEdit: (code: DiscountCode) => void;
  onDelete: (id: string) => void;
}

export function DiscountCodeCard({ discountCode, onEdit, onDelete }: DiscountCodeCardProps) {
  const { toast } = useToast();
  
  const now = new Date();
  const isExpired = discountCode.valid_until && new Date(discountCode.valid_until) < now;
  const isNotYetValid = discountCode.valid_from && new Date(discountCode.valid_from) > now;
  const usageLimitReached = discountCode.usage_limit && discountCode.usage_count >= discountCode.usage_limit;

  const getStatus = () => {
    if (!discountCode.is_active) return { label: 'Inactief', variant: 'secondary' as const };
    if (isExpired) return { label: 'Verlopen', variant: 'destructive' as const };
    if (isNotYetValid) return { label: 'Gepland', variant: 'outline' as const };
    if (usageLimitReached) return { label: 'Limiet bereikt', variant: 'secondary' as const };
    return { label: 'Actief', variant: 'default' as const };
  };

  const status = getStatus();

  const copyCode = () => {
    navigator.clipboard.writeText(discountCode.code);
    toast({
      title: 'Gekopieerd',
      description: `Code "${discountCode.code}" gekopieerd naar klembord.`,
    });
  };

  const formatDiscountValue = () => {
    if (discountCode.discount_type === 'percentage') {
      return `${discountCode.discount_value}%`;
    }
    return `€${discountCode.discount_value.toFixed(2)}`;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono font-semibold text-lg">{discountCode.code}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyCode}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              {discountCode.discount_type === 'percentage' ? (
                <Percent className="h-4 w-4" />
              ) : (
                <Euro className="h-4 w-4" />
              )}
              <span className="font-medium text-foreground">{formatDiscountValue()} korting</span>
              {discountCode.description && (
                <>
                  <span>•</span>
                  <span className="truncate">{discountCode.description}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {discountCode.usage_limit ? (
                <span>
                  Gebruikt: {discountCode.usage_count}/{discountCode.usage_limit}
                </span>
              ) : (
                <span>Gebruikt: {discountCode.usage_count}x</span>
              )}
              
              {discountCode.minimum_order_amount && (
                <span>Min. €{discountCode.minimum_order_amount.toFixed(2)}</span>
              )}
              
              {discountCode.valid_until && (
                <span>
                  {isExpired ? 'Verlopen' : 'Geldig t/m'}: {format(new Date(discountCode.valid_until), 'dd-MM-yyyy', { locale: nl })}
                </span>
              )}
              
              {discountCode.first_order_only && (
                <Badge variant="outline" className="text-xs">Eerste bestelling</Badge>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(discountCode)}>
                <Pencil className="h-4 w-4 mr-2" />
                Bewerken
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(discountCode.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
