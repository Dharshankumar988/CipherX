import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase Dashboard
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Generate a unique storage key per tab so multiple accounts
// can be logged in simultaneously in different tabs without conflicts.
let tabId = window.sessionStorage.getItem('cipherx-tab-id');
if (!tabId) {
  tabId = crypto.randomUUID();
  window.sessionStorage.setItem('cipherx-tab-id', tabId);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.sessionStorage,
    storageKey: `sb-auth-${tabId}`,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    // @ts-ignore - disable cross-tab navigator.locks to prevent deadlocks
    lock: false
  }
});
