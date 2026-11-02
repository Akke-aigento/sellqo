// Scherm en stand uit de URL (?screen=pair|owner|revoked|admin).
const q = new URLSearchParams(window.location.search);
export const H = { screen: q.get('screen') ?? 'pair' };
