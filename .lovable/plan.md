

## SellQo Headless Commerce Integration

### Overview
Create a complete headless commerce SDK under `src/integrations/sellqo/` with a proxy edge function, typed API client, React Query hooks, and cart context.

### Files to Create

#### 1. Edge Function: `supabase/functions/sellqo-proxy/index.ts`
Proxy middleware that forwards requests to the existing `storefront-api` edge function. Reads `X-Tenant-ID` header, passes it as query param or header to storefront-api. Handles CORS.

#### 2. `src/integrations/sellqo/client.ts`
- `sellqoFetch(endpoint, options?)` — base fetch wrapper
- Base URL: `https://gczmfcabnoofnmfpzeop.supabase.co/functions/v1/sellqo-proxy`
- Sends `X-Tenant-ID` header (from a configurable tenant slug)
- Auto-parses JSON responses

#### 3. `src/integrations/sellqo/types.ts`
TypeScript interfaces: `SellqoProduct`, `SellqoCartItem`, `SellqoCart`, `SellqoCollection`, `SellqoVariant`, `SellqoSettings`, `SellqoLegalPage`

#### 4. `src/integrations/sellqo/normalizer.ts`
- `normalizeProduct(raw)` — maps API response fields to `SellqoProduct`
- `normalizeCart(raw)` — maps API response to `SellqoCart`

#### 5. `src/integrations/sellqo/api.ts`
API modules using `sellqoFetch`:
- `productsAPI.getAll(params?)`, `productsAPI.getOne(slug)`
- `collectionsAPI.getAll()`
- `cartAPI.get/create/addItem/updateItem/removeItem/applyDiscount/removeDiscount/checkout`
- `settingsAPI.get()`, `legalAPI.get()`

#### 6. `src/integrations/sellqo/hooks.ts`
React Query hooks with proper cache keys:
- `useProducts`, `useProduct`, `useCollections`, `useSettings`, `useLegalPages`
- `useCart` (reads `cart_id` from localStorage)
- `useAddToCart`, `useUpdateCartItem`, `useRemoveCartItem` (optimistic updates)
- `useApplyDiscount`

#### 7. `src/integrations/sellqo/CartContext.tsx`
- `SellqoCartProvider` with `cart_id` persistence in localStorage
- Validates cart_id is never "undefined"/"null"
- Provides: `cart`, `addItem`, `updateItem`, `removeItem`, `clearCart`, `applyDiscount`, `removeDiscount`, `checkout`

#### 8. `src/integrations/sellqo/index.ts`
Barrel export for all modules.

### File to Edit

#### `src/App.tsx` (line 108)
Update QueryClient config:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});
```

### Edge Function Architecture
The `sellqo-proxy` will internally call the existing `storefront-api` using `SUPABASE_URL` + service role key, forwarding the tenant context. This avoids CORS issues and keeps the storefront-api's auth model intact.

