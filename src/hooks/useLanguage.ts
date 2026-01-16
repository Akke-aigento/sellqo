import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface SupportedLanguage {
  code: string;
  name: string;
  flag: string;
}

export const supportedLanguages: SupportedLanguage[] = [
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export function useLanguage() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [profileLanguage, setProfileLanguage] = useState<string | null>(null);

  // Load language from profile when user is authenticated
  useEffect(() => {
    const loadUserLanguage = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('language')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data?.language && ['nl', 'en', 'de', 'fr'].includes(data.language)) {
          setProfileLanguage(data.language);
          i18n.changeLanguage(data.language);
          localStorage.setItem('preferredLanguage', data.language);
        }
      } catch (error) {
        console.error('Error loading user language:', error);
      }
    };

    loadUserLanguage();
  }, [user, i18n]);

  const setLanguage = useCallback(async (languageCode: string) => {
    if (!['nl', 'en', 'de', 'fr'].includes(languageCode)) return;

    setIsLoading(true);

    try {
      // Update UI immediately
      i18n.changeLanguage(languageCode);
      localStorage.setItem('preferredLanguage', languageCode);
      setProfileLanguage(languageCode);

      // Save to profile if user is authenticated
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ language: languageCode })
          .eq('id', user.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving language preference:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, i18n]);

  return {
    language: i18n.language,
    setLanguage,
    supportedLanguages,
    isLoading,
  };
}
