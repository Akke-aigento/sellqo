import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Star, 
  RefreshCw, 
  Plus, 
  Settings2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { useReviewsHub } from '@/hooks/useReviewsHub';
import { ReviewsPlatformConfig } from './ReviewsPlatformConfig';
import { ReviewsManager } from './ReviewsManager';
import { ReviewsHubSettings } from './ReviewsHubSettings';
import { 
  REVIEW_PLATFORMS, 
  getPlatformInfo,
  type ReviewPlatform,
  type ReviewPlatformConnection 
} from '@/types/reviews-hub';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

export function ReviewsHub() {
  const { 
    connections, 
    reviews, 
    aggregateData, 
    isLoading,
    syncPlatform,
    syncAllPlatforms,
    deleteConnection
  } = useReviewsHub();
  
  const [selectedPlatform, setSelectedPlatform] = useState<ReviewPlatform | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  const handleAddPlatform = (platform: ReviewPlatform) => {
    setSelectedPlatform(platform);
    setConfigDialogOpen(true);
  };

  const handleEditPlatform = (connection: ReviewPlatformConnection) => {
    setSelectedPlatform(connection.platform as ReviewPlatform);
    setConfigDialogOpen(true);
  };

  const getStatusBadge = (connection: ReviewPlatformConnection) => {
    if (!connection.is_enabled) {
      return <Badge variant="outline" className="text-muted-foreground">Uitgeschakeld</Badge>;
    }
    
    switch (connection.sync_status) {
      case 'success':
        return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Actief</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Fout</Badge>;
      case 'syncing':
        return <Badge className="bg-blue-500/10 text-blue-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Bezig...</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Wacht</Badge>;
    }
  };

  const connectedPlatforms = connections.map(c => c.platform);
  const availablePlatforms = REVIEW_PLATFORMS.filter(p => !connectedPlatforms.includes(p.id));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aggregate Score Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                Reviews Hub
              </CardTitle>
              <CardDescription>
                Beheer al je externe reviews vanuit één plek
              </CardDescription>
            </div>
            <Button 
              onClick={() => syncAllPlatforms.mutate()}
              disabled={syncAllPlatforms.isPending || connections.filter(c => c.is_enabled).length === 0}
            >
              {syncAllPlatforms.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Alles Synchroniseren
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aggregateData.total_reviews > 0 ? (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-foreground">{aggregateData.average_rating}</div>
                <div className="flex items-center justify-center gap-0.5 my-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= Math.round(aggregateData.average_rating)
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-sm text-muted-foreground">
                  {aggregateData.total_reviews} reviews
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
                {aggregateData.platforms.map(platform => (
                  <div 
                    key={platform.platform}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                  >
                    <img 
                      src={platform.logo} 
                      alt={platform.name}
                      className="w-5 h-5 rounded"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{platform.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {platform.rating} ★ · {platform.count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Nog geen reviews gekoppeld</p>
              <p className="text-sm">Koppel een platform om te starten</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="platforms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="platforms">Platformen</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          <TabsTrigger value="settings">Weergave</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="space-y-4">
          {/* Connected Platforms */}
          {connections.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Gekoppelde Platformen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {connections.map(connection => {
                    const platformInfo = getPlatformInfo(connection.platform as ReviewPlatform);
                    return (
                      <div 
                        key={connection.id}
                        className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: platformInfo.bgColor }}
                        >
                          <img 
                            src={platformInfo.logo} 
                            alt={platformInfo.name}
                            className="w-6 h-6"
                            onError={(e) => { 
                              e.currentTarget.parentElement!.innerHTML = platformInfo.name[0]; 
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{platformInfo.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {connection.cached_rating ? (
                              <span>{connection.cached_rating} ★ · {connection.cached_review_count} reviews</span>
                            ) : (
                              <span>Nog niet gesynchroniseerd</span>
                            )}
                            {connection.last_synced_at && (
                              <span className="ml-2">
                                · {formatDistanceToNow(new Date(connection.last_synced_at), { locale: nl, addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(connection)}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => syncPlatform.mutate(connection.platform as ReviewPlatform)}
                            disabled={syncPlatform.isPending || !connection.is_enabled}
                          >
                            <RefreshCw className={`h-4 w-4 ${syncPlatform.isPending ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEditPlatform(connection)}
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          {connection.external_url && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              asChild
                            >
                              <a href={connection.external_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Weet je zeker dat je ${platformInfo.name} wilt ontkoppelen?`)) {
                                deleteConnection.mutate(connection.platform as ReviewPlatform);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Platforms */}
          {availablePlatforms.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Platform Toevoegen</CardTitle>
                <CardDescription>
                  Koppel een review platform om reviews te importeren
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availablePlatforms.map(platform => (
                    <button
                      key={platform.id}
                      onClick={() => handleAddPlatform(platform.id)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-dashed hover:border-primary hover:bg-muted/50 transition-colors text-left"
                    >
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: platform.bgColor }}
                      >
                        <img 
                          src={platform.logo} 
                          alt={platform.name}
                          className="w-6 h-6"
                          onError={(e) => { 
                            e.currentTarget.parentElement!.innerHTML = platform.name[0]; 
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{platform.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {platform.description}
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reviews">
          <ReviewsManager reviews={reviews} />
        </TabsContent>

        <TabsContent value="settings">
          <ReviewsHubSettings />
        </TabsContent>
      </Tabs>

      {/* Platform Configuration Dialog */}
      <ReviewsPlatformConfig
        platform={selectedPlatform}
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        existingConnection={connections.find(c => c.platform === selectedPlatform)}
      />
    </div>
  );
}
