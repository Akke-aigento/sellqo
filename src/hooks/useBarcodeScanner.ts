import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScanner {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxDelay?: number;
}

/**
 * Hook for detecting barcode scanner input.
 * 
 * Barcode scanners typically work like keyboards, typing characters very quickly
 * and ending with an Enter key. This hook detects that pattern and triggers
 * the onScan callback with the scanned barcode.
 * 
 * @param onScan - Callback when a barcode is detected
 * @param enabled - Whether the scanner is active (default: true)
 * @param minLength - Minimum barcode length to be valid (default: 4)
 * @param maxDelay - Maximum delay between keystrokes in ms (default: 50)
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minLength = 4,
  maxDelay = 50,
}: UseBarcodeScanner) {
  const bufferRef = useRef<string>('');
  const lastKeystrokeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
  }, []);

  useEffect(() => {
    if (!enabled) {
      resetBuffer();
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLastKeystroke = now - lastKeystrokeRef.current;
      lastKeystrokeRef.current = now;

      // If too much time has passed, start a new buffer
      if (timeSinceLastKeystroke > maxDelay) {
        bufferRef.current = '';
      }

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Handle Enter key - check if we have a valid barcode
      if (event.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        
        if (barcode.length >= minLength) {
          // Prevent form submission if we detected a barcode
          event.preventDefault();
          event.stopPropagation();
          
          // Trigger callback
          onScan(barcode);
        }
        
        // Reset buffer
        bufferRef.current = '';
        return;
      }

      // Only add printable characters
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        // Check if the user is typing in an input field
        const activeElement = document.activeElement;
        const isTypingInInput = 
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.getAttribute('contenteditable') === 'true';

        // If typing in input, only capture if it looks like scanner input (fast keystrokes)
        if (isTypingInInput && timeSinceLastKeystroke > maxDelay && bufferRef.current.length === 0) {
          // This is likely manual typing, not scanner input
          return;
        }

        bufferRef.current += event.key;

        // Set a timeout to clear the buffer if no more input comes
        timeoutRef.current = setTimeout(() => {
          // If buffer is long enough and no Enter was pressed, still trigger
          // (some scanners might not send Enter)
          const barcode = bufferRef.current.trim();
          if (barcode.length >= minLength && timeSinceLastKeystroke < maxDelay) {
            onScan(barcode);
          }
          bufferRef.current = '';
        }, maxDelay * 3);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, minLength, maxDelay, onScan, resetBuffer]);

  return {
    resetBuffer,
  };
}
