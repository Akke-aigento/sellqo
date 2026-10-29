// Harnas — laadt de app-css, zet de taal en start het gekozen scenario (alias harness-scenario).
const lang = new URLSearchParams(location.search).get('lang') ?? 'nl';
localStorage.setItem('preferredLanguage', lang);
await import('@/index.css');
await import('@/i18n');
await import('harness-scenario');
export {};
