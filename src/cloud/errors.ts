/** Human-friendly message for a Firebase auth error, or null to stay silent. */
export function authErrorMessage(e: unknown): string | null {
  const code = (e as { code?: string })?.code ?? '';
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
    case 'auth/operation-not-allowed':
      return 'This sign-in method isn’t enabled in Firebase yet.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
