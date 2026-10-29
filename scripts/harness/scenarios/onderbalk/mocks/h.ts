// Gedeelde instelling uit steps.mjs (window.__harness).
export const H = ((window as unknown as { __harness?: Record<string, unknown> }).__harness ?? {}) as {
  tracks?: string[]; bottomNav?: string[] | null;
};
