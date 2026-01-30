import { useRef, useState, useCallback, useEffect } from 'react';

const NOTIFICATION_SOUND_URL = '/sounds/notification.mp3';
const STORAGE_KEY = 'notification_sound_enabled';

export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== 'disabled';
  });

  // Persist preference to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, enabled ? 'enabled' : 'disabled');
  }, [enabled]);

  const playSound = useCallback(() => {
    if (!enabled) return;
    
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
        audioRef.current.volume = 0.5;
      }
      
      // Reset and play
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        // Browser blocked autoplay - this is expected behavior
        console.log('Audio playback blocked by browser:', err.message);
      });
    } catch (error) {
      console.log('Failed to play notification sound:', error);
    }
  }, [enabled]);

  const toggleEnabled = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  return { 
    playSound, 
    enabled, 
    setEnabled,
    toggleEnabled 
  };
}
