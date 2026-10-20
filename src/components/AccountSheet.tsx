import { useState, type FormEvent } from 'react';
import type { CloudApi, CloudUser } from '../cloud/api';
import { IOS_GOOGLE_SIGN_IN, PRIVACY_URL } from '../cloud/config';
import { authErrorMessage } from '../cloud/errors';
import { isNative } from '../native';
import type { SyncStatus } from '../cloud/useCloudSync';
import { LogoMark } from './Logo';
import { Sheet } from './Sheet';

interface Props {
  api: CloudApi | null;
  user: CloudUser | null;
  sync: SyncStatus;
  onSignOut: () => Promise<void>;
  onDeleteAccount: (password?: string) => Promise<void>;
  onClose: () => void;
}

export const SYNC_LABEL: Record<SyncStatus, string> = {
  connecting: 'Connecting…',
  saving: 'Saving…',
  synced: 'All changes saved',
  offline: 'Offline — will sync when you’re back online',
  error: 'Couldn’t sync. Retrying on your next change.',
};

export function AccountSheet({ api, user, sync, onSignOut, onDeleteAccount, onClose }: Props) {
  return (
    <Sheet title={user ? 'Account' : 'Sign in'} onClose={onClose}>
      {user ? (
        <SignedIn user={user} sync={sync} onSignOut={onSignOut} onDeleteAccount={onDeleteAccount} onClose={onClose} />
      ) : (
        <SignInForm api={api} />
      )}
      <a className="privacy-link muted small" href={PRIVACY_URL} target="_blank" rel="noopener">
        Privacy policy
      </a>
    </Sheet>
  );
}

function SignedIn({
  user,
  sync,
  onSignOut,
  onDeleteAccount,
  onClose,
}: Pick<Props, 'sync' | 'onSignOut' | 'onDeleteAccount' | 'onClose'> & { user: CloudUser }) {
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (deleting) return <DeleteAccount user={user} onDelete={onDeleteAccount} onCancel={() => setDeleting(false)} onDone={onClose} />;
  return (
    <div className="form">
      <div className="account-card glass-soft">
        <Avatar user={user} size={52} />
        <div className="account-id">
          <strong>{user.name ?? user.email}</strong>
          {user.name && <span className="muted small">{user.email}</span>}
          <span className={`sync-line sync-${sync}`}>
            <span className="sync-dot" /> {SYNC_LABEL[sync]}
          </span>
        </div>
      </div>
      <p className="muted small">
        Your tasks, categories and progress are saved to your account and stay in sync on every device you sign in on.
      </p>
      <button
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onSignOut();
          onClose();
        }}
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      <button className="link-btn danger-link" disabled={busy} onClick={() => setDeleting(true)}>
        Delete account
      </button>
    </div>
  );
}

const CONFIRM_HINT: Record<CloudUser['confirmWith'], string> = {
  password: 'Enter your password to confirm.',
  google: 'You’ll confirm with Google.',
  apple: 'You’ll confirm with Apple.',
};

function DeleteAccount({
  user,
  onDelete,
  onCancel,
  onDone,
}: {
  user: CloudUser;
  onDelete: (password?: string) => Promise<void>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsPassword = user.confirmWith === 'password';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onDelete(needsPassword ? password : undefined);
      onDone();
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <p className="delete-warning">
        This permanently deletes your Tasko account <strong>{user.email ?? user.name}</strong> and everything saved to
        it: tasks, categories, XP, levels and trophies, on every device. It can’t be undone.
      </p>
      <p className="muted small">
        {CONFIRM_HINT[user.confirmWith]}
      </p>
      {needsPassword && (
        <label className="field">
          <span>Password</span>
          <input
            className="text-input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      )}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn danger-fill" disabled={busy}>
          {busy ? 'Deleting…' : 'Delete forever'}
        </button>
      </div>
    </form>
  );
}

function SignInForm({ api }: { api: CloudApi | null }) {
  const [mode, setMode] = useState<'signIn' | 'signUp' | 'reset'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!api) return;
    if (mode === 'reset') {
      run(async () => {
        await api.resetPassword(email.trim());
        setInfo('If an account exists for that email, a reset link is on its way.');
      });
    } else if (mode === 'signUp') {
      run(() => api.signUpWithEmail(email.trim(), password));
    } else {
      run(() => api.signInWithEmail(email.trim(), password));
    }
  };

  if (!api) return <p className="muted">Loading…</p>;

  return (
    <div className="form">
      <div className="auth-brand">
        <LogoMark size={56} />
      </div>
      <p className="muted small auth-pitch">
        Sign in to back up your quests and progress and sync them across your devices. Anything you’ve done here
        already comes with you.
      </p>

      {mode !== 'reset' && (!isNative || IOS_GOOGLE_SIGN_IN) && (
        <>
          {isNative && (
            <button className="btn apple-btn" disabled={busy} onClick={() => run(() => api.signInWithApple())}>
              {/* U+F8FF is the Apple logo in Apple's system fonts; this button only shows on iOS. */}
              <span className="apple-mark" aria-hidden="true">{'\uF8FF'}</span> Continue with Apple
            </button>
          )}
          <button className="btn google-btn" disabled={busy} onClick={() => run(() => api.signInWithGoogle())}>
            <GoogleLogo /> Continue with Google
          </button>
          <div className="divider"><span>or use email</span></div>
        </>
      )}

      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input
            className="text-input"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {mode !== 'reset' && (
          <label className="field">
            <span>Password</span>
            <input
              className="text-input"
              type="password"
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}

        {error && <p className="auth-error" role="alert">{error}</p>}
        {info && <p className="auth-info" role="status">{info}</p>}

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'One moment…' : mode === 'signUp' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
        </button>
      </form>

      <div className="auth-links">
        {mode === 'signIn' && (
          <>
            <button className="link-btn" onClick={() => setMode('signUp')}>New here? Create an account</button>
            <button className="link-btn muted" onClick={() => setMode('reset')}>Forgot password?</button>
          </>
        )}
        {mode !== 'signIn' && (
          <button className="link-btn" onClick={() => { setMode('signIn'); setError(null); setInfo(null); }}>
            ← Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}

export function Avatar({ user, size = 36 }: { user: CloudUser; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (user.name ?? user.email ?? '?').trim().charAt(0).toUpperCase();
  return user.photoURL && !broken ? (
    <img
      className="avatar"
      src={user.photoURL}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  ) : (
    <span className="avatar avatar-initial" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {initial}
    </span>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

