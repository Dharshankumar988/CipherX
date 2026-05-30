import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase Dashboard
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Custom lock to prevent navigator.locks deadlocks during HMR or browser glitches
// while still providing multi-tab concurrency protection for token refreshes.
const customLock = async (name: string, _acquireTimeout: number, acquireLock: () => Promise<any>) => {
  const lockKey = `sb-lock:${name}`;
  
  // Wait up to 3 seconds for existing lock to free
  for (let i = 0; i < 30; i++) {
    const expires = window.localStorage.getItem(lockKey);
    if (!expires || parseInt(expires) < Date.now()) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Acquire lock for 10 seconds
  window.localStorage.setItem(lockKey, (Date.now() + 10000).toString());
  
  try {
    return await acquireLock();
  } finally {
    window.localStorage.removeItem(lockKey);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    lock: customLock
  }
});
