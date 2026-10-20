// The only module that imports Firebase. It's loaded lazily, so guests who never
// sign in don't download the SDK. Swap this file to change backends.
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import type { Task } from '../core/types';
import { isNative } from '../native';
import { syncCalendar } from './calendar';
import { IOS_GOOGLE_SIGN_IN, type CloudConfig } from './config';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export interface CloudUser {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
}

export interface CloudDoc {
  json: string;
  clientId: string;
}

export interface SnapshotMeta {
  /** The event reflects a local write that the server hasn't confirmed yet. */
  pending: boolean;
  /** Data came from the offline cache rather than the server. */
  fromCache: boolean;
}

export type CloudApi = ReturnType<typeof createCloud>;

export function createCloud({ options, useEmulators }: CloudConfig) {
  const app = initializeApp(options);
  // getAuth() waits on a popup/redirect helper that never loads in the iPhone app's web view.
  const auth = isNative ? initializeAuth(app, { persistence: indexedDBLocalPersistence }) : getAuth(app);
  const db = initializeFirestore(app, {
    // Keeps working offline and syncs when the connection comes back.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }

  const userDoc = (uid: string) => doc(db, 'users', uid);
  let calendarToken: { value: string; expires: number } | null = null;

  /** Google sign-in through the native SDK (iPhone app), which returns Google's own tokens. */
  async function nativeGoogle(scopes?: string[]) {
    if (!IOS_GOOGLE_SIGN_IN) throw new Error('Google sign-in isn’t set up in the iPhone app yet.');
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const { credential } = await FirebaseAuthentication.signInWithGoogle({ scopes });
    if (!credential?.idToken) throw new Error('Google sign-in was cancelled.');
    return credential;
  }

  /**
   * An OAuth access token allowed to edit the user's calendar events. Asks Google
   * once (a popup); the token is kept in memory for most of its one-hour life.
   * Accounts that signed up with email get Google linked to them for this.
   */
  async function getCalendarToken(): Promise<string> {
    if (calendarToken && calendarToken.expires > Date.now()) return calendarToken.value;
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in first to connect Google Calendar.');
    if (isNative) {
      const token = (await nativeGoogle([CALENDAR_SCOPE])).accessToken;
      if (!token) throw new Error('Google didn’t grant calendar access.');
      calendarToken = { value: token, expires: Date.now() + 50 * 60_000 };
      return token;
    }
    const provider = new GoogleAuthProvider();
    provider.addScope(CALENDAR_SCOPE);
    const hasGoogle = user.providerData.some((p) => p.providerId === 'google.com');
    if (hasGoogle && user.email) provider.setCustomParameters({ login_hint: user.email });
    const result = hasGoogle ? await reauthenticateWithPopup(user, provider) : await linkWithPopup(user, provider);
    const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    if (!token) throw new Error('Google didn’t grant calendar access.');
    calendarToken = { value: token, expires: Date.now() + 50 * 60_000 };
    return token;
  }

  return {
    onUser(cb: (user: CloudUser | null) => void) {
      return onAuthStateChanged(auth, (u) =>
        cb(u ? { uid: u.uid, email: u.email, name: u.displayName, photoURL: u.photoURL } : null),
      );
    },

    async signInWithGoogle() {
      if (isNative) {
        const { idToken, accessToken } = await nativeGoogle();
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken));
        return;
      }
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        // Some mobile browsers block popups; fall back to a full-page redirect.
        if ((e as { code?: string }).code === 'auth/popup-blocked') await signInWithRedirect(auth, provider);
        else throw e;
      }
    },

    async signInWithEmail(email: string, password: string) {
      await signInWithEmailAndPassword(auth, email, password);
    },

    async signUpWithEmail(email: string, password: string) {
      await createUserWithEmailAndPassword(auth, email, password);
    },

    resetPassword(email: string) {
      return sendPasswordResetEmail(auth, email);
    },

    async signOut() {
      calendarToken = null;
      if (isNative && IOS_GOOGLE_SIGN_IN) {
        // Also forget the Google account, so the next sign-in offers the account picker.
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        await FirebaseAuthentication.signOut().catch(() => {});
      }
      return signOut(auth);
    },

    /** Puts every open task with a due date on the user's Google Calendar (and cleans up old ones). */
    async syncGoogleCalendar(tasks: Task[]) {
      const token = await getCalendarToken();
      try {
        return await syncCalendar(token, tasks);
      } catch (e) {
        // A revoked or expired token: forget it so the next try asks again.
        if ((e as { kind?: string }).kind === 'auth') calendarToken = null;
        throw e;
      }
    },

    watchState(
      uid: string,
      cb: (data: CloudDoc | null, meta: SnapshotMeta) => void,
      onError: (e: Error) => void,
    ) {
      return onSnapshot(
        userDoc(uid),
        { includeMetadataChanges: true },
        (snap) => {
          const d = snap.data();
          cb(
            d && typeof d.data === 'string' ? { json: d.data, clientId: String(d.clientId ?? '') } : null,
            { pending: snap.metadata.hasPendingWrites, fromCache: snap.metadata.fromCache },
          );
        },
        onError,
      );
    },

    writeState(uid: string, json: string, clientId: string) {
      return setDoc(userDoc(uid), { data: json, clientId, updatedAt: serverTimestamp() });
    },
  };
}
