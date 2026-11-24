import React, { useEffect, useState } from 'react';
import { CheckCircle2, LogOut, Shield, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { Country, InstitutionItem } from '../types/api.ts';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type AuthTab = 'signin' | 'register' | 'admin-claim';

export function AuthModal({ open, onClose }: AuthModalProps) {
  const {
    user,
    bootstrapStatus,
    signInWithEmail,
    registerWithEmail,
    signInWithGoogle,
    claimSuperAdmin,
    updateProfile,
    signOut,
  } = useAuth();

  const [tab, setTab] = useState<AuthTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Profile fields when authenticated
  const [profileName, setProfileName] = useState('');
  const [profileCountryId, setProfileCountryId] = useState<string>('');
  const [profileInstitutionId, setProfileInstitutionId] = useState<string>('');
  const [profileGrade, setProfileGrade] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(null);
    if (user?.profile) {
      setProfileName(user.profile.fullName || '');
      setProfileCountryId(user.profile.countryId ? String(user.profile.countryId) : '');
      setProfileInstitutionId(
        user.profile.institutionId ? String(user.profile.institutionId) : '',
      );
      setProfileGrade(user.profile.gradeLevel || '');
      setProfileBio(user.profile.bio || '');
    }
    Promise.all([fetch('/api/curriculum?country=NP'), fetch('/api/institutions')])
      .then(async ([curRes, instRes]) => {
        if (curRes.ok) {
          const curJson = await curRes.json();
          setCountries(curJson.countries ?? []);
        }
        if (instRes.ok) {
          const instJson = await instRes.json();
          setInstitutions(instJson.institutions ?? []);
        }
      })
      .catch(() => {});
  }, [open, user]);

  if (!open) return null;

  const showAdminClaimTab = !bootstrapStatus.superAdminExists || bootstrapStatus.passcodeConfigured;

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await registerWithEmail({ email, password, fullName });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await claimSuperAdmin({
        email,
        password,
        fullName,
        passcode: bootstrapStatus.passcodeConfigured ? passcode : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Administrator setup failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In was cancelled or failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await updateProfile({
        fullName: profileName,
        countryId: profileCountryId ? Number(profileCountryId) : null,
        institutionId: profileInstitutionId ? Number(profileInstitutionId) : null,
        gradeLevel: profileGrade,
        bio: profileBio,
      });
      setSuccess('Profile saved to PostgreSQL.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="auth-modal-title" className="font-display text-lg font-bold text-slate-900">
              {user ? 'Account & Active RBAC Profile' : 'Sign In to Hamro Education'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {user
                ? 'Authenticated session backed by PostgreSQL identity & roles.'
                : 'Use Email/Password or Google Sign-In with server-side RBAC verification.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{success}</span>
          </div>
        )}

        {user ? (
          <div className="mt-5 space-y-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-slate-700">{user.email}</span>
                <span className="capitalize text-slate-500">Provider: {user.authProvider}</span>
              </div>
              <div className="mt-2 text-slate-700">
                Active Roles:{' '}
                <strong className="font-semibold text-slate-900">
                  {user.roles.map((r) => r.name).join(' · ')}
                </strong>
              </div>
            </div>

            <form onSubmit={(e) => void handleProfileSave(e)} className="space-y-3.5">
              <div>
                <label htmlFor="prof-name" className="block text-xs font-medium text-slate-700">
                  Full Name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="prof-country"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Country
                  </label>
                  <select
                    id="prof-country"
                    value={profileCountryId}
                    onChange={(e) => setProfileCountryId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="">Select Country</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="prof-grade" className="block text-xs font-medium text-slate-700">
                    Grade / Track
                  </label>
                  <input
                    id="prof-grade"
                    type="text"
                    value={profileGrade}
                    onChange={(e) => setProfileGrade(e.target.value)}
                    placeholder="e.g. Grade 12 Science"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prof-inst" className="block text-xs font-medium text-slate-700">
                  Affiliated Institution
                </label>
                <select
                  id="prof-inst"
                  value={profileInstitutionId}
                  onChange={(e) => setProfileInstitutionId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                >
                  <option value="">Independent Learner / None</option>
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="prof-bio" className="block text-xs font-medium text-slate-700">
                  Academic Bio
                </label>
                <textarea
                  id="prof-bio"
                  rows={2}
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  placeholder="Optional focus area or teaching specialization..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    void signOut();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign Out
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* Google Sign-In */}
            <button
              type="button"
              onClick={() => void handleGoogle()}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-slate-200" />
              <span className="mx-3 text-xs text-slate-400">or Email &amp; Password</span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            {/* Segmented Switch */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setError(null);
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                  tab === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError(null);
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                  tab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Register Student
              </button>
              {showAdminClaimTab && (
                <button
                  type="button"
                  onClick={() => {
                    setTab('admin-claim');
                    setError(null);
                  }}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    tab === 'admin-claim' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Claim Admin
                </button>
              )}
            </div>

            {tab === 'signin' && (
              <form onSubmit={(e) => void handleEmailSignIn(e)} className="space-y-3.5">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium text-slate-700">
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@hamro.edu.np"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? 'Signing In...' : 'Sign In with Email'}
                </button>
              </form>
            )}

            {tab === 'register' && (
              <form onSubmit={(e) => void handleRegister(e)} className="space-y-3.5">
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700">
                    Full Name
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Aarav Adhikari"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700">
                    Email Address
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="aarav@hamro.edu.np"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="reg-password" className="block text-xs font-medium text-slate-700">
                    Password (8+ chars, letter + number)
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? 'Creating Account...' : 'Create Registered Student Account'}
                </button>
              </form>
            )}

            {tab === 'admin-claim' && showAdminClaimTab && (
              <form onSubmit={(e) => void handleClaimAdmin(e)} className="space-y-3.5">
                <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                  <span>
                    {bootstrapStatus.passcodeConfigured
                      ? 'Enter the server-configured bootstrap passcode to elevate or register a Super Administrator.'
                      : 'First-run bootstrap: no Super Administrator exists yet. Claiming this once creates the initial Super Administrator and locks this route.'}
                  </span>
                </div>
                <div>
                  <label htmlFor="claim-name" className="block text-xs font-medium text-slate-700">
                    Administrator Full Name
                  </label>
                  <input
                    id="claim-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Platform Administrator"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="claim-email" className="block text-xs font-medium text-slate-700">
                    Administrator Email
                  </label>
                  <input
                    id="claim-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@hamro.edu.np"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="claim-password"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Password (8+ chars, letter + number)
                  </label>
                  <input
                    id="claim-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                {bootstrapStatus.passcodeConfigured && (
                  <div>
                    <label
                      htmlFor="claim-passcode"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Admin Bootstrap Passcode
                    </label>
                    <input
                      id="claim-passcode"
                      type="password"
                      required
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {submitting ? 'Claiming Super Admin...' : 'Claim Super Administrator'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
