/** An error whose message is written for the user and shown as is. */
export class FriendlyError extends Error {}

/** Human-friendly message for a Firebase auth error, or null to stay silent. */
export function authErrorMessage(e: unknown): string | null {
  if (e instanceof FriendlyError) return e.message;
  const code = (e as { code?: string })?.code ?? '';
  const message = (e as { message?: string })?.message ?? '';
  // The native Google and Apple sheets report a cancel as an error.
  if (/cancel|error 1001\b/i.test(message)) return null;
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.';
    case 'auth/invalid-email':
      return 'That email address doesn’t look right.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password needs at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'Can’t reach the server. Check your connection.';
    case 'auth/account-exists-with-different-credential':
      return 'This email is already used with a different sign-in method.';
    case 'auth/unauthorized-domain':
      return 'This website isn’t authorized for sign-in yet (add it under Authentication → Settings → Authorized domains in Firebase).';
    case 'auth/credential-already-in-use':
      return 'That Google account is already used by a different Tasko account. Pick another Google account.';
    case 'auth/user-mismatch':
      return 'Choose the same Google account you signed in with.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google popup. Allow popups for this site and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method isn’t enabled in Firebase yet.';
    case 'auth/requires-recent-login':
      return 'For security, sign out and sign back in, then try again.';
    case 'permission-denied':
      return 'Tasko couldn’t delete your saved data. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
