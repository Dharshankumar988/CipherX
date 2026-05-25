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
    <div className="flex flex-col md:flex-row h-screen w-full bg-cyber-bg text-cyber-text overflow-hidden">
      {showSidebar && (
        <aside className="h-14 md:h-full md:w-16 flex-shrink-0 border-t md:border-t-0 md:border-r border-cyber-secondary/20 flex flex-row md:flex-col items-center px-4 md:py-4 justify-between bg-cyber-bg/95 backdrop-blur-md z-50 order-last md:order-first">
          <div className="flex flex-row md:flex-col items-center justify-around space-x-6 md:space-x-0 md:space-y-6 w-full h-full">
            {/* Profile Avatar */}
            <button
              onClick={() => navigate('/settings')}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-cyber-neon/30 to-cyber-accent/30 border border-cyber-neon/50 flex items-center justify-center text-cyber-neon text-xs font-bold hover:from-cyber-neon/50 hover:to-cyber-accent/50 transition-all flex-shrink-0"
              title={profile?.display_name || profile?.username || 'Profile'}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span>{getInitials()}</span>
              )}
            </button>

            {profile?.role === 'admin' && (
              <button onClick={() => navigate('/admin')} className={`flex justify-center py-2 px-3 md:px-0 md:w-full ${location.pathname === '/admin' ? 'border-b-2 md:border-b-0 md:border-l-2 border-cyber-accent text-cyber-neon' : 'text-cyber-secondary hover:text-cyber-text'}`}>
                <ShieldAlert size={22} className="md:w-6 md:h-6" />
              </button>
            )}
            <button onClick={() => navigate('/')} className={`flex justify-center py-2 px-3 md:px-0 md:w-full ${location.pathname === '/' ? 'border-b-2 md:border-b-0 md:border-l-2 border-cyber-accent text-cyber-neon' : 'text-cyber-secondary hover:text-cyber-text'}`}>
              <MessageSquare size={22} className="md:w-6 md:h-6" />
            </button>
            <button onClick={() => navigate('/settings')} className={`flex justify-center py-2 px-3 md:px-0 md:w-full ${location.pathname === '/settings' ? 'border-b-2 md:border-b-0 md:border-l-2 border-cyber-accent text-cyber-neon' : 'text-cyber-secondary hover:text-cyber-text'}`}>
              <Settings size={22} className="md:w-6 md:h-6" />
            </button>
          </div>
          <button onClick={handleLogout} className="hidden md:block text-cyber-secondary hover:text-red-500 transition-colors">
            <LogOut size={24} />
          </button>
        </aside>
      )}
      <main className={`flex-1 overflow-y-auto ${padded ? 'p-2 md:p-6' : ''}`}>
        {children}
      </main>
    </div>
  );
};
