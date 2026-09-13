import { describe, expect, it } from 'vitest';
import migration from '../../supabase/migrations/20260913160000_notifications_read_by_role.sql?raw';
import { canWithRoles } from '@/hooks/useCan';
import type { AppRole } from '@/hooks/useAuth';
import { NOTIFICATION_CATEGORY_RESOURCE } from '@/lib/notificationResources';
import type { NotificationCategory } from '@/types/notification';

// NOTIF-RLS-1: wie welke melding mag lezen staat twee keer — in PERMISSION_MATRIX
// (useCan.ts) voor het scherm, en in de SQL-functie can_read_notification_category
// voor de RLS en de pushfunctie. Deze test leest de migratie en faalt zodra de twee
// uit elkaar lopen. Wijzig je de matrix, schrijf dan ook een nieuwe migratie en
// laat deze test naar die migratie wijzen.

const TENANT_ROLES: AppRole[] = ['tenant_admin', 'accountant', 'staff', 'warehouse', 'viewer', 'marketing'];

function sqlRoles(): Map<string, AppRole[]> {
  const out = new Map<string, AppRole[]>();
  const re = /WHEN '([a-z_]+)'\s+THEN ARRAY\[([^\]]*)\]/g;
  for (const m of migration.matchAll(re)) {
    const roles = [...m[2].matchAll(/'([a-z_]+)'/g)].map(r => r[1] as AppRole);
    out.set(m[1], roles);
  }
  return out;
}

describe('can_read_notification_category', () => {
  const sql = sqlRoles();

  it('kent precies de categorieën met een recht', () => {
    expect([...sql.keys()].sort()).toEqual(Object.keys(NOTIFICATION_CATEGORY_RESOURCE).sort());
  });

  for (const [category, resource] of Object.entries(NOTIFICATION_CATEGORY_RESOURCE)) {
    it(`${category}: dezelfde rollen als read op ${resource}`, () => {
      const expected = TENANT_ROLES.filter(role => canWithRoles([role], 'read', resource!)).sort();
      expect((sql.get(category as NotificationCategory) ?? []).slice().sort()).toEqual(expected);
    });
  }
});
