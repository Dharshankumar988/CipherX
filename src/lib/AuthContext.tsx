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
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ 
  session: null, 
  user: null, 
  profile: null, 
  loading: true,
  refreshProfile: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initialised = useRef(false);
  const profileRef = useRef<Profile | null>(null);
  const profileChannelRef = useRef<any>(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const setupProfileSubscription = (userId: string) => {
    if (profileChannelRef.current) {
      supabase.removeChannel(profileChannelRef.current);
    }
    const channel = supabase
      .channel(`public:profiles:id=eq.${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          setProfile(payload.new as Profile);
        }
      )
      .subscribe();
    profileChannelRef.current = channel;
  };

  const refreshProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (!error && data) {
          setProfile(data as Profile);
        }
      } catch (e) {
        console.error('Profile refresh error:', e);
      }
    }
  };

  const fetchProfileWithRetries = async (userId: string, maxRetries = 4) => {
    let retries = maxRetries;
    let delay = 500;
    let lastError = null;
    
    while (retries > 0) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (data) return { data: data as Profile, error: null };
      
      lastError = error;
      // Do not stop on network errors, keep retrying. This is vital for mobile/PWA stability.
      await new Promise(r => setTimeout(r, delay));
      retries--;
      delay = Math.min(delay * 1.5, 2000);
    }
    return { data: null, error: lastError };
  };

  useEffect(() => {
    let mounted = true;

    // Supabase handles the initial session load and emits an event (INITIALIZED or SIGNED_IN)
    // We rely purely on the auth listener to prevent double-fetching on mount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      
      // Update session state synchronously so UI reacts fast
      setSession(newSession);

      if (newSession?.user) {
        // If we don't have the profile for this user yet, fetch it
        if (!profileRef.current || profileRef.current.id !== newSession.user.id) {
          setLoading(true);
          
          try {
            const { data: profileData, error } = await fetchProfileWithRetries(newSession.user.id);

            if (mounted) {
              if (profileData) {
                setProfile(profileData);
                setupProfileSubscription(newSession.user.id);
              } else {
                console.error('Profile fetch failed after retries:', error);
                // Only sign out if we are CERTAIN the profile does not exist in the database.
                // If it's a persistent network error, we leave profile as null and let the UI handle it
                // instead of forcefully logging them out.
                if (error?.code === 'PGRST116') {
                  supabase.auth.signOut();
                }
              }
            }
          } catch (e) {
            console.error('Profile fetch unexpected error:', e);
          } finally {
            if (mounted) {
              setLoading(false);
              initialised.current = true;
            }
          }
        } else {
          // Profile already matches, just ensure we aren't loading anymore
          if (mounted) {
            setLoading(false);
            initialised.current = true;
          }
        }
      } else {
        // No user, signed out
        if (mounted) {
          setProfile(null);
          setLoading(false);
          initialised.current = true;
          if (profileChannelRef.current) {
            supabase.removeChannel(profileChannelRef.current);
            profileChannelRef.current = null;
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (profileChannelRef.current) {
        supabase.removeChannel(profileChannelRef.current);
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
