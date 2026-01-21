import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Star, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Search,
  MessageSquare,
  Filter
} from 'lucide-react';
import { useReviewsHub } from '@/hooks/useReviewsHub';
import { getPlatformInfo, REVIEW_PLATFORMS, type ExternalReview, type ReviewPlatform } from '@/types/reviews-hub';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

interface ReviewsManagerProps {
  reviews: ExternalReview[];
}

export function ReviewsManager({ reviews }: ReviewsManagerProps) {
  const { toggleReviewVisibility, toggleReviewFeatured } = useReviewsHub();
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');

  // Get unique platforms from reviews
  const platformsInReviews = [...new Set(reviews.map(r => r.platform))];

  // Filter reviews
  const filteredReviews = reviews.filter(review => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !review.text?.toLowerCase().includes(query) &&
        !review.author_name?.toLowerCase().includes(query) &&
        !review.title?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    
    // Platform filter
    if (platformFilter !== 'all' && review.platform !== platformFilter) {
      return false;
    }
    
    // Rating filter
    if (ratingFilter !== 'all' && review.rating < parseInt(ratingFilter)) {
      return false;
    }
    
    // Visibility filter
    if (visibilityFilter === 'visible' && !review.is_visible) return false;
    if (visibilityFilter === 'hidden' && review.is_visible) return false;
    if (visibilityFilter === 'featured' && !review.is_featured) return false;
    
    return true;
  });

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= rating
              ? 'text-yellow-500 fill-yellow-500'
              : 'text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );

  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">Nog geen reviews gesynchroniseerd</p>
          <p className="text-sm text-muted-foreground">
            Koppel een platform en synchroniseer om reviews te importeren
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Reviews Beheren</CardTitle>
          <div className="text-sm text-muted-foreground">
            {filteredReviews.length} van {reviews.length} reviews
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2 pt-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek in reviews..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle platformen</SelectItem>
              {platformsInReviews.map(platform => {
                const info = getPlatformInfo(platform as ReviewPlatform);
                return (
                  <SelectItem key={platform} value={platform}>
                    {info.name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle ratings</SelectItem>
              <SelectItem value="5">5 sterren</SelectItem>
              <SelectItem value="4">4+ sterren</SelectItem>
              <SelectItem value="3">3+ sterren</SelectItem>
            </SelectContent>
          </Select>
          <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="visible">Zichtbaar</SelectItem>
              <SelectItem value="hidden">Verborgen</SelectItem>
              <SelectItem value="featured">Uitgelicht</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {filteredReviews.map(review => {
            const platformInfo = getPlatformInfo(review.platform as ReviewPlatform);
            
            return (
              <div 
                key={review.id}
                className={`p-4 rounded-lg border ${
                  !review.is_visible ? 'opacity-50 bg-muted/30' : 
                  review.is_featured ? 'border-yellow-500/50 bg-yellow-500/5' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Platform Badge */}
                  <div 
                    className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: platformInfo.bgColor }}
                  >
                    <img 
                      src={platformInfo.logo} 
                      alt={platformInfo.name}
                      className="w-5 h-5"
                      onError={(e) => { 
                        e.currentTarget.parentElement!.innerHTML = platformInfo.name[0]; 
                      }}
                    />
                  </div>
                  
                  {/* Review Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {renderStars(review.rating)}
                      {review.is_featured && (
                        <Badge className="bg-yellow-500/10 text-yellow-600 text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Uitgelicht
                        </Badge>
                      )}
                      {review.is_verified && (
                        <Badge variant="secondary" className="text-xs">Geverifieerd</Badge>
                      )}
                    </div>
                    
                    {review.title && (
                      <div className="font-medium text-sm mb-1">{review.title}</div>
                    )}
                    
                    {review.text && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {review.text}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">{review.author_name || 'Anoniem'}</span>
                      {review.review_date && (
                        <>
                          <span>·</span>
                          <span>
                            {formatDistanceToNow(new Date(review.review_date), { locale: nl, addSuffix: true })}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>{platformInfo.name}</span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleReviewVisibility.mutate({ 
                        reviewId: review.id, 
                        visible: !review.is_visible 
                      })}
                      title={review.is_visible ? 'Verbergen' : 'Tonen'}
                    >
                      {review.is_visible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleReviewFeatured.mutate({ 
                        reviewId: review.id, 
                        featured: !review.is_featured 
                      })}
                      title={review.is_featured ? 'Niet meer uitlichten' : 'Uitlichten'}
                      className={review.is_featured ? 'text-yellow-600' : ''}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
