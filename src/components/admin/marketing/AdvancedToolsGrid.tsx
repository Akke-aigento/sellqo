import { useState } from 'react';
import { 
  Instagram, Mail, ImageIcon, ChevronRight,
  Wand2, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SocialPostGenerator } from './SocialPostGenerator';
import { AIEmailPlanner } from './AIEmailPlanner';
import { AIImageGenerator } from './AIImageGenerator';
import { useAICredits } from '@/hooks/useAICredits';
import { cn } from '@/lib/utils';

type ToolType = 'social' | 'email' | 'images' | null;

const tools = [
  {
    id: 'social' as const,
    name: 'Social Media',
    description: 'Posts voor Instagram, Facebook, LinkedIn & X',
    icon: Instagram,
    gradient: 'from-pink-500 to-purple-500',
    credits: 2,
  },
  {
    id: 'email' as const,
    name: 'Email Content',
    description: 'Nieuwsbrieven, promoties & win-back',
    icon: Mail,
    gradient: 'from-blue-500 to-cyan-500',
    credits: 3,
  },
  {
    id: 'images' as const,
    name: 'Afbeeldingen',
    description: 'Marketing visuals en product styling',
    icon: ImageIcon,
    gradient: 'from-amber-500 to-orange-500',
    credits: 5,
  },
];

export function AdvancedToolsGrid() {
  const [openTool, setOpenTool] = useState<ToolType>(null);
  const { getCreditCost } = useAICredits();

  const handleToggle = (toolId: ToolType) => {
    setOpenTool(openTool === toolId ? null : toolId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wand2 className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Geavanceerde Tools</h3>
      </div>
      
      <div className="grid gap-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isOpen = openTool === tool.id;
          
          return (
            <Collapsible key={tool.id} open={isOpen} onOpenChange={() => handleToggle(tool.id)}>
              <Card className={cn(
                "transition-all",
                isOpen && "ring-2 ring-primary/20"
              )}>
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left">
                    <CardHeader className="py-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-3 rounded-lg bg-gradient-to-br shrink-0",
                          tool.gradient
                        )}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base flex items-center gap-2">
                            {tool.name}
                            <Badge variant="outline" className="text-xs font-normal">
                              {getCreditCost(tool.id === 'social' ? 'social_post' : tool.id === 'email' ? 'email_content' : 'image_generation')} cr
                            </Badge>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {tool.description}
                          </p>
                        </div>
                        <ChevronRight className={cn(
                          "h-5 w-5 text-muted-foreground transition-transform shrink-0",
                          isOpen && "rotate-90"
                        )} />
                      </div>
                    </CardHeader>
                  </button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-6">
                    <div className="border-t pt-6">
                      {tool.id === 'social' && <SocialPostGenerator />}
                      {tool.id === 'email' && <AIEmailPlanner />}
                      {tool.id === 'images' && <AIImageGenerator />}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
