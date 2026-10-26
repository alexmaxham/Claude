// The only module that imports Firebase. It's loaded lazily, so guests who never
// sign in don't download the SDK. Swap this file to change backends.
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  OAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  revokeAccessToken,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { isNative } from '../native';
import { FriendlyError } from './errors';
import { IOS_GOOGLE_SIGN_IN, type CloudConfig } from './config';

export interface CloudUser {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
  /** How the user proves it's them again before deleting the account. */
  confirmWith: 'password' | 'google' | 'apple';
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

  /** Google sign-in through the native SDK (iPhone app), which returns Google's own tokens. */
  async function nativeGoogle() {
    if (!IOS_GOOGLE_SIGN_IN) throw new Error('Google sign-in isn’t set up in the iPhone app yet.');
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const { credential } = await FirebaseAuthentication.signInWithGoogle();
    if (!credential?.idToken) throw new Error('Google sign-in was cancelled.');
    return credential;
  }

  /** Sign in with Apple through the native sheet (iPhone app only). */
  async function nativeApple() {
    if (!IOS_GOOGLE_SIGN_IN) throw new Error('Sign in with Apple isn’t set up in the iPhone app yet.');
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const { credential, user } = await FirebaseAuthentication.signInWithApple();
    if (!credential?.idToken) throw new Error('Sign in with Apple was cancelled.');
    return {
      credential: new OAuthProvider('apple.com').credential({ idToken: credential.idToken, rawNonce: credential.nonce }),
      authorizationCode: credential.authorizationCode,
      // Apple shares the name only the first time someone signs in.
      displayName: user?.displayName ?? null,
    };
  }

  return {
    onUser(cb: (user: CloudUser | null) => void) {
      return onAuthStateChanged(auth, (u) => cb(u ? toCloudUser(u) : null));
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

    /** iPhone app only: Apple requires it next to Google sign-in. */
    async signInWithApple() {
      const { credential, displayName } = await nativeApple();
      const { user } = await signInWithCredential(auth, credential);
      if (!user.displayName && displayName) await updateProfile(user, { displayName }).catch(() => {});
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
      if (isNative && IOS_GOOGLE_SIGN_IN) {
        // Also forget the Google account, so the next sign-in offers the account picker.
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        await FirebaseAuthentication.signOut().catch(() => {});
      }
      return signOut(auth);
    },

    /**
     * Permanently deletes the account and its saved data. Firebase only allows this
     * right after signing in, so the user confirms who they are first (`password`
     * for email accounts). For Apple accounts this also revokes Tasko's access.
     */
    async deleteAccount(password?: string) {
      const user = auth.currentUser;
      if (!user) throw new Error('You’re not signed in.');
      const method = toCloudUser(user).confirmWith;
      if (method === 'apple') {
        if (!isNative) throw new FriendlyError('Open Tasko on your iPhone to delete an account that uses Sign in with Apple.');
        const { credential, authorizationCode } = await nativeApple();
        await reauthenticateWithCredential(user, credential);
        if (authorizationCode) await revokeAccessToken(auth, authorizationCode).catch(() => {});
      } else if (method === 'password') {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', password ?? ''));
      } else if (isNative) {
        const { idToken, accessToken } = await nativeGoogle();
        await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken, accessToken));
      } else {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      }
      await deleteDoc(userDoc(user.uid));
      await deleteUser(user);
      if (isNative && IOS_GOOGLE_SIGN_IN) {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        await FirebaseAuthentication.signOut().catch(() => {});
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

function toCloudUser(u: User): CloudUser {
  const providers = u.providerData.map((p) => p.providerId);
  const confirmWith =
    providers.includes('apple.com') && (isNative || providers.length === 1)
      ? 'apple'
      : providers.includes('password')
        ? 'password'
        : providers.includes('google.com')
          ? 'google'
          : 'apple';
  return { uid: u.uid, email: u.email, name: u.displayName, photoURL: u.photoURL, confirmWith };
}
