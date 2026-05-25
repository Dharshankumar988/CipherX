import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'user';
  status: 'pending' | 'approved';
  rsa_public_key: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ session: null, user: null, profile: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initialised = useRef(false);

  useEffect(() => {
    // Safety timeout — if Supabase never fires INITIAL_SESSION (e.g. offline)
    // we stop loading after 4 seconds so the UI doesn't hang forever.
    const safetyTimer = setTimeout(() => {
      if (!initialised.current) {
        console.warn('Auth init timed out — forcing loading to false.');
        setLoading(false);
        initialised.current = true;
      }
    }, 4000);

    // onAuthStateChange fires INITIAL_SESSION synchronously on mount with the
    // stored session, then fires again on every sign-in / sign-out event.
    // This is the single source of truth — we don't call getSession() separately.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);

      if (newSession?.user) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newSession.user.id)
            .single();

          setProfile(!error && data ? (data as Profile) : null);
        } catch (e) {
          console.error('Profile fetch error:', e);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      // Mark loading as done once after the very first event fires
      if (!initialised.current) {
        clearTimeout(safetyTimer);
        setLoading(false);
        initialised.current = true;
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
