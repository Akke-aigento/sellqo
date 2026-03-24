import { useNavigate } from 'react-router-dom';
import { Heart, ArrowDown, ArrowUp, Minus, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerHealthScores } from '@/hooks/useCustomerHealthScores';

export function CustomerHealthWidget() {
  const { data: customers, isLoading } = useCustomerHealthScores(5);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const atRisk = customers?.filter(c => c.score < 40) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-orange-500" />
          Klanten met dalende score
        </CardTitle>
        <CardDescription>
          {atRisk.length > 0 ? `${atRisk.length} klanten hebben aandacht nodig` : 'Alle klanten in goede gezondheid'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(!customers || customers.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nog geen klantdata beschikbaar</p>
        ) : (
          <div className="space-y-3">
            {customers.slice(0, 5).map(c => (
              <div
                key={c.id}
                className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => navigate(`/admin/customers/${c.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Progress value={c.score} className="w-16 h-2" />
                  <Badge 
                    variant="secondary" 
                    className={`text-xs min-w-[36px] justify-center ${
                      c.score >= 60 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 
                      c.score >= 30 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : 
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {c.score}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
