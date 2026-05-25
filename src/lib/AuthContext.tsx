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

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Use Promise.race to prevent deadlocks if Supabase auth locks get corrupted in the browser
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Session timeout')), 2000));
        
        let currentSession = null;
        try {
          const { data } = await Promise.race([sessionPromise, timeoutPromise]) as any;
          currentSession = data?.session;
        } catch (timeoutErr) {
          console.warn('getSession timed out or failed (possible browser lock corruption).');
        }

        if (mounted) setSession(currentSession);

        if (currentSession?.user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentSession.user.id)
            .single();

          if (mounted) {
            setProfile(!error && data ? (data as Profile) : null);
            setupProfileSubscription(currentSession.user.id);
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
        if (!profileRef.current || profileRef.current.id !== newSession.user.id) {
          setLoading(true);
          try {
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
                await new Promise(r => setTimeout(r, 500));
                retries--;
              }
            }

            if (mounted && profileData) {
              setProfile(profileData as Profile);
              setupProfileSubscription(newSession.user.id);
            }
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
