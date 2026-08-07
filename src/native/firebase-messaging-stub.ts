// Web-only stub for firebase/messaging. The Firebase Messaging web SDK is
// pulled in transitively by @capacitor-firebase/messaging's web fallback, but
// SellQo's web build never exercises that code — Capacitor.isNativePlatform()
// gates the entire push flow. Aliased in vite.config.ts to keep the Firebase
// JS SDK out of the web bundle.
export const isSupported = async () => false;
export const getMessaging = () => {
  throw new Error('firebase/messaging is stubbed on web');
};
export const getToken = async () => {
  throw new Error('firebase/messaging is stubbed on web');
};
export const deleteToken = async () => {
  throw new Error('firebase/messaging is stubbed on web');
};
export const onMessage = () => () => {};
