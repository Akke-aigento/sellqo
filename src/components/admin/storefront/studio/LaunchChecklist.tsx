import { Check, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useLaunchChecklist, type ChecklistItem } from '@/hooks/useLaunchChecklist';

interface LaunchChecklistProps {
  /** Navigeert naar een sectie binnen de studio. */
  onNavigate: (section: string) => void;
}

function ChecklistRow({
  item,
  onNavigate,
}: {
  item: ChecklistItem;
  onNavigate: (section: string) => void;
}) {
  const inner = (
    <>
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          item.done
            ? 'border-emerald-600 bg-emerald-600 text-white'
            : 'border-muted-foreground/30'
        )}
      >
        {item.done && <Check className="h-3 w-3" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-medium', item.done && 'text-muted-foreground')}>
          {item.label}
        </span>
        <span className="block text-xs text-muted-foreground">{item.description}</span>
      </span>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </>
  );

  const className =
    'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50';

  const target = item.target;

  if (target.kind === 'route') {
    return (
      <Link to={target.href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => onNavigate(target.section)} className={className}>
      {inner}
    </button>
  );
}

export function LaunchChecklist({ onNavigate }: LaunchChecklistProps) {
  const { items, completed, total } = useLaunchChecklist();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Klaar om te lanceren?</CardTitle>
        <CardDescription>
          {completed === total
            ? 'Alles staat klaar. Je winkel is compleet.'
            : `${completed} van ${total} stappen afgerond`}
        </CardDescription>
        <Progress value={(completed / total) * 100} className="mt-2 h-1.5" />
      </CardHeader>
      <CardContent className="space-y-0.5">
        {items.map((item) => (
          <ChecklistRow key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </CardContent>
    </Card>
  );
}
