import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface CelebrationConfettiProps {
  trigger?: boolean;
}

export function CelebrationConfetti({ trigger = true }: CelebrationConfettiProps) {
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!trigger || hasTriggered.current) return;
    
    hasTriggered.current = true;

    // Create a canvas for confetti
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    // Initial burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
    });

    // Continuous confetti
    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      // Left side
      confetti({
        particleCount: Math.floor(particleCount / 2),
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b'],
      });

      // Right side
      confetti({
        particleCount: Math.floor(particleCount / 2),
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ['#ef4444', '#8b5cf6', '#ec4899'],
      });
    }, 250);

    return () => {
      clearInterval(interval);
    };
  }, [trigger]);

  return null;
}

// Export a function for manual triggering
export function triggerConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
  });
}
