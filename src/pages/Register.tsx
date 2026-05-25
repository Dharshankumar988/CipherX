import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { GlassCard } from '../components/GlassCard';
import { NeonButton } from '../components/NeonButton';
import { ScreenContainer } from '../components/ScreenContainer';

export const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && session) {
      if (profile?.status === 'pending') {
        navigate('/pending', { replace: true });
      } else if (profile) {
        navigate('/', { replace: true });
      }
    }
  }, [session, profile, authLoading, navigate]);

  if (authLoading && !session) {
    return (
      <ScreenContainer showSidebar={false}>
        <div className="flex-1 flex items-center justify-center text-cyber-neon">
          Loading...
        </div>
      </ScreenContainer>
    );
  }

  async function signUpWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        if (!data.session) {
          setErrorMsg('Registration successful! Please check your email to confirm your account.');
        } else {
          navigate('/pending');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer showSidebar={false}>
      <div className="flex-1 flex justify-center items-center h-full">
        <div className="w-full max-w-md">
          <GlassCard>
            <div className="flex flex-col items-center mb-10 mt-4">
              <Shield size={56} className="text-cyber-neon" />
              <h1 className="text-4xl font-bold text-cyber-text mt-6 tracking-wide text-shadow-neon">CIPHERX</h1>
              <p className="text-cyber-secondary mt-2 tracking-widest text-xs uppercase">Create your account</p>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-xl mb-6 text-sm text-center">
                {errorMsg}
              </div>
            )}

            <form onSubmit={signUpWithEmail} className="flex flex-col space-y-4">
              <div>
                <label className="block text-cyber-secondary text-xs font-bold mb-2 ml-1 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  className="w-full bg-cyber-bg border border-cyber-secondary/20 text-cyber-text p-4 rounded-xl focus:border-cyber-accent focus:outline-none transition-colors"
                  onChange={e => setEmail(e.target.value)}
                  value={email}
                  placeholder="email@address.com"
                  required
                />
              </div>
              <div className="mb-8">
                <label className="block text-cyber-secondary text-xs font-bold mb-2 ml-1 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  className="w-full bg-cyber-bg border border-cyber-secondary/20 text-cyber-text p-4 rounded-xl focus:border-cyber-accent focus:outline-none transition-colors"
                  onChange={e => setPassword(e.target.value)}
                  value={password}
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <NeonButton 
                title={loading ? 'SIGNING UP...' : 'SIGN UP'} 
                type="submit"
                disabled={loading} 
              />

              <div className="flex justify-center mt-8 mb-4">
                <span className="text-cyber-secondary mr-2">Already have an account? </span>
                <Link to="/login" className="text-cyber-neon font-bold hover:underline">
                  Login
                </Link>
              </div>
            </form>
          </GlassCard>
        </div>
      </div>
    </ScreenContainer>
  );
};
