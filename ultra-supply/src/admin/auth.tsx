import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api, type AdminSession } from '@/lib/api';

interface AuthValue {
  session: AdminSession | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const sync = useCallback(async () => {
    const s = await api.getSession();
    setSession(s);
    setIsAdmin(s ? await api.isAdmin() : false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void sync();
    return api.onAuthChange(() => void sync());
  }, [sync]);

  const signIn = async (email: string, password: string) => {
    await api.signIn(email, password);
    await sync();
  };
  const signOut = async () => {
    await api.signOut();
    await sync();
  };

  return <AuthContext.Provider value={{ session, isAdmin, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Route guard: only authenticated administrators may render children. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist">
        <Loader2 className="h-6 w-6 animate-spin text-navy" />
      </div>
    );
  }
  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname, denied: Boolean(session && !isAdmin) }} />;
  }
  return <>{children}</>;
}
