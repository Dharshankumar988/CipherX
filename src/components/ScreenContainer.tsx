import React from 'react';
import { MessageSquare, Settings, LogOut, ShieldAlert } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

interface ScreenContainerProps {
  children: React.ReactNode;
  padded?: boolean;
  showSidebar?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ children, padded = true, showSidebar = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  // Get initials from display_name or username
  const getInitials = () => {
    const name = profile?.display_name || profile?.username || '?';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen w-full bg-cyber-bg text-cyber-text overflow-hidden">
      {showSidebar && (
        <aside className="w-16 flex-shrink-0 border-r border-cyber-secondary/20 flex flex-col items-center py-4 justify-between bg-cyber-bg">
          <div className="flex flex-col items-center space-y-6 w-full">
            {/* Profile Avatar */}
            <button
              onClick={() => navigate('/settings')}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-cyber-neon/30 to-cyber-accent/30 border border-cyber-neon/50 flex items-center justify-center text-cyber-neon text-xs font-bold hover:from-cyber-neon/50 hover:to-cyber-accent/50 transition-all"
              title={profile?.display_name || profile?.username || 'Profile'}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span>{getInitials()}</span>
              )}
            </button>
            <span className="text-[9px] text-cyber-secondary text-center w-full truncate px-1 -mt-4 mb-1">
              {profile?.display_name || profile?.username || ''}
            </span>

            {profile?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className={`w-full flex justify-center py-2 ${location.pathname === '/admin' ? 'border-l-2 border-cyber-accent text-cyber-neon' : 'text-cyber-secondary hover:text-cyber-text'}`}>
                <ShieldAlert size={24} />
              </button>
            )}
            <button onClick={() => navigate('/')} className={`w-full flex justify-center py-2 ${location.pathname === '/' ? 'border-l-2 border-cyber-accent text-cyber-neon' : 'text-cyber-secondary hover:text-cyber-text'}`}>
              <MessageSquare size={24} />
            </button>
            <button onClick={() => navigate('/settings')} className={`w-full flex justify-center py-2 ${location.pathname === '/settings' ? 'border-l-2 border-cyber-accent text-cyber-neon' : 'text-cyber-secondary hover:text-cyber-text'}`}>
              <Settings size={24} />
            </button>
          </div>
          <button onClick={handleLogout} className="text-cyber-secondary hover:text-red-500 transition-colors">
            <LogOut size={24} />
          </button>
        </aside>
      )}
      <main className={`flex-1 overflow-y-auto ${padded ? 'p-6' : ''}`}>
        {children}
      </main>
    </div>
  );
};
