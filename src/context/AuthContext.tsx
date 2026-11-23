import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import type { BootstrapStatus, UserContext } from '../types/api.ts';

interface AuthContextValue {
  user: UserContext | null;
  token: string | null;
  loading: boolean;
  bootstrapStatus: BootstrapStatus;
  refreshSession: () => Promise<void>;
  refreshBootstrapStatus: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<UserContext>;
  registerWithEmail: (input: {
    email: string;
    password: string;
    fullName: string;
    countryId?: number;
  }) => Promise<UserContext>;
  signInWithGoogle: () => Promise<UserContext>;
  claimSuperAdmin: (input: {
    email: string;
    password: string;
    fullName: string;
    passcode?: string;
  }) => Promise<UserContext>;
  updateProfile: (input: {
    fullName?: string;
    displayName?: string;
    countryId?: number | null;
    preferredLanguageId?: number | null;
    institutionId?: number | null;
    gradeLevel?: string;
    bio?: string;
  }) => Promise<UserContext>;
  signOut: () => Promise<void>;
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserContext | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus>({
    superAdminExists: true,
    passcodeConfigured: false,
  });

  // In-memory token ref to avoid stale closures in apiFetch without using localStorage
  const tokenRef = useRef<string | null>(null);
  const setMemoryToken = useCallback((nextToken: string | null) => {
    tokenRef.current = nextToken;
    setToken(nextToken);
  }, []);

  const apiFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (tokenRef.current) {
      headers.set('Authorization', `Bearer ${tokenRef.current}`);
    }
    return fetch(url, { ...init, headers });
  }, []);

  const refreshBootstrapStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/bootstrap-status');
      if (res.ok) {
        const data = (await res.json()) as BootstrapStatus;
        setBootstrapStatus(data);
      }
    } catch (err) {
      console.error('Failed to check bootstrap status:', err);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      }
    } catch (err) {
      console.error('Failed to refresh session:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    let active = true;
    void refreshBootstrapStatus();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return;
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          setMemoryToken(idToken);
          const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
          if (res.ok) {
            const data = await res.json();
            if (active) setUser(data.user);
          }
        } catch (err) {
          console.error('Firebase auth state sync failed:', err);
        }
      }
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [refreshBootstrapStatus, setMemoryToken]);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<UserContext> => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sign-in failed.');
      }
      setMemoryToken(data.token);
      setUser(data.user);
      return data.user;
    },
    [setMemoryToken],
  );

  const registerWithEmail = useCallback(
    async (input: {
      email: string;
      password: string;
      fullName: string;
      countryId?: number;
    }): Promise<UserContext> => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }
      setMemoryToken(data.token);
      setUser(data.user);
      return data.user;
    },
    [setMemoryToken],
  );

  const signInWithGoogle = useCallback(async (): Promise<UserContext> => {
    const credential = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await credential.user.getIdToken();
    setMemoryToken(idToken);

    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Google sign-in verification failed.');
    }
    setUser(data.user);
    await refreshBootstrapStatus();
    return data.user;
  }, [refreshBootstrapStatus, setMemoryToken]);

  const claimSuperAdmin = useCallback(
    async (input: {
      email: string;
      password: string;
      fullName: string;
      passcode?: string;
    }): Promise<UserContext> => {
      const res = await fetch('/api/auth/claim-super-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Super Administrator setup failed.');
      }
      setMemoryToken(data.token);
      setUser(data.user);
      await refreshBootstrapStatus();
      return data.user;
    },
    [refreshBootstrapStatus, setMemoryToken],
  );

  const updateProfile = useCallback(
    async (input: {
      fullName?: string;
      displayName?: string;
      countryId?: number | null;
      preferredLanguageId?: number | null;
      institutionId?: number | null;
      gradeLevel?: string;
      bio?: string;
    }): Promise<UserContext> => {
      const res = await apiFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile.');
      }
      setUser(data.user);
      return data.user;
    },
    [apiFetch],
  );

  const signOut = useCallback(async () => {
    setMemoryToken(null);
    setUser(null);
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
  }, [setMemoryToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        bootstrapStatus,
        refreshSession,
        refreshBootstrapStatus,
        signInWithEmail,
        registerWithEmail,
        signInWithGoogle,
        claimSuperAdmin,
        updateProfile,
        signOut,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
