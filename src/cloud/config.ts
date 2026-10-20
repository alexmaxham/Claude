// Firebase web app config. Get it from the Firebase console:
// Project settings → General → Your apps → Web app → "SDK setup and configuration" → Config.
// These values are not secrets: they identify the project, and the Firestore
// security rules in firestore.rules are what keep each user's data private.
const config = {
  apiKey: 'AIzaSyCfKZ2bCXRasGlgA6SNvCpsBT_PmBb_uuY',
  authDomain: 'questlog2-e03f9.firebaseapp.com',
  projectId: 'questlog2-e03f9',
  storageBucket: 'questlog2-e03f9.firebasestorage.app',
  messagingSenderId: '304688994859',
  appId: '1:304688994859:web:0615aa39d895a41e67286e',
};

/**
 * Google sign-in (and Calendar sync) in the iPhone app goes through the native
 * Google SDK, which needs GoogleService-Info.plist in ios/App/App and the URL scheme
 * from it in Info.plist. `npm run ios:google -- <path to the plist>` does both and
 * turns this on (see README → iPhone app). Until then the app offers email sign-in
 * only, since Google blocks sign-in pages inside embedded web views.
 */
export const IOS_GOOGLE_SIGN_IN = true;

export interface CloudConfig {
  options: typeof config;
  /** Talk to local Firebase emulators instead of the real project (for development/testing). */
  useEmulators: boolean;
}

export const cloudConfig: CloudConfig | null =
  import.meta.env.VITE_FIREBASE_EMULATORS === 'true'
    ? { options: { ...config, apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-tasko' }, useEmulators: true }
    : config.apiKey
      ? { options: config, useEmulators: false }
      : null;
