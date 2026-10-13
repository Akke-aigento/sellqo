// ALLERGEN-1 — de 14 EU-allergenen (bijlage II, verordening 1169/2011) en de dieetlabels.
// Zelfde codes als de check-constraints op products.allergens / products.dietary.
export const ALLERGENS = [
  'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk',
  'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs',
] as const;
export type AllergenCode = (typeof ALLERGENS)[number];

export const DIETARY = ['vegetarian', 'vegan', 'spicy', 'halal', 'gluten_free'] as const;
export type DietaryCode = (typeof DIETARY)[number];
