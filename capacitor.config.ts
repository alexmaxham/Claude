import type { CapacitorConfig } from '@capacitor/cli';

// Native iPhone app: the same web build (dist/) running in a WKWebView, with
// native plugins for haptics, notifications, storage, sharing and Google sign-in.
const config: CapacitorConfig = {
  appId: 'com.alexmaxham.tasko',
  appName: 'Tasko',
  webDir: 'dist',
  // Matches --bg so there's no white flash behind the glass while the web view loads.
  backgroundColor: '#04070f',
  ios: {
    // Let the backdrop run under the status bar and home indicator; the CSS pads with safe-area insets.
    contentInset: 'never',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
  },
  experimental: {
    ios: {
      spm: {
        swiftToolsVersion: '6.1',
        // Avoids a SwiftPM package identity clash between this plugin and firebase-ios-sdk.
        packageOptions: { '@capacitor-firebase/authentication': { symlink: true } },
        // Google Sign-In only; leaves the Facebook SDK out of the app.
        packageTraits: { '@capacitor-firebase/authentication': ['Google'] },
      },
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#04070f',
      showSpinner: false,
    },
    Keyboard: {
      // Shrink the web view above the keyboard so sheets and inputs stay visible.
      resize: 'native',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      iconColor: '#2f63e0',
    },
    FirebaseAuthentication: {
      // Native Google sign-in hands its credential to the Firebase JS SDK (src/cloud/api.ts).
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
