import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Edit2, Star, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAIFeedback } from '@/hooks/useAIFeedback';
import { cn } from '@/lib/utils';

interface AIFeedbackWidgetProps {
  contentId?: string;
  contentType: 'social' | 'email' | 'image' | 'suggestion';
  originalContent: string;
  className?: string;
  compact?: boolean;
  onEdit?: () => void;
}

const EDIT_REASONS = [
  { id: 'tone', label: 'Toon was niet goed' },
  { id: 'length', label: 'Te lang of te kort' },
  { id: 'relevance', label: 'Niet relevant voor doelgroep' },
  { id: 'style', label: 'Stijl past niet bij merk' },
  { id: 'factual', label: 'Feitelijke fouten' },
  { id: 'other', label: 'Anders' },
];

export function AIFeedbackWidget({
  contentId,
  contentType,
  originalContent,
  className,
  compact = false,
  onEdit,
}: AIFeedbackWidgetProps) {
  const { submitFeedback } = useAIFeedback();
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comments, setComments] = useState('');
  const [rating, setRating] = useState(0);

  const handleQuickFeedback = async (type: 'positive' | 'negative') => {
    setFeedbackGiven(type);
    
    if (type === 'positive') {
      await submitFeedback.mutateAsync({
        contentId,
        feedbackType: 'positive',
        originalContent,
        contentType,
        rating: 5,
      });
    } else {
      setShowDetails(true);
    }
  };

  const handleSubmitDetailedFeedback = async () => {
    await submitFeedback.mutateAsync({
      contentId,
      feedbackType: 'negative',
      originalContent,
      contentType,
      rating,
      comments,
      editReason: selectedReasons.join(', '),
      metadata: { reasons: selectedReasons },
    });
    setShowDetails(false);
  };

  const handleReasonToggle = (reasonId: string) => {
    setSelectedReasons(prev => 
      prev.includes(reasonId) 
        ? prev.filter(r => r !== reasonId)
        : [...prev, reasonId]
    );
  };

  if (feedbackGiven) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-green-600', className)}>
        <Check className="h-4 w-4" />
        <span>Bedankt!</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => handleQuickFeedback('positive')}
          disabled={submitFeedback.isPending}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Popover open={showDetails} onOpenChange={setShowDetails}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleQuickFeedback('negative')}
              disabled={submitFeedback.isPending}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <FeedbackDetailsForm
              selectedReasons={selectedReasons}
              onReasonToggle={handleReasonToggle}
              comments={comments}
              onCommentsChange={setComments}
              rating={rating}
              onRatingChange={setRating}
              onSubmit={handleSubmitDetailedFeedback}
              onCancel={() => setShowDetails(false)}
              isSubmitting={submitFeedback.isPending}
            />
          </PopoverContent>
        </Popover>
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onEdit}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Was dit nuttig?</span>
        <div className="flex items-center gap-1">
          <Button
            variant={feedbackGiven === 'positive' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickFeedback('positive')}
            disabled={submitFeedback.isPending}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            Ja
          </Button>
          <Popover open={showDetails} onOpenChange={setShowDetails}>
            <PopoverTrigger asChild>
              <Button
                variant={feedbackGiven === 'negative' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickFeedback('negative')}
                disabled={submitFeedback.isPending}
              >
                <ThumbsDown className="h-4 w-4 mr-1" />
                Nee
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <FeedbackDetailsForm
                selectedReasons={selectedReasons}
                onReasonToggle={handleReasonToggle}
                comments={comments}
                onCommentsChange={setComments}
                rating={rating}
                onRatingChange={setRating}
                onSubmit={handleSubmitDetailedFeedback}
                onCancel={() => setShowDetails(false)}
                isSubmitting={submitFeedback.isPending}
              />
            </PopoverContent>
          </Popover>
        </div>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit2 className="h-4 w-4 mr-1" />
            Aanpassen
          </Button>
        )}
      </div>
    </div>
  );
}

interface FeedbackDetailsFormProps {
  selectedReasons: string[];
  onReasonToggle: (id: string) => void;
  comments: string;
  onCommentsChange: (value: string) => void;
  rating: number;
  onRatingChange: (value: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function FeedbackDetailsForm({
  selectedReasons,
  onReasonToggle,
  comments,
  onCommentsChange,
  rating,
  onRatingChange,
  onSubmit,
  onCancel,
  isSubmitting,
}: FeedbackDetailsFormProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Wat kunnen we verbeteren?</h4>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {EDIT_REASONS.map(reason => (
          <div key={reason.id} className="flex items-center space-x-2">
            <Checkbox
              id={reason.id}
              checked={selectedReasons.includes(reason.id)}
              onCheckedChange={() => onReasonToggle(reason.id)}
            />
            <Label htmlFor={reason.id} className="text-sm font-normal cursor-pointer">
              {reason.label}
            </Label>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Beoordeling</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onClick={() => onRatingChange(star)}
              className="focus:outline-none"
            >
              <Star
                className={cn(
                  'h-5 w-5 transition-colors',
                  star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="comments" className="text-sm">Opmerkingen (optioneel)</Label>
        <Textarea
          id="comments"
          value={comments}
          onChange={(e) => onCommentsChange(e.target.value)}
          placeholder="Vertel ons meer..."
          className="h-20 resize-none"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Annuleren
        </Button>
        <Button size="sm" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Verzenden...' : 'Verstuur'}
        </Button>
      </div>
    </div>
  );
}
