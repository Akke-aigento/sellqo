/** BILL-LOCK-1: de banner opent de betaalpopup opnieuw via dit event. */
export const BILLING_LOCK_OPEN_EVENT = 'sellqo:billing-lock-open';
export const openBillingLockDialog = () => window.dispatchEvent(new Event(BILLING_LOCK_OPEN_EVENT));
