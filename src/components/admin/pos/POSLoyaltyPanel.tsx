import { useState, useEffect } from 'react';
import { Star, Coins, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { formatCurrency } from '@/lib/utils';

interface CustomerLoyaltyData {
  id: string;
  points_balance: number;
  loyalty_program: {
    id: string;
    name: string;
    points_per_euro: number;
    point_value: number; // euro value per point
  };
}

interface POSLoyaltyPanelProps {
  customerId: string | null;
  pointsToRedeem: number;
  onPointsChange: (points: number, euroValue: number) => void;
  maxRedeemValue: number;
}

export function POSLoyaltyPanel({
  customerId,
  pointsToRedeem,
  onPointsChange,
  maxRedeemValue,
}: POSLoyaltyPanelProps) {
  const { currentTenant } = useTenant();
  const [loyaltyData, setLoyaltyData] = useState<CustomerLoyaltyData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchLoyalty() {
      if (!customerId || !currentTenant?.id) {
        setLoyaltyData(null);
        return;
      }

      setLoading(true);
      try {
        // First get active loyalty program
        const { data: programs } = await supabase
          .from('loyalty_programs')
          .select('id, name, points_per_euro, point_value')
          .eq('tenant_id', currentTenant.id)
          .eq('is_active', true)
          .limit(1);

        if (!programs || programs.length === 0) {
          setLoyaltyData(null);
          return;
        }

        const program = programs[0];

        // Get customer loyalty data
        const { data: loyalty } = await supabase
          .from('customer_loyalty')
          .select('id, points_balance')
          .eq('customer_id', customerId)
          .eq('loyalty_program_id', program.id)
          .maybeSingle();

        if (loyalty) {
          setLoyaltyData({
            id: loyalty.id,
            points_balance: loyalty.points_balance,
            loyalty_program: program,
          });
        } else {
          setLoyaltyData(null);
        }
      } catch (error) {
        console.error('Error fetching loyalty data:', error);
        setLoyaltyData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchLoyalty();
  }, [customerId, currentTenant?.id]);

  if (!customerId) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Star className="h-4 w-4" />
          Loyalty Punten
        </Label>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Selecteer eerst een klant om loyalty punten te kunnen gebruiken.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Star className="h-4 w-4" />
          Loyalty Punten
        </Label>
        <p className="text-sm text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (!loyaltyData) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Star className="h-4 w-4" />
          Loyalty Punten
        </Label>
        <p className="text-sm text-muted-foreground">
          Deze klant heeft geen loyalty punten of er is geen actief programma.
        </p>
      </div>
    );
  }

  const euroPerPoint = loyaltyData.loyalty_program.point_value || 0.01;
  const maxPointsValue = loyaltyData.points_balance * euroPerPoint;
  const maxRedeemablePoints = Math.min(
    loyaltyData.points_balance,
    Math.floor(maxRedeemValue / euroPerPoint)
  );

  const handlePointsChange = (points: number) => {
    const clampedPoints = Math.min(points, maxRedeemablePoints);
    const euroValue = clampedPoints * euroPerPoint;
    onPointsChange(clampedPoints, euroValue);
  };

  const euroValue = pointsToRedeem * euroPerPoint;

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Star className="h-4 w-4" />
        {loyaltyData.loyalty_program.name}
      </Label>

      <div className="p-3 rounded-lg bg-muted/50 border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            <span className="font-medium">{loyaltyData.points_balance.toLocaleString()} punten</span>
          </div>
          <span className="text-sm text-muted-foreground">
            = {formatCurrency(maxPointsValue)}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>In te wisselen punten:</span>
            <span className="font-medium text-green-600">
              -{formatCurrency(euroValue)}
            </span>
          </div>
          
          <Slider
            value={[pointsToRedeem]}
            onValueChange={(values) => handlePointsChange(values[0])}
            max={maxRedeemablePoints}
            min={0}
            step={1}
            disabled={maxRedeemablePoints === 0}
          />

          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={maxRedeemablePoints}
              value={pointsToRedeem}
              onChange={(e) => handlePointsChange(parseInt(e.target.value) || 0)}
              className="w-24 h-8"
            />
            <span className="text-sm text-muted-foreground">
              / {maxRedeemablePoints.toLocaleString()} max
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { CustomerLoyaltyData };
