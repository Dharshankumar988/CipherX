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

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

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

  useEffect(() => {
    let mounted = true;
    let profileSubscription: any = null;

    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (mounted) setSession(currentSession);

        if (currentSession?.user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentSession.user.id)
            .single();

          if (mounted) {
            setProfile(!error && data ? (data as Profile) : null);

            profileSubscription = supabase
              .channel(`public:profiles:id=eq.${currentSession.user.id}`)
              .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${currentSession.user.id}` },
                (payload) => {
                  if (mounted) setProfile(payload.new as Profile);
                }
              )
              .subscribe();
          }
        }
      } catch (e) {
        console.error('Auth initialization error:', e);
      } finally {
        if (mounted) {
          setLoading(false);
          initialised.current = true;
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      
      if (newSession?.user) {
        // Only fetch profile if it's missing or a different user logged in
        if (!profileRef.current || profileRef.current.id !== newSession.user.id) {
          setLoading(true);
          try {
            // Add retry logic because DB trigger might take a few ms
            let retries = 3;
            let profileData = null;
            
            while (retries > 0 && !profileData) {
              const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', newSession.user.id)
                .single();
                
              if (data) {
                profileData = data;
              } else {
                await new Promise(r => setTimeout(r, 500)); // wait 500ms before retry
                retries--;
              }
            }

            if (mounted && profileData) setProfile(profileData as Profile);
          } catch (e) {
            console.error('Profile fetch error:', e);
          } finally {
            if (mounted) setLoading(false);
          }
        }
        setSession(newSession);
      } else {
        if (mounted) {
          setProfile(null);
          setSession(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (profileSubscription) {
        supabase.removeChannel(profileSubscription);
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
