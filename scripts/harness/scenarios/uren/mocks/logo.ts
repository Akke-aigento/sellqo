export function useLogoUpload() { return { uploadLogo: async () => null, uploading: false, emailPreview: null, createFromCurrentLogo: async () => {}, creatingFromCurrent: false, clearEmailPreview: () => {} }; }
export async function fetchLogoFile(): Promise<File> { throw new Error('harnas'); }
export async function makeAndSaveEmailLogoVariant() { return { result: 'skipped_theme_logo' }; }
export async function saveEmailLogoVariant() { return 'skipped_theme_logo'; }
export const MAX_LOGO_FETCH_BYTES = 5 * 1024 * 1024;
