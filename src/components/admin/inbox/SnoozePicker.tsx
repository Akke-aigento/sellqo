import { Clock, Sun, Calendar } from 'lucide-react';
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface SnoozePickerProps {
  onSnooze: (until: Date) => void;
}

export function SnoozePicker({ onSnooze }: SnoozePickerProps) {
  const snoozeOptions = [
    {
      label: 'Over 1 uur',
      icon: Clock,
      getDate: () => {
        const d = new Date();
        d.setHours(d.getHours() + 1);
        return d;
      },
    },
    {
      label: 'Later vandaag',
      icon: Clock,
      getDate: () => {
        const d = new Date();
        d.setHours(17, 0, 0, 0);
        if (d <= new Date()) d.setDate(d.getDate() + 1);
        return d;
      },
    },
    {
      label: 'Morgen',
      icon: Sun,
      getDate: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
    {
      label: 'Over 3 dagen',
      icon: Calendar,
      getDate: () => {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
    {
      label: 'Volgende week',
      icon: Calendar,
      getDate: () => {
        const d = new Date();
        d.setDate(d.getDate() + (8 - d.getDay())); // Next Monday
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
  ];

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Clock className="h-4 w-4 mr-2" />
        Snooze
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {snoozeOptions.map((option) => (
          <DropdownMenuItem key={option.label} onClick={() => onSnooze(option.getDate())}>
            <option.icon className="h-4 w-4 mr-2" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
