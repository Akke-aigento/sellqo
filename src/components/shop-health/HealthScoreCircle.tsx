import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { HealthStatus } from '@/config/healthMessages';

interface HealthScoreCircleProps {
  score: number;
  status: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const statusColors: Record<HealthStatus, { stroke: string; glow: string }> = {
  healthy: {
    stroke: 'stroke-emerald-500',
    glow: 'drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]',
  },
  attention: {
    stroke: 'stroke-amber-500',
    glow: 'drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  },
  warning: {
    stroke: 'stroke-orange-500',
    glow: 'drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]',
  },
  critical: {
    stroke: 'stroke-red-500',
    glow: 'drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]',
  },
};

const sizeConfig = {
  sm: { size: 80, strokeWidth: 6, textSize: 'text-lg' },
  md: { size: 120, strokeWidth: 8, textSize: 'text-2xl' },
  lg: { size: 160, strokeWidth: 10, textSize: 'text-4xl' },
};

export function HealthScoreCircle({ 
  score, 
  status, 
  size = 'md', 
  animated = true 
}: HealthScoreCircleProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const config = sizeConfig[size];
  const colors = statusColors[status];
  
  const radius = (config.size - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (displayScore / 100) * circumference;
  
  // Animate score on mount
  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }
    
    const duration = 1500;
    const startTime = Date.now();
    const startScore = displayScore;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out-cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startScore + (score - startScore) * eased);
      
      setDisplayScore(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [score, animated]);
  
  const emoji = status === 'healthy' ? '💚' : 
                status === 'attention' ? '🟡' : 
                status === 'warning' ? '🟠' : '🔴';
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={config.size}
        height={config.size}
        className={cn('transform -rotate-90', colors.glow)}
      >
        {/* Background circle */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={config.strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          className={cn(colors.stroke, 'transition-all duration-1000')}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: animated ? 'stroke-dashoffset 1.5s ease-out' : 'none',
          }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-bold', config.textSize)}>
          {displayScore}
        </span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
      
      {/* Emoji badge */}
      <span className="absolute -top-1 -right-1 text-lg">
        {emoji}
      </span>
    </div>
  );
}
