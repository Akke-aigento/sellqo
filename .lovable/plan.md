

## Custom Frontend Configurator — Plan

### What
A new page at `/admin/platform/docs/custom-frontend` — a wizard where platform admins fill in project-specific details (tenant slug, domain, Supabase project ID, project name) and get 5 ready-to-copy prompts with all values pre-filled.

### Files to Create

**`src/pages/platform/CustomFrontendConfigurator.tsx`**
- Step 1: Card with 4 input fields (tenantSlug, customDomain, supabaseProjectId, lovableProjectName) + "Genereer Prompts" button (disabled until all filled)
- Step 2: 5 numbered prompt cards, each with title, full prompt text (placeholders replaced), and a copy button with "Gekopieerd!" feedback
- Layout: scrollable single page with step 1 at top, step 2 below (visible after clicking generate)
- Uses existing UI components (Card, Input, Button) + toast/sonner for copy feedback

### Files to Edit

**`src/App.tsx`**
- Import `CustomFrontendConfigurator`
- Add route: `platform/docs/custom-frontend` under ProtectedRoute with `requirePlatformAdmin`

**`src/components/admin/sidebar/sidebarConfig.ts`**
- Add child item under `platform-docs` or as separate item: `{ id: 'platform-custom-frontend', title: 'Custom Frontend', url: '/admin/platform/docs/custom-frontend', icon: Monitor }`
- Convert `platform-docs` to have children array with the existing docs page + new configurator

### Prompt Templates
The 5 prompts will be stored as template functions that accept the config object and return the full prompt string with all `{placeholders}` replaced. Each covers:
1. SellQo integration SDK (client, types, api, hooks, CartContext)
2. sellqo-proxy edge function
3. Checkout flow + /bedankt page
4. Footer with legal/social data
5. Contact page

