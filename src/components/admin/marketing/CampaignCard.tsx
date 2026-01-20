import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { MoreHorizontal, Send, Eye, Trash2, Edit, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { EmailCampaign, CampaignStatus } from '@/types/marketing';

interface CampaignCardProps {
  campaign: EmailCampaign;
  onDelete: (id: string) => void;
  onSend: (id: string) => void;
}

const statusConfig: Record<CampaignStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Concept', variant: 'secondary' },
  scheduled: { label: 'Gepland', variant: 'outline' },
  sending: { label: 'Verzenden...', variant: 'default' },
  sent: { label: 'Verzonden', variant: 'default' },
  paused: { label: 'Gepauzeerd', variant: 'outline' },
  cancelled: { label: 'Geannuleerd', variant: 'destructive' },
};

export function CampaignCard({ campaign, onDelete, onSend }: CampaignCardProps) {
  const navigate = useNavigate();
  const status = statusConfig[campaign.status as CampaignStatus] || statusConfig.draft;

  const openRate = campaign.total_sent > 0 
    ? ((campaign.total_opened / campaign.total_sent) * 100).toFixed(1)
    : '0';
  
  const clickRate = campaign.total_sent > 0 
    ? ((campaign.total_clicked / campaign.total_sent) * 100).toFixed(1)
    : '0';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{campaign.name}</CardTitle>
          <CardDescription className="text-sm">
            {campaign.subject}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/admin/marketing/campaigns/${campaign.id}`)}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Bekijk details
              </DropdownMenuItem>
              {campaign.status === 'draft' && (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/admin/marketing/campaigns/${campaign.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Bewerken
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSend(campaign.id)}>
                    <Send className="mr-2 h-4 w-4" />
                    Nu verzenden
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => onDelete(campaign.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            {campaign.segment && (
              <span className="text-muted-foreground">
                Segment: <span className="font-medium text-foreground">{campaign.segment.name}</span>
              </span>
            )}
            {campaign.sent_at && (
              <span className="text-muted-foreground">
                Verzonden: {format(new Date(campaign.sent_at), 'PPp', { locale: nl })}
              </span>
            )}
            {campaign.scheduled_at && campaign.status === 'scheduled' && (
              <span className="text-muted-foreground">
                Gepland: {format(new Date(campaign.scheduled_at), 'PPp', { locale: nl })}
              </span>
            )}
          </div>
          
          {campaign.status === 'sent' && (
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>{campaign.total_sent} verzonden</span>
              <span>{openRate}% open</span>
              <span>{clickRate}% clicks</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
