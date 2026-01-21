import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Check } from 'lucide-react';
import { layoutPresets } from '@/config/dashboardWidgets';
import { useDashboardPreferences } from '@/hooks/useDashboardPreferences';

export function DashboardLayoutSwitcher() {
  const { layoutType, setLayout, isUpdating } = useDashboardPreferences();

  const currentPreset = layoutPresets.find((p) => p.id === layoutType) || layoutPresets[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isUpdating}>
          <currentPreset.icon className="h-4 w-4 mr-2" />
          {currentPreset.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Kies layout</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {layoutPresets.map((preset) => {
          const isActive = preset.id === layoutType;
          const Icon = preset.icon;
          return (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => setLayout(preset.id)}
              className="flex items-start gap-3 py-2"
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{preset.name}</span>
                  {isActive && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {preset.description}
                </p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
