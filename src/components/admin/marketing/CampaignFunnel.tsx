import { cn } from '@/lib/utils';
import { Send, CheckCircle2, Mail, MousePointerClick } from 'lucide-react';
import type { EmailCampaign } from '@/types/marketing';

interface CampaignFunnelProps {
  campaign: EmailCampaign;
}

export function CampaignFunnel({ campaign }: CampaignFunnelProps) {
  const steps = [
    {
      label: 'Verzonden',
      value: campaign.total_sent,
      percentage: 100,
      icon: Send,
      color: 'bg-blue-500',
      lightColor: 'bg-blue-100',
    },
    {
      label: 'Afgeleverd',
      value: campaign.total_delivered,
      percentage: campaign.total_sent > 0 
        ? (campaign.total_delivered / campaign.total_sent) * 100 
        : 0,
      icon: CheckCircle2,
      color: 'bg-green-500',
      lightColor: 'bg-green-100',
    },
    {
      label: 'Geopend',
      value: campaign.total_opened,
      percentage: campaign.total_sent > 0 
        ? (campaign.total_opened / campaign.total_sent) * 100 
        : 0,
      icon: Mail,
      color: 'bg-purple-500',
      lightColor: 'bg-purple-100',
    },
    {
      label: 'Geklikt',
      value: campaign.total_clicked,
      percentage: campaign.total_sent > 0 
        ? (campaign.total_clicked / campaign.total_sent) * 100 
        : 0,
      icon: MousePointerClick,
      color: 'bg-orange-500',
      lightColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const widthPercentage = Math.max(step.percentage, 10);
        
        return (
          <div key={step.label} className="relative">
            {/* Connector line */}
            {index > 0 && (
              <div className="absolute left-5 -top-4 w-0.5 h-4 bg-border" />
            )}
            
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                step.lightColor
              )}>
                <Icon className={cn("h-5 w-5", step.color.replace('bg-', 'text-'))} />
              </div>

              {/* Bar and label */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{step.label}</span>
                  <span className="text-muted-foreground">
                    {step.value.toLocaleString('nl-NL')} ({step.percentage.toFixed(1)}%)
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-1000 ease-out", step.color)}
                    style={{ width: `${widthPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
