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

// In-memory fallback to avoid errors when storage is disabled (e.g. private browsing or strict mobile webviews)
const memoryStorage = new Map<string, string>();

const safeStorage = {
  getItem: (key: string) => {
    try {
      if (typeof window !== 'undefined') {
        return isPWA() ? window.localStorage.getItem(key) : window.sessionStorage.getItem(key);
      }
    } catch (e) {
      console.warn('Storage error, falling back to memory storage', e);
    }
    return memoryStorage.get(key) || null;
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof window !== 'undefined') {
        if (isPWA()) {
          window.localStorage.setItem(key, value);
        } else {
          window.sessionStorage.setItem(key, value);
        }
        return;
      }
    } catch (e) {
      console.warn('Storage error, falling back to memory storage', e);
    }
    memoryStorage.set(key, value);
  },
  removeItem: (key: string) => {
    try {
      if (typeof window !== 'undefined') {
        if (isPWA()) {
          window.localStorage.removeItem(key);
        } else {
          window.sessionStorage.removeItem(key);
        }
        return;
      }
    } catch (e) {
      console.warn('Storage error, falling back to memory storage', e);
    }
    memoryStorage.delete(key);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // @ts-ignore - disable cross-tab navigator.locks to prevent deadlocks
    lock: false
  }
});
