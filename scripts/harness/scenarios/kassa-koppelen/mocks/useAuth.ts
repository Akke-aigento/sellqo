// KASSA-MOBIEL-1 — beheer-sessie op dit toestel: ?screen=pair-owner = eigenaar (tenant_admin) van twee zaken.
import { H } from './h';
const owner = {
  user: { id: 'owner-1', email: 'eigenaar@dewissel.be' }, loading: false, rolesLoading: false,
  roles: [{ id: 'r1', user_id: 'owner-1', role: 'tenant_admin', tenant_id: 'tn' }, { id: 'r2', user_id: 'owner-1', role: 'tenant_admin', tenant_id: 'tn2' }],
};
export const useOptionalAuth = () => (H.screen === 'pair-owner' ? owner : null);
export const useAuth = () => { throw new Error('useAuth in de kassa'); };
