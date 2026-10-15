import type { TFunction } from 'i18next';
import type { NotificationCategory } from '@/types/notification';

/**
 * BLOG-FIX-1 — vertaalde labels voor NOTIFICATION_CONFIG.
 *
 * De config zelf bevat alleen id's (categorie/type) en defaults; de tekst komt
 * uit i18n. Zo blijven de scripts die de config parsen (check-notification-
 * sources.mjs, notificationDefaults-test) ongemoeid en verschijnt elk label in
 * de taal van de ingelogde gebruiker.
 */
export function notificationCategoryLabel(t: TFunction, category: NotificationCategory | string): string {
  return t(`settings.notifications.categories.${category}`, { defaultValue: category });
}

export function notificationTypeLabel(t: TFunction, category: NotificationCategory | string, type: string): string {
  return t(`settings.notifications.types.${category}.${type}.label`, { defaultValue: type });
}

export function notificationTypeDescription(t: TFunction, category: NotificationCategory | string, type: string): string {
  return t(`settings.notifications.types.${category}.${type}.description`, { defaultValue: '' });
}
