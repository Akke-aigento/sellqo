import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  tenant_id: string;
  platform: 'google' | 'trustpilot' | 'kiyoh' | 'webwinkelkeur' | 'trusted_shops' | 'facebook';
  connection_id: string;
}

interface Review {
  external_review_id: string;
  author_name: string | null;
  author_avatar_url: string | null;
  rating: number;
  title: string | null;
  text: string | null;
  review_date: string | null;
  is_verified: boolean;
  metadata: Record<string, unknown>;
}

// Google Places API handler
async function fetchGoogleReviews(apiKey: string, placeId: string): Promise<{ reviews: Review[], rating: number, count: number }> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&key=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK') {
    throw new Error(`Google API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
  }
  
  const reviews: Review[] = (data.result.reviews || []).map((r: any) => ({
    external_review_id: `google_${r.time}`,
    author_name: r.author_name,
    author_avatar_url: r.profile_photo_url,
    rating: r.rating,
    title: null,
    text: r.text,
    review_date: new Date(r.time * 1000).toISOString(),
    is_verified: false,
    metadata: { language: r.language, relative_time: r.relative_time_description },
  }));
  
  return {
    reviews,
    rating: data.result.rating || 0,
    count: data.result.user_ratings_total || 0,
  };
}

// Trustpilot API handler
async function fetchTrustpilotReviews(apiKey: string, apiSecret: string, businessUnitId: string): Promise<{ reviews: Review[], rating: number, count: number }> {
  // Get access token
  const tokenResponse = await fetch('https://api.trustpilot.com/v1/oauth/oauth-business-users-for-applications/accesstoken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${apiKey}:${apiSecret}`)}`,
    },
    body: 'grant_type=client_credentials',
  });
  
  if (!tokenResponse.ok) {
    throw new Error('Trustpilot authentication failed');
  }
  
  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  
  // Fetch business unit info
  const businessResponse = await fetch(`https://api.trustpilot.com/v1/business-units/${businessUnitId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  if (!businessResponse.ok) {
    throw new Error('Failed to fetch Trustpilot business info');
  }
  
  const businessData = await businessResponse.json();
  
  // Fetch reviews
  const reviewsResponse = await fetch(`https://api.trustpilot.com/v1/business-units/${businessUnitId}/reviews?perPage=100`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  if (!reviewsResponse.ok) {
    throw new Error('Failed to fetch Trustpilot reviews');
  }
  
  const reviewsData = await reviewsResponse.json();
  
  const reviews: Review[] = (reviewsData.reviews || []).map((r: any) => ({
    external_review_id: r.id,
    author_name: r.consumer?.displayName || 'Anonymous',
    author_avatar_url: null,
    rating: r.stars,
    title: r.title,
    text: r.text,
    review_date: r.createdAt,
    is_verified: r.isVerified || false,
    metadata: { experiencedAt: r.experiencedAt, language: r.language },
  }));
  
  return {
    reviews,
    rating: businessData.score?.trustScore || 0,
    count: businessData.numberOfReviews?.total || 0,
  };
}

// Kiyoh API handler
async function fetchKiyohReviews(apiKey: string, companyId: string): Promise<{ reviews: Review[], rating: number, count: number }> {
  const url = `https://www.kiyoh.com/v1/review/feed.json?hash=${apiKey}&limit=100`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Kiyoh API error');
  }
  
  const data = await response.json();
  
  const reviews: Review[] = (data.reviews || []).map((r: any) => ({
    external_review_id: `kiyoh_${r.id}`,
    author_name: r.reviewer?.name || 'Anonymous',
    author_avatar_url: null,
    rating: Math.round(r.rating / 2), // Kiyoh uses 1-10 scale
    title: null,
    text: r.comment,
    review_date: r.created,
    is_verified: true,
    metadata: { original_rating: r.rating },
  }));
  
  return {
    reviews,
    rating: data.averageRating ? Math.round(data.averageRating / 2 * 10) / 10 : 0,
    count: data.totalReviews || 0,
  };
}

// WebwinkelKeur API handler
async function fetchWebwinkelKeurReviews(apiKey: string, shopId: string): Promise<{ reviews: Review[], rating: number, count: number }> {
  const url = `https://dashboard.webwinkelkeur.nl/api/1.0/shop/reviews?id=${shopId}&key=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('WebwinkelKeur API error');
  }
  
  const data = await response.json();
  
  const reviews: Review[] = (data.reviews || []).map((r: any) => ({
    external_review_id: `wwk_${r.id}`,
    author_name: r.name || 'Anonymous',
    author_avatar_url: null,
    rating: Math.round(r.rating / 2), // 1-10 scale
    title: null,
    text: r.comment,
    review_date: r.date,
    is_verified: true,
    metadata: { original_rating: r.rating },
  }));
  
  return {
    reviews,
    rating: data.score ? Math.round(data.score / 2 * 10) / 10 : 0,
    count: data.total || 0,
  };
}

// Trusted Shops API handler
async function fetchTrustedShopsReviews(apiKey: string, tsId: string): Promise<{ reviews: Review[], rating: number, count: number }> {
  const url = `https://api.trustedshops.com/rest/public/v2/shops/${tsId}/reviews`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  
  if (!response.ok) {
    throw new Error('Trusted Shops API error');
  }
  
  const data = await response.json();
  
  const reviews: Review[] = (data.response?.data?.shop?.reviews || []).map((r: any) => ({
    external_review_id: `ts_${r.UID}`,
    author_name: 'Verified Buyer',
    author_avatar_url: null,
    rating: r.mark,
    title: null,
    text: r.comment,
    review_date: r.creationDate,
    is_verified: true,
    metadata: {},
  }));
  
  const quality = data.response?.data?.shop?.qualityIndicators;
  
  return {
    reviews,
    rating: quality?.reviewIndicator?.overallMark || 0,
    count: quality?.reviewIndicator?.activeReviewCount || 0,
  };
}

// Facebook API handler
async function fetchFacebookReviews(accessToken: string, pageId: string): Promise<{ reviews: Review[], rating: number, count: number }> {
  const url = `https://graph.facebook.com/v18.0/${pageId}/ratings?access_token=${accessToken}&fields=reviewer,rating,review_text,created_time`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Facebook API error');
  }
  
  const data = await response.json();
  
  const reviews: Review[] = (data.data || []).map((r: any) => ({
    external_review_id: `fb_${r.reviewer?.id}_${r.created_time}`,
    author_name: r.reviewer?.name || 'Facebook User',
    author_avatar_url: null,
    rating: r.rating,
    title: null,
    text: r.review_text,
    review_date: r.created_time,
    is_verified: false,
    metadata: {},
  }));
  
  // Get overall rating
  const ratingUrl = `https://graph.facebook.com/v18.0/${pageId}?access_token=${accessToken}&fields=overall_star_rating,rating_count`;
  const ratingResponse = await fetch(ratingUrl);
  const ratingData = await ratingResponse.json();
  
  return {
    reviews,
    rating: ratingData.overall_star_rating || 0,
    count: ratingData.rating_count || 0,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { tenant_id, platform, connection_id }: SyncRequest = await req.json();
    
    // Get connection details
    const { data: connection, error: connError } = await supabase
      .from('review_platform_connections')
      .select('*')
      .eq('id', connection_id)
      .single();
    
    if (connError || !connection) {
      throw new Error('Connection not found');
    }
    
    let result: { reviews: Review[], rating: number, count: number };
    
    // Fetch reviews based on platform
    switch (platform) {
      case 'google':
        if (!connection.api_key || !connection.external_id) {
          throw new Error('Google requires API key and Place ID');
        }
        result = await fetchGoogleReviews(connection.api_key, connection.external_id);
        break;
        
      case 'trustpilot':
        if (!connection.api_key || !connection.api_secret || !connection.external_id) {
          throw new Error('Trustpilot requires API key, secret, and Business Unit ID');
        }
        result = await fetchTrustpilotReviews(connection.api_key, connection.api_secret, connection.external_id);
        break;
        
      case 'kiyoh':
        if (!connection.api_key || !connection.external_id) {
          throw new Error('Kiyoh requires API key and Company ID');
        }
        result = await fetchKiyohReviews(connection.api_key, connection.external_id);
        break;
        
      case 'webwinkelkeur':
        if (!connection.api_key || !connection.external_id) {
          throw new Error('WebwinkelKeur requires API key and Shop ID');
        }
        result = await fetchWebwinkelKeurReviews(connection.api_key, connection.external_id);
        break;
        
      case 'trusted_shops':
        if (!connection.api_key || !connection.external_id) {
          throw new Error('Trusted Shops requires API key and TSID');
        }
        result = await fetchTrustedShopsReviews(connection.api_key, connection.external_id);
        break;
        
      case 'facebook':
        if (!connection.api_key || !connection.external_id) {
          throw new Error('Facebook requires Access Token and Page ID');
        }
        result = await fetchFacebookReviews(connection.api_key, connection.external_id);
        break;
        
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
    
    // Upsert reviews
    for (const review of result.reviews) {
      await supabase
        .from('external_reviews')
        .upsert({
          tenant_id,
          connection_id,
          platform,
          external_review_id: review.external_review_id,
          author_name: review.author_name,
          author_avatar_url: review.author_avatar_url,
          rating: review.rating,
          title: review.title,
          text: review.text,
          review_date: review.review_date,
          is_verified: review.is_verified,
          metadata: review.metadata,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,platform,external_review_id',
        });
    }
    
    // Update connection with cached data
    await supabase
      .from('review_platform_connections')
      .update({
        cached_rating: result.rating,
        cached_review_count: result.count,
        last_synced_at: new Date().toISOString(),
        sync_status: 'success',
        sync_error: null,
      })
      .eq('id', connection_id);
    
    return new Response(
      JSON.stringify({
        success: true,
        reviews_synced: result.reviews.length,
        total_reviews: result.count,
        rating: result.rating,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync error:', errorMessage);
    
    // Update connection with error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const body = await req.clone().json();
      
      if (body.connection_id) {
        await supabase
          .from('review_platform_connections')
          .update({
            sync_status: 'failed',
            sync_error: errorMessage,
          })
          .eq('id', body.connection_id);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
    }
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
