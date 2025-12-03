import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'guest';

const ADMIN_EMAIL = 'naqvidaniyal598@gmail.com';
const ADMIN_PASSWORD = 'dani007';

interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  role: AppRole | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_USERS_KEY = 'mock-auth-users';
const MOCK_ACTIVE_USER_KEY = 'mock-auth-active-user';
const MOCK_GUEST_MODE_KEY = 'mock-auth-guest-mode';
const GUEST_AUTH_USER: AuthUser = {
  id: 'guest-user',
  email: 'guest@hospital.dev',
  fullName: 'Guest User',
};

interface MockUser extends AuthUser {
  password: string;
  role: AppRole;
}

const readMockUsers = (): MockUser[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MOCK_USERS_KEY);
    return raw ? (JSON.parse(raw) as MockUser[]) : [];
  } catch (error) {
    console.warn('Unable to parse mock auth users:', error);
    return [];
  }
};

const writeMockUsers = (users: MockUser[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
};

const getActiveMockUser = (): MockUser | null => {
  if (typeof window === 'undefined') return null;
  const activeId = window.localStorage.getItem(MOCK_ACTIVE_USER_KEY);
  if (!activeId) return null;
  return readMockUsers().find((user) => user.id === activeId) ?? null;
};

const setActiveMockUser = (user: MockUser | null) => {
  if (typeof window === 'undefined') return;
  if (user) {
    window.localStorage.setItem(MOCK_ACTIVE_USER_KEY, user.id);
  } else {
    window.localStorage.removeItem(MOCK_ACTIVE_USER_KEY);
  }
};

const isGuestModeActive = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(MOCK_GUEST_MODE_KEY) === 'true';
};

const setGuestModeActive = (isActive: boolean) => {
  if (typeof window === 'undefined') return;
  if (isActive) {
    window.localStorage.setItem(MOCK_GUEST_MODE_KEY, 'true');
  } else {
    window.localStorage.removeItem(MOCK_GUEST_MODE_KEY);
  }
};

const mapSupabaseUser = (supabaseUser: User | null): AuthUser | null => {
  if (!supabaseUser) return null;
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? 'unknown@user.dev',
    fullName: (supabaseUser.user_metadata as { full_name?: string } | undefined)?.full_name,
  };
};

const mapMockUser = (mockUser: MockUser | null): AuthUser | null => {
  if (!mockUser) return null;
  return {
    id: mockUser.id,
    email: mockUser.email,
    fullName: mockUser.fullName,
  };
};

const createMockUser = (email: string, password: string, fullName: string, role: AppRole): MockUser => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mock-${Date.now()}`,
  email,
  password,
  fullName,
  role,
});

const deriveRoleFromMockUser = (user: MockUser | null): AppRole | null => {
  if (!user) return null;
  return user.email === ADMIN_EMAIL && user.password === ADMIN_PASSWORD ? 'admin' : 'guest';
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    if (!isSupabaseConfigured) {
      return 'guest' as AppRole;
    }
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching user role:', error);
        return 'guest' as AppRole;
      }
      
      return (data?.role as AppRole) || 'guest';
    } catch (err) {
      console.error('Error in fetchUserRole:', err);
      return 'guest' as AppRole;
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const activeUser = getActiveMockUser();
      if (activeUser) {
        const derivedRole = deriveRoleFromMockUser(activeUser);
        setUser(mapMockUser({ ...activeUser, role: derivedRole ?? 'guest' }));
        setRole(derivedRole);
      } else if (isGuestModeActive()) {
        setUser(GUEST_AUTH_USER);
        setRole('guest');
      } else {
        setUser(null);
        setRole(null);
      }
      setIsLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, authSession) => {
      setSession(authSession);
      const mappedUser = mapSupabaseUser(authSession?.user ?? null);
      setUser(mappedUser);

      if (authSession?.user) {
        setTimeout(() => {
          fetchUserRole(authSession.user.id).then(setRole);
        }, 0);
      } else {
        setRole(null);
      }

      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const mappedUser = mapSupabaseUser(session?.user ?? null);
      setUser(mappedUser);

      if (session?.user) {
        fetchUserRole(session.user.id).then(setRole);
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      const users = readMockUsers();
      const existing = users.find((mockUser) => mockUser.email === email);
      if (!existing || existing.password !== password) {
        return { error: new Error('Invalid login credentials') };
      }
      setGuestModeActive(false);
      setActiveMockUser(existing);
      setUser(mapMockUser(existing));
      const derivedRole = deriveRoleFromMockUser(existing) ?? 'guest';
      setRole(derivedRole);
      return { error: null };
    }
    setGuestModeActive(false);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!isSupabaseConfigured) {
      const users = readMockUsers();
      if (users.some((mockUser) => mockUser.email === email)) {
        return { error: new Error('User already registered') };
      }

      const isAdmin = email === ADMIN_EMAIL && password === ADMIN_PASSWORD;
      const role: AppRole = isAdmin ? 'admin' : 'guest';
      const newUser = createMockUser(email, password, fullName, role);
      const updatedUsers = [...users, newUser];
      writeMockUsers(updatedUsers);
      setGuestModeActive(false);
      setActiveMockUser(newUser);
      setUser(mapMockUser(newUser));
      setRole(role);
      return { error: null };
    }

    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      setActiveMockUser(null);
      setGuestModeActive(false);
      setUser(null);
      setSession(null);
      setRole(null);
      return;
    }
    await supabase.auth.signOut();
    setGuestModeActive(false);
    setUser(null);
    setSession(null);
    setRole(null);
  };

  const continueAsGuest = () => {
    if (!isSupabaseConfigured) {
      setActiveMockUser(null);
      setGuestModeActive(true);
    }
    setSession(null);
    setUser(GUEST_AUTH_USER);
    setRole('guest');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isLoading,
        isAdmin: role === 'admin',
        signIn,
        signUp,
        signOut,
        continueAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
