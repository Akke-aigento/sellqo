// Client-side quick SEO scorer for instant feedback

export interface SEOBreakdown {
  keywords: {
    found: string[];
    missing: string[];
    score: number;
  };
  length: {
    current: number;
    optimal: { min: number; max: number };
    status: 'too_short' | 'optimal' | 'too_long';
    score: number;
  };
  readability: {
    wordCount: number;
    avgWordLength: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    score: number;
  };
}

export interface SEOScoreResult {
  score: number;
  breakdown: SEOBreakdown;
  suggestions: string[];
}

// Optimal lengths per field type (in characters)
const OPTIMAL_LENGTHS: Record<string, { min: number; max: number }> = {
  title: { min: 25, max: 60 },
  subtitle: { min: 40, max: 120 },
  cta: { min: 8, max: 25 },
  button: { min: 8, max: 20 },
  description: { min: 80, max: 200 },
};

// Calculate word complexity (simple check)
function calculateReadabilityScore(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 0;
  
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  
  // Dutch tends to have longer words, so adjust thresholds
  if (avgWordLength <= 5) return 100; // Simple, easy to read
  if (avgWordLength <= 7) return 85;  // Good readability
  if (avgWordLength <= 9) return 65;  // Acceptable
  return 45; // Complex words, harder to read
}

function getReadabilityStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

export function calculateQuickSEOScore(
  text: string,
  keywords: string[],
  fieldType: string
): SEOScoreResult {
  const normalizedText = text.toLowerCase();
  const suggestions: string[] = [];

  // 1. KEYWORD ANALYSIS (40% of score)
  const foundKeywords: string[] = [];
  const missingKeywords: string[] = [];
  
  keywords.forEach(keyword => {
    const normalizedKeyword = keyword.toLowerCase();
    // Check for exact match or word stem
    if (normalizedText.includes(normalizedKeyword) || 
        normalizedText.includes(normalizedKeyword.slice(0, -1))) {
      foundKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  });

  const keywordScore = keywords.length > 0 
    ? (foundKeywords.length / keywords.length) * 100 
    : 100; // If no keywords defined, full score

  if (missingKeywords.length > 0 && missingKeywords.length <= 2) {
    suggestions.push(`Voeg toe: "${missingKeywords.slice(0, 2).join('" of "')}"`);
  }

  // 2. LENGTH ANALYSIS (35% of score)
  const optimalLength = OPTIMAL_LENGTHS[fieldType] || { min: 30, max: 150 };
  const currentLength = text.length;
  
  let lengthScore = 100;
  let lengthStatus: 'too_short' | 'optimal' | 'too_long' = 'optimal';
  
  if (currentLength < optimalLength.min) {
    lengthScore = Math.max(30, (currentLength / optimalLength.min) * 100);
    lengthStatus = 'too_short';
    suggestions.push(`Tekst is kort. Optimaal: ${optimalLength.min}-${optimalLength.max} tekens.`);
  } else if (currentLength > optimalLength.max) {
    const excess = currentLength - optimalLength.max;
    lengthScore = Math.max(50, 100 - (excess / optimalLength.max) * 50);
    lengthStatus = 'too_long';
    suggestions.push(`Tekst is lang. Optimaal: max ${optimalLength.max} tekens.`);
  }

  // 3. READABILITY ANALYSIS (25% of score)
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const avgWordLength = words.length > 0 
    ? words.reduce((sum, w) => sum + w.length, 0) / words.length 
    : 0;
  
  const readabilityScore = calculateReadabilityScore(text);
  const readabilityStatus = getReadabilityStatus(readabilityScore);
  
  if (readabilityStatus === 'fair' || readabilityStatus === 'poor') {
    suggestions.push('Gebruik kortere, eenvoudigere woorden.');
  }

  // FINAL SCORE CALCULATION
  const weightedScore = 
    (keywordScore * 0.40) + 
    (lengthScore * 0.35) + 
    (readabilityScore * 0.25);

  const finalScore = Math.round(weightedScore);

  return {
    score: finalScore,
    breakdown: {
      keywords: {
        found: foundKeywords,
        missing: missingKeywords,
        score: Math.round(keywordScore),
      },
      length: {
        current: currentLength,
        optimal: optimalLength,
        status: lengthStatus,
        score: Math.round(lengthScore),
      },
      readability: {
        wordCount: words.length,
        avgWordLength: Math.round(avgWordLength * 10) / 10,
        status: readabilityStatus,
        score: Math.round(readabilityScore),
      },
    },
    suggestions,
  };
}
