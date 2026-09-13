import { canWithRoles, type Resource } from '@/hooks/useCan';
import type { AppRole } from '@/hooks/useAuth';
import type { NotificationCategory } from '@/types/notification';

/**
 * Welk leesrecht bij een meldingscategorie hoort.
 *
 * Gebruikt door "Mijn meldingen": je ziet alleen pushschakelaars voor
 * categorieën die bij je rol horen. Een magazijnmedewerker kan dus geen push
 * voor facturen aanzetten.
 *
 * WAAROM ALLEEN HIER, EN NIET OOK OP DE SERVER. Dat stond wel in het plan.
 * Maar bij het natrekken bleek de RLS op `notifications`
 * (`notifications_select_members`) alleen op winkellidmaatschap te filteren —
 * geen rol, geen categorie. Elk teamlid ziet elke melding al in het belletje en
 * kan hem rechtstreeks uit de tabel lezen. Een rolfilter op push zou iets
 * afschermen dat daar al openligt, en zou een derde kopie van de permissiematrix
 * vergen (naast useCan.ts en de rolarrays in de RLS-policies).
 *
 * Het eigenlijke lek zit dus in die RLS, en dáár hoort de fix: in SQL, waar de
 * matrix al per tabel staat. Zie de role-audit (PUSH-2).
 *
 * `quotes` en `subscriptions` hebben geen eigen recht en vallen onder
 * facturatie; `system` onder algemene instellingen. Een categorie die hier
 * ontbreekt wordt niet getoond — liever een schakelaar te weinig dan een
 * melding die iemand niet had mogen zien.
 */
export const NOTIFICATION_CATEGORY_RESOURCE: Readonly<Partial<Record<NotificationCategory, Resource>>> = {
  orders: 'orders',
  invoices: 'invoices',
  quotes: 'invoices',
  subscriptions: 'invoices',
  payments: 'payments',
  customers: 'customers',
  products: 'products',
  marketing: 'marketing',
  team: 'team',
  messages: 'inbox',
  integrations: 'integrations',
  ai_coach: 'ai_coach',
  system: 'settings_general',
};

export function canReceiveNotificationCategory(roles: AppRole[], category: NotificationCategory): boolean {
  const resource = NOTIFICATION_CATEGORY_RESOURCE[category];
  if (!resource) return false;
  return canWithRoles(roles, 'read', resource);
}
