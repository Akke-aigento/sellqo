import { cn } from '@/lib/utils';
import type { HealthStatus } from '@/config/healthMessages';

interface HealthStatusIndicatorProps {
  status: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

const statusColors: Record<HealthStatus, { bg: string; ring: string; dot: string }> = {
  healthy: {
    bg: 'bg-emerald-500/20',
    ring: 'ring-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  attention: {
    bg: 'bg-amber-500/20',
    ring: 'ring-amber-500/30',
    dot: 'bg-amber-500',
  },
  warning: {
    bg: 'bg-orange-500/20',
    ring: 'ring-orange-500/30',
    dot: 'bg-orange-500',
  },
  critical: {
    bg: 'bg-red-500/20',
    ring: 'ring-red-500/30',
    dot: 'bg-red-500',
  },
};

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export function HealthStatusIndicator({ status, size = 'md', pulse = false }: HealthStatusIndicatorProps) {
  const colors = statusColors[status];
  
  return (
    <span className={cn('relative inline-flex', sizeClasses[size])}>
      <span
        className={cn(
          'absolute inset-0 rounded-full',
          colors.bg,
          colors.ring,
          'ring-2',
          pulse && status === 'critical' && 'animate-ping'
        )}
      />
      <span
        className={cn(
          'relative inline-flex rounded-full',
          colors.dot,
          sizeClasses[size]
        )}
      />
    </span>
  );
}

export function HealthStatusBadge({ status }: { status: HealthStatus }) {
  const labels: Record<HealthStatus, string> = {
    healthy: 'Gezond',
    attention: 'Aandacht',
    warning: 'Waarschuwing',
    critical: 'Kritiek',
  };
  
  const colors: Record<HealthStatus, string> = {
    healthy: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    attention: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    warning: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    critical: 'bg-red-500/10 text-red-600 border-red-500/20',
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        colors[status]
      )}
    >
      <HealthStatusIndicator status={status} size="sm" />
      {labels[status]}
    </span>
  );
}
