import { useRef, useState, useCallback } from 'react';
import { Archive, Trash2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConversationItem } from './ConversationItem';
import type { Conversation } from '@/hooks/useInbox';

interface SwipeableConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  isChecked: boolean;
  onClick: () => void;
  onToggleCheck: () => void;
  onSwipeArchive: () => void;
  onSwipeDelete: () => void;
  onLongPress?: () => void;
}

const SWIPE_THRESHOLD = 80;
const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

export function SwipeableConversationItem({
  conversation,
  isSelected,
  isChecked,
  onClick,
  onToggleCheck,
  onSwipeArchive,
  onSwipeDelete,
  onLongPress,
}: SwipeableConversationItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);
  const isVerticalScroll = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const resetSwipe = useCallback(() => {
    setIsTransitioning(true);
    setTranslateX(0);
    setTimeout(() => setIsTransitioning(false), 300);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    isSwiping.current = false;
    isVerticalScroll.current = false;
    didLongPress.current = false;
    setIsTransitioning(false);

    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onToggleCheck();
    }, LONG_PRESS_MS);
  }, [onToggleCheck]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;

    // First significant move: decide direction
    if (!isSwiping.current && !isVerticalScroll.current) {
      if (Math.abs(deltaY) > MOVE_CANCEL_PX) {
        isVerticalScroll.current = true;
        clearLongPress();
        return;
      }
      if (Math.abs(deltaX) > MOVE_CANCEL_PX) {
        isSwiping.current = true;
        clearLongPress();
      }
    }

    if (isVerticalScroll.current) return;

    if (isSwiping.current) {
      // Clamp between -160 and 160
      const clamped = Math.max(-160, Math.min(160, deltaX));
      setTranslateX(clamped);
    }
  }, [clearLongPress]);

  const handleTouchEnd = useCallback(() => {
    clearLongPress();

    if (isSwiping.current) {
      if (translateX > SWIPE_THRESHOLD) {
        // Swiped right → archive
        onSwipeArchive();
      } else if (translateX < -SWIPE_THRESHOLD) {
        // Swiped left → delete
        onSwipeDelete();
      }
      resetSwipe();
      return;
    }

    // If it was a long-press, don't fire onClick
    if (didLongPress.current) return;

    // Normal tap
    if (!isVerticalScroll.current) {
      onClick();
    }
  }, [translateX, clearLongPress, resetSwipe, onSwipeArchive, onSwipeDelete, onClick]);

  const pastThreshold = Math.abs(translateX) > SWIPE_THRESHOLD;

  return (
    <div className="relative overflow-hidden border-b border-border">
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        {/* Right-swipe: archive (blue) */}
        <div
          className={cn(
            'flex items-center justify-start pl-5 flex-1 transition-colors',
            translateX > SWIPE_THRESHOLD ? 'bg-blue-500' : 'bg-blue-500/70'
          )}
        >
          <Archive className={cn(
            'h-5 w-5 text-white transition-transform',
            pastThreshold && translateX > 0 && 'scale-125'
          )} />
        </div>
        {/* Left-swipe: delete (red) */}
        <div
          className={cn(
            'flex items-center justify-end pr-5 flex-1 transition-colors',
            translateX < -SWIPE_THRESHOLD ? 'bg-destructive' : 'bg-destructive/70'
          )}
        >
          <Trash2 className={cn(
            'h-5 w-5 text-white transition-transform',
            pastThreshold && translateX < 0 && 'scale-125'
          )} />
        </div>
      </div>

      {/* Foreground: the actual conversation item */}
      <div
        className={cn(
          'relative bg-background',
          isTransitioning && 'transition-transform duration-300 ease-out',
          isChecked && 'bg-primary/10'
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Selection indicator */}
        {isChecked && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className={cn(isChecked && 'pl-8')}>
          <ConversationItem
            conversation={conversation}
            isSelected={isSelected}
            onClick={onClick}
          />
        </div>
      </div>
    </div>
  );
}
