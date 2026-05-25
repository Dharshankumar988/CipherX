import React, { useEffect } from 'react';
import { Shield, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { GlassCard } from '../components/GlassCard';
import { ScreenContainer } from '../components/ScreenContainer';

export const Pending: React.FC = () => {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        navigate('/login', { replace: true });
      } else if (profile && profile.status === 'approved') {
        navigate('/', { replace: true });
      }
    }
  }, [session, profile, loading, navigate]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  if (loading) {
    return (
      <ScreenContainer showSidebar={false}>
        <div className="flex-1 flex items-center justify-center text-cyber-neon">
          Loading...
        </div>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer showSidebar={false}>
      <div className="flex-1 flex justify-center items-center h-full">
        <div className="w-full max-w-md">
          <GlassCard className="text-center py-10">
            <Shield size={64} className="text-yellow-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-cyber-text mb-4 tracking-wide">PENDING APPROVAL</h1>
            <p className="text-cyber-secondary leading-relaxed">
              Your account has been created successfully, but an administrator must approve your access before you can use the encrypted communications system.
            </p>
            <p className="text-cyber-secondary mt-4 text-sm mb-8">
              Please check back later or contact an administrator.
            </p>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center space-x-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-6 py-3 rounded-xl transition-all duration-300 font-bold tracking-wider text-sm"
            >
              <LogOut size={16} />
              <span>LOG OUT / EXIT</span>
            </button>
          </GlassCard>
        </div>
      </div>
    </ScreenContainer>
  );
};
