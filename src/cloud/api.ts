// The only module that imports Firebase. It's loaded lazily, so guests who never
// sign in don't download the SDK. Swap this file to change backends.
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
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
import type { CloudConfig } from './config';

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
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    // Keeps working offline and syncs when the connection comes back.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }

  const userDoc = (uid: string) => doc(db, 'users', uid);

  return {
    onUser(cb: (user: CloudUser | null) => void) {
      return onAuthStateChanged(auth, (u) =>
        cb(u ? { uid: u.uid, email: u.email, name: u.displayName, photoURL: u.photoURL } : null),
      );
    },

    async signInWithGoogle() {
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

    signOut() {
      return signOut(auth);
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
