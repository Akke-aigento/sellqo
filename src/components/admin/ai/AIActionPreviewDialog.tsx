import { useState } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { 
  Package, 
  Megaphone, 
  AlertTriangle, 
  UserCheck, 
  Truck, 
  TrendingUp,
  Percent,
  Brain,
  Edit2,
  Check,
  X,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAIActions } from '@/hooks/useAIActions';
import type { 
  AIActionSuggestion, 
  PurchaseOrderActionData,
  MarketingCampaignActionData,
  CustomerWinbackActionData,
  StockAlertActionData,
  SUGGESTION_TYPE_CONFIG,
  PRIORITY_CONFIG 
} from '@/types/aiActions';
import { cn } from '@/lib/utils';

const ICONS = {
  purchase_order: Package,
  marketing_campaign: Megaphone,
  price_change: TrendingUp,
  stock_alert: AlertTriangle,
  customer_winback: UserCheck,
  supplier_order: Truck,
  promotion: Percent,
};

interface AIActionPreviewDialogProps {
  suggestion: AIActionSuggestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExecuted?: () => void;
}

export function AIActionPreviewDialog({
  suggestion,
  open,
  onOpenChange,
  onExecuted,
}: AIActionPreviewDialogProps) {
  const { executeSuggestion, rejectSuggestion } = useAIActions();
  const [isEditing, setIsEditing] = useState(false);
  const [modifications, setModifications] = useState<Record<string, unknown>>({});

  if (!suggestion) return null;

  const Icon = ICONS[suggestion.suggestion_type] || Brain;
  const confidencePercent = Math.round((suggestion.confidence_score || 0) * 100);

  const handleExecute = async () => {
    await executeSuggestion.mutateAsync({
      suggestionId: suggestion.id,
      modifications: Object.keys(modifications).length > 0 ? modifications : undefined,
    });
    onOpenChange(false);
    onExecuted?.();
  };

  const handleReject = async () => {
    await rejectSuggestion.mutateAsync(suggestion.id);
    onOpenChange(false);
    onExecuted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              suggestion.priority === 'urgent' ? 'bg-red-100' :
              suggestion.priority === 'high' ? 'bg-orange-100' :
              'bg-blue-100'
            )}>
              <Icon className={cn(
                'h-5 w-5',
                suggestion.priority === 'urgent' ? 'text-red-600' :
                suggestion.priority === 'high' ? 'text-orange-600' :
                'text-blue-600'
              )} />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2">
                {suggestion.title}
                <Badge variant={
                  suggestion.priority === 'urgent' ? 'destructive' :
                  suggestion.priority === 'high' ? 'default' :
                  'secondary'
                }>
                  {suggestion.priority === 'urgent' ? 'Urgent' :
                   suggestion.priority === 'high' ? 'Hoog' :
                   suggestion.priority === 'medium' ? 'Gemiddeld' : 'Laag'}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-1">
                Vertrouwen: {confidencePercent}% • 
                {suggestion.expires_at && (
                  <> Vervalt: {format(new Date(suggestion.expires_at), 'dd MMM yyyy', { locale: nl })}</>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* AI Reasoning */}
        {suggestion.reasoning && (
          <div className="bg-muted/50 rounded-lg p-4 border">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">AI Redenering</span>
            </div>
            <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
          </div>
        )}

        <Separator />

        {/* Action-specific content */}
        <div className="space-y-4">
          {suggestion.suggestion_type === 'purchase_order' && (
            <PurchaseOrderPreview 
              data={suggestion.action_data as unknown as PurchaseOrderActionData}
              isEditing={isEditing}
              modifications={modifications}
              onModify={setModifications}
            />
          )}
          {suggestion.suggestion_type === 'stock_alert' && (
            <StockAlertPreview 
              data={suggestion.action_data as unknown as StockAlertActionData}
            />
          )}
          {suggestion.suggestion_type === 'marketing_campaign' && (
            <MarketingCampaignPreview 
              data={suggestion.action_data as unknown as MarketingCampaignActionData}
              isEditing={isEditing}
              modifications={modifications}
              onModify={setModifications}
            />
          )}
          {suggestion.suggestion_type === 'customer_winback' && (
            <WinbackPreview 
              data={suggestion.action_data as unknown as CustomerWinbackActionData}
            />
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={rejectSuggestion.isPending}
          >
            <X className="h-4 w-4 mr-2" />
            Afwijzen
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            {isEditing ? 'Stop Bewerken' : 'Aanpassen'}
          </Button>
          <Button
            onClick={handleExecute}
            disabled={executeSuggestion.isPending}
          >
            {executeSuggestion.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Uitvoeren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sub-components for different action types

function PurchaseOrderPreview({
  data,
  isEditing,
  modifications,
  onModify,
}: {
  data: PurchaseOrderActionData;
  isEditing: boolean;
  modifications: Record<string, unknown>;
  onModify: (mods: Record<string, unknown>) => void;
}) {
  const items = (modifications.items as typeof data.items) || data.items;

  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], suggested_quantity: quantity };
    onModify({ ...modifications, items: newItems });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <Label className="text-muted-foreground">Leverancier</Label>
          <p className="font-medium">{data.supplier_name}</p>
        </div>
        <div className="text-right">
          <Label className="text-muted-foreground">Verwachte levering</Label>
          <p className="font-medium">
            {data.estimated_delivery ? format(new Date(data.estimated_delivery), 'dd MMM yyyy', { locale: nl }) : '-'}
          </p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Product</th>
              <th className="text-right p-3">Voorraad</th>
              <th className="text-right p-3">Aantal</th>
              <th className="text-right p-3">Prijs/st</th>
              <th className="text-right p-3">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.product_id} className="border-t">
                <td className="p-3">{item.product_name}</td>
                <td className="p-3 text-right text-muted-foreground">{item.current_stock}</td>
                <td className="p-3 text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      value={item.suggested_quantity}
                      onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                      className="w-20 h-8 text-right"
                    />
                  ) : (
                    item.suggested_quantity
                  )}
                </td>
                <td className="p-3 text-right">€{item.unit_cost.toFixed(2)}</td>
                <td className="p-3 text-right font-medium">
                  €{(item.suggested_quantity * item.unit_cost).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted">
            <tr>
              <td colSpan={4} className="p-3 text-right font-medium">Totaal:</td>
              <td className="p-3 text-right font-bold">
                €{items.reduce((sum, item) => sum + (item.suggested_quantity * item.unit_cost), 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function StockAlertPreview({ data }: { data: StockAlertActionData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground">Product</Label>
          <p className="font-medium">{data.product_name}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Huidige voorraad</Label>
          <p className="font-medium">{data.current_stock} stuks</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Gem. dagelijkse verkoop</Label>
          <p className="font-medium">{data.avg_daily_sales.toFixed(1)}/dag</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Dagen tot uitverkocht</Label>
          <p className={cn(
            'font-medium',
            data.days_until_stockout <= 3 ? 'text-red-600' :
            data.days_until_stockout <= 7 ? 'text-orange-600' : ''
          )}>
            {Math.round(data.days_until_stockout)} dagen
          </p>
        </div>
      </div>

      {data.supplier_name && (
        <div className="bg-muted/50 p-3 rounded-lg">
          <p className="text-sm">
            <strong>Aanbeveling:</strong> Bestel {data.suggested_quantity} stuks bij {data.supplier_name}
            {data.lead_time_days && <> (levertijd: {data.lead_time_days} dagen)</>}
          </p>
        </div>
      )}
    </div>
  );
}

function MarketingCampaignPreview({
  data,
  isEditing,
  modifications,
  onModify,
}: {
  data: MarketingCampaignActionData;
  isEditing: boolean;
  modifications: Record<string, unknown>;
  onModify: (mods: Record<string, unknown>) => void;
}) {
  const content = (modifications.content as string) || data.content;
  const subject = (modifications.subject as string) || data.subject;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{data.campaign_type === 'email' ? 'Email' : 'Social Media'}</Badge>
        {data.platform && <Badge variant="outline">{data.platform}</Badge>}
      </div>

      {data.subject && (
        <div>
          <Label className="text-muted-foreground">Onderwerp</Label>
          {isEditing ? (
            <Input
              value={subject || ''}
              onChange={(e) => onModify({ ...modifications, subject: e.target.value })}
              className="mt-1"
            />
          ) : (
            <p className="font-medium">{subject}</p>
          )}
        </div>
      )}

      <div>
        <Label className="text-muted-foreground">Content</Label>
        {isEditing ? (
          <Textarea
            value={content}
            onChange={(e) => onModify({ ...modifications, content: e.target.value })}
            className="mt-1 min-h-[150px]"
          />
        ) : (
          <div className="mt-1 p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}

function WinbackPreview({ data }: { data: CustomerWinbackActionData }) {
  return (
    <div className="space-y-4">
      <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-2xl font-bold">{data.customer_count}</p>
        <p className="text-sm text-muted-foreground">klanten geselecteerd voor win-back</p>
      </div>

      {data.suggested_discount && (
        <Badge variant="secondary" className="text-lg py-1 px-3">
          {data.suggested_discount}% korting
        </Badge>
      )}

      <div>
        <Label className="text-muted-foreground">Email onderwerp</Label>
        <p className="font-medium">{data.email_subject}</p>
      </div>

      <div>
        <Label className="text-muted-foreground">Email preview</Label>
        <div className="mt-1 p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
          {data.email_content}
        </div>
      </div>
    </div>
  );
}
