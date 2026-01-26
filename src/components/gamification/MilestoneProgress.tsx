import { Progress } from '@/components/ui/progress';
import { getMilestoneProgress, getNextMilestone, type MilestoneType } from '@/config/milestones';

interface MilestoneProgressProps {
  type: MilestoneType;
  currentValue: number;
  showLabel?: boolean;
}

export function MilestoneProgress({ type, currentValue, showLabel = true }: MilestoneProgressProps) {
  const progress = getMilestoneProgress(type, currentValue);
  const nextMilestone = getNextMilestone(type, currentValue);

  if (!nextMilestone) {
    return (
      <div className="space-y-1">
        {showLabel && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>🏆 Alle milestones behaald!</span>
          </div>
        )}
        <Progress value={100} className="h-2" />
      </div>
    );
  }

  const formatValue = (value: number) => {
    if (type === 'revenue') {
      return `€${value.toLocaleString('nl-NL')}`;
    }
    return value.toLocaleString('nl-NL');
  };

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Volgende: {nextMilestone.emoji} {nextMilestone.badgeName}
          </span>
          <span className="font-medium">
            {progress.percentage}%
          </span>
        </div>
      )}
      <Progress value={progress.percentage} className="h-2" />
      {showLabel && (
        <div className="text-xs text-muted-foreground text-right">
          {formatValue(currentValue)} / {formatValue(nextMilestone.value)}
        </div>
      )}
    </div>
  );
}
