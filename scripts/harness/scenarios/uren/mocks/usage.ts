// Plan: ?plan=pro geeft odoo_sync, anders niet (upsell zichtbaar).
const plan = new URLSearchParams(location.search).get('plan');
export function useUsageLimits() { return { checkFeature: (k: string) => plan === 'pro' && k === 'odoo_sync', enforceLimit: () => true, limits: {}, usage: {}, isLoading: false }; }
