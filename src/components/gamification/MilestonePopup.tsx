import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getNextMilestone, getMilestoneProgress, type MilestoneType } from '@/config/milestones';

interface PendingMilestone {
  id: string;
  type: MilestoneType;
  value: number;
  badgeId: string;
  badgeName: string;
  emoji: string;
  title: string;
  description: string;
  celebrationMessage: string;
  shouldRequestFeedback: boolean;
}

interface MilestonePopupProps {
  milestone: PendingMilestone;
  currentValue: number;
  onClose: (requestFeedback: boolean) => void;
}

export function MilestonePopup({ milestone, currentValue, onClose }: MilestonePopupProps) {
  const hasPlayedConfetti = useRef(false);

  // Play confetti on mount
  useEffect(() => {
    if (hasPlayedConfetti.current) return;
    hasPlayedConfetti.current = true;

    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFD700', '#FFA500', '#FF6347', '#32CD32', '#1E90FF'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFD700', '#FFA500', '#FF6347', '#32CD32', '#1E90FF'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const nextMilestone = getNextMilestone(milestone.type, currentValue);
  const progress = getMilestoneProgress(milestone.type, currentValue);

  const formatValue = (type: MilestoneType, value: number) => {
    if (type === 'revenue') {
      return `€${value.toLocaleString('nl-NL')}`;
    }
    return value.toLocaleString('nl-NL');
  };

  const handleClose = () => {
    onClose(milestone.shouldRequestFeedback);
  };

  return (
    <Dialog open={true} onOpenChange={() => handleClose()}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="space-y-4">
          <div className="mx-auto">
            <div className="text-6xl animate-bounce">{milestone.emoji}</div>
          </div>
          <DialogTitle className="text-2xl">
            🎉 {milestone.title} 🎉
          </DialogTitle>
          <DialogDescription className="text-base">
            {milestone.celebrationMessage}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Badge display */}
          <div className="inline-flex flex-col items-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800">
            <span className="text-4xl">{milestone.emoji}</span>
            <span className="font-semibold text-amber-900 dark:text-amber-100">
              {milestone.badgeName}
            </span>
            <span className="text-sm text-muted-foreground">
              Badge verdiend!
            </span>
          </div>
        </div>

        {/* Next milestone progress */}
        {nextMilestone && (
          <div className="space-y-2 text-left bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Volgende milestone:</span>
              <span className="font-medium">
                {nextMilestone.emoji} {formatValue(milestone.type, nextMilestone.value)}
              </span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
            <div className="text-xs text-muted-foreground text-right">
              {formatValue(milestone.type, currentValue)} / {formatValue(milestone.type, nextMilestone.value)} ({progress.percentage}%)
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-center pt-4">
          <Button onClick={handleClose} size="lg" className="gap-2">
            🎉 Geweldig!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
