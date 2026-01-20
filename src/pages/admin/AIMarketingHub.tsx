import { useState } from 'react';
import { 
  Sparkles, Bot, Zap, ArrowLeft, 
  Instagram, Mail, Lightbulb, TrendingUp,
  Image as ImageIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AICreditsBadge } from '@/components/admin/marketing/AICreditsBadge';
import { AIInsightsCard } from '@/components/admin/marketing/AIInsightsCard';
import { SocialPostGenerator } from '@/components/admin/marketing/SocialPostGenerator';
import { AIEmailPlanner } from '@/components/admin/marketing/AIEmailPlanner';
import { AICampaignSuggestions } from '@/components/admin/marketing/AICampaignSuggestions';
import { useAIMarketing } from '@/hooks/useAIMarketing';

export default function AIMarketingHub() {
  const [activeTab, setActiveTab] = useState('overview');
  const { context, contextLoading } = useAIMarketing();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/marketing">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                <Bot className="h-5 w-5 text-white" />
              </div>
              Sellqo AI Marketing
            </h1>
            <p className="text-muted-foreground">
              Je persoonlijke AI marketing assistent
            </p>
          </div>
        </div>
        <AICreditsBadge variant="full" onUpgrade={() => {/* TODO: Open upgrade dialog */}} />
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Overzicht
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <Instagram className="h-4 w-4" />
            Social Media
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Suggesties
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* AI Insights */}
            <AIInsightsCard />

            {/* Quick Actions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">AI Acties</h3>
              <div className="grid gap-3">
                <button
                  onClick={() => setActiveTab('social')}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:border-pink-500/50 hover:bg-pink-500/5 transition-all text-left group"
                >
                  <div className="p-3 rounded-lg bg-gradient-to-br from-pink-500 to-purple-500">
                    <Instagram className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium group-hover:text-pink-600 transition-colors">
                      Social Media Post Genereren
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Maak posts voor Instagram, Facebook, LinkedIn & X
                    </p>
                  </div>
                  <Zap className="h-5 w-5 text-muted-foreground group-hover:text-pink-500" />
                </button>

                <button
                  onClick={() => setActiveTab('email')}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left group"
                >
                  <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium group-hover:text-blue-600 transition-colors">
                      Email Campagne Content
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Laat AI je nieuwsbrief of promotie schrijven
                    </p>
                  </div>
                  <Zap className="h-5 w-5 text-muted-foreground group-hover:text-blue-500" />
                </button>

                <button
                  onClick={() => setActiveTab('suggestions')}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left group"
                >
                  <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
                    <Lightbulb className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium group-hover:text-amber-600 transition-colors">
                      Campagne Suggesties
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      AI analyseert je data en suggereert campagnes
                    </p>
                  </div>
                  <Zap className="h-5 w-5 text-muted-foreground group-hover:text-amber-500" />
                </button>

                <button
                  disabled
                  className="flex items-center gap-4 p-4 rounded-lg border opacity-50 cursor-not-allowed text-left"
                >
                  <div className="p-3 rounded-lg bg-gradient-to-br from-green-500 to-teal-500">
                    <ImageIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">
                      AI Visual Studio
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Genereer en bewerk afbeeldingen
                    </p>
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded">Binnenkort</span>
                </button>
              </div>
            </div>
          </div>

          {/* Data Summary */}
          {context && (
            <div className="p-4 rounded-lg border bg-muted/30">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Je Marketing Context
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div>
                  <p className="text-2xl font-bold">{context.products.total}</p>
                  <p className="text-xs text-muted-foreground">Producten</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{context.customers.subscribers}</p>
                  <p className="text-xs text-muted-foreground">Abonnees</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{context.orders.lastMonth}</p>
                  <p className="text-xs text-muted-foreground">Orders (30d)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">€{context.orders.avgOrderValue}</p>
                  <p className="text-xs text-muted-foreground">Gem. order</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{context.campaigns.avgOpenRate}%</p>
                  <p className="text-xs text-muted-foreground">Open rate</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{context.products.lowStock.length}</p>
                  <p className="text-xs text-muted-foreground">Lage voorraad</p>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Social Media Tab */}
        <TabsContent value="social">
          <SocialPostGenerator />
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email">
          <AIEmailPlanner />
        </TabsContent>

        {/* Suggestions Tab */}
        <TabsContent value="suggestions">
          <AICampaignSuggestions />
        </TabsContent>
      </Tabs>
    </div>
  );
}
