import { Languages } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export type AILanguage = 'nl' | 'en' | 'de' | 'fr';

interface LanguageSelectorProps {
  value: AILanguage;
  onChange: (value: AILanguage) => void;
  className?: string;
  showLabel?: boolean;
}

const languages: { id: AILanguage; name: string; flag: string }[] = [
  { id: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { id: 'en', name: 'English', flag: '🇬🇧' },
  { id: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { id: 'fr', name: 'Français', flag: '🇫🇷' },
];

export function LanguageSelector({ value, onChange, className, showLabel = true }: LanguageSelectorProps) {
  return (
    <div className={className}>
      {showLabel && (
        <Label className="flex items-center gap-1 mb-2">
          <Languages className="h-4 w-4" />
          Taal
        </Label>
      )}
      <Select value={value} onValueChange={(v) => onChange(v as AILanguage)}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {languages.find(l => l.id === value)?.flag} {languages.find(l => l.id === value)?.name}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang.id} value={lang.id}>
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
