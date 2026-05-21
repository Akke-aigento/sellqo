# Known Optimizations

Tracked performance trade-offs that are acceptable today but may warrant revisiting if scale or product requirements change.

## vat-report-engine auth-floor (200ms)

Cache-path duurt 203ms waarvan 200ms `authenticateRequest` (DB roundtrip naar `auth.users` + `user_roles`).

Acceptabel voor huidige demo + VanXcel-scale workload. Toekomstige optimization indien performance kritiek wordt:

- Optie: JWT-claims-only check op cache-path (skip DB lookup, accept 5-min revocation lag)
- Trade-off: lagere consistency met andere edge functions in SellQo, security marginal weaker
- Beslissing per use-case wanneer noodzakelijk