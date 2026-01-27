import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, TrendingUp, MessageSquare, Lightbulb, Search } from "lucide-react";
import { usePlatformFeedback } from "@/hooks/usePlatformFeedback";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function PlatformFeedback() {
  const { feedback, isLoading, getStats, getRatingDistribution, getFeatureRequests } = usePlatformFeedback();
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");

  const stats = getStats();
  const distribution = getRatingDistribution();
  const featureRequests = getFeatureRequests();

  const filteredFeedback = feedback.filter(f => {
    const matchesSearch = !searchQuery || 
      f.feedback_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.feature_requests?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.tenant?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRating = ratingFilter === "all" || f.rating === parseInt(ratingFilter);
    
    return matchesSearch && matchesRating;
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feedback Dashboard</h1>
        <p className="text-muted-foreground">Overzicht van alle merchant feedback</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gemiddelde Score</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageRating}/5</div>
            <p className="text-xs text-muted-foreground">Uit {stats.total} reacties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.nps}</div>
            <p className="text-xs text-muted-foreground">
              {stats.nps > 0 ? 'Positief' : stats.nps < 0 ? 'Negatief' : 'Neutraal'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tevreden</CardTitle>
            <MessageSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.satisfied}</div>
            <p className="text-xs text-muted-foreground">{stats.dissatisfied} ontevreden</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Feature Requests</CardTitle>
            <Lightbulb className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withFeatureRequests}</div>
            <p className="text-xs text-muted-foreground">Suggesties ontvangen</p>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Score Verdeling</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = distribution[rating] || 0;
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={rating} className="flex items-center gap-2">
                  <span className="w-8 text-sm">{rating}★</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Alle Feedback</TabsTrigger>
          <TabsTrigger value="requests">Feature Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek in feedback..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter op score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle scores</SelectItem>
                <SelectItem value="5">5 sterren</SelectItem>
                <SelectItem value="4">4 sterren</SelectItem>
                <SelectItem value="3">3 sterren</SelectItem>
                <SelectItem value="2">2 sterren</SelectItem>
                <SelectItem value="1">1 ster</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {filteredFeedback.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Geen feedback gevonden</p>
              ) : (
                filteredFeedback.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{item.tenant?.name || 'Onbekend'}</Badge>
                            {item.rating && (
                              <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-4 w-4 ${i < item.rating! ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                                  />
                                ))}
                              </div>
                            )}
                            {item.is_satisfied !== null && (
                              <Badge variant={item.is_satisfied ? "default" : "destructive"}>
                                {item.is_satisfied ? 'Tevreden' : 'Ontevreden'}
                              </Badge>
                            )}
                          </div>
                          {item.feedback_text && (
                            <p className="mt-2 text-sm">{item.feedback_text}</p>
                          )}
                          {item.feature_requests && (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              <span className="font-medium">Feature request:</span> {item.feature_requests}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.created_at), 'd MMM yyyy', { locale: nl })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="requests">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {featureRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Geen feature requests</p>
              ) : (
                featureRequests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="outline" className="mb-2">{request.tenant}</Badge>
                          <p className="text-sm">{request.request}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(request.created_at), 'd MMM yyyy', { locale: nl })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
