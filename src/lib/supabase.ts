import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase Dashboard
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isPWA = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as any).standalone) ||
    document.referrer.includes('android-app://')
  );
};

const customStorage = {
  getItem: (key: string) => {
    return isPWA() ? window.localStorage.getItem(key) : window.sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (isPWA()) {
      window.localStorage.setItem(key, value);
    } else {
      window.sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    if (isPWA()) {
      window.localStorage.removeItem(key);
    } else {
      window.sessionStorage.removeItem(key);
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // @ts-ignore - disable cross-tab navigator.locks to prevent deadlocks
    lock: false
  }
});
