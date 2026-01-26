import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAppFeedback } from '@/hooks/useAppFeedback';
import { cn } from '@/lib/utils';

interface FeedbackPopupProps {
  milestoneId?: string;
  onClose: () => void;
}

const RATING_EMOJIS = [
  { value: 1, emoji: '😞', label: 'Ontevreden' },
  { value: 2, emoji: '😐', label: 'Matig' },
  { value: 3, emoji: '🙂', label: 'Oké' },
  { value: 4, emoji: '😊', label: 'Tevreden' },
  { value: 5, emoji: '🤩', label: 'Geweldig' },
];

export function FeedbackPopup({ milestoneId, onClose }: FeedbackPopupProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const { submitFeedback, isSubmitting } = useAppFeedback();

  const handleSubmit = async () => {
    if (rating === null) return;

    await submitFeedback({
      milestoneId,
      rating,
      isSatisfied: rating >= 4,
      feedbackText: feedbackText.trim() || undefined,
    });

    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <DialogTitle className="text-xl">💬 Even een vraagje...</DialogTitle>
          <DialogDescription className="text-base pt-2">
            Ben je tevreden over je ervaring met SellQo?
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Emoji rating */}
          <div className="flex justify-center gap-2">
            {RATING_EMOJIS.map((item) => (
              <button
                key={item.value}
                onClick={() => setRating(item.value)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-lg transition-all',
                  'hover:bg-muted/80',
                  rating === item.value
                    ? 'bg-primary/10 ring-2 ring-primary scale-110'
                    : 'bg-muted/50'
                )}
              >
                <span className="text-3xl">{item.emoji}</span>
                <span className="text-xs text-muted-foreground">{item.value}</span>
              </button>
            ))}
          </div>

          {/* Feedback text */}
          {rating !== null && (
            <div className="space-y-2 animate-fade-in">
              <label className="text-sm text-muted-foreground">
                Wat kunnen we verbeteren? (optioneel)
              </label>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Deel je gedachten..."
                className="min-h-[80px] resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkip}>
            Later
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={rating === null || isSubmitting}
          >
            Verstuur feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
