import React, { useEffect, useState } from 'react';
import { ShieldCheck, UserCheck, ShieldAlert } from 'lucide-react';
import { ScreenContainer } from '../components/ScreenContainer';
import { GlassCard } from '../components/GlassCard';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/AuthContext';

export const Admin: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setProfiles(data as Profile[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleApprove = async (id: string) => {
    await supabase.from('profiles').update({ status: 'approved' }).eq('id', id);
    fetchProfiles();
  };

  const handlePromote = async (id: string) => {
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', id);
    fetchProfiles();
  };

  return (
    <ScreenContainer showSidebar={true}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center mb-8">
          <ShieldAlert size={32} className="text-red-500 mr-4" />
          <h1 className="text-3xl font-bold text-cyber-text tracking-wide">ADMIN <span className="text-red-500">DASHBOARD</span></h1>
        </div>

        <GlassCard>
          <h2 className="text-xl font-bold text-cyber-text mb-6 border-b border-cyber-secondary/20 pb-4">USER MANAGEMENT</h2>
          
          {loading ? (
            <p className="text-cyber-secondary">Loading profiles...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-cyber-secondary/20 text-cyber-secondary text-xs uppercase tracking-wider">
                    <th className="p-4">Username / Email</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Role</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(profile => (
                    <tr key={profile.id} className="border-b border-cyber-secondary/10 hover:bg-cyber-secondary/5 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-cyber-text">{profile.username}</p>
                        <p className="text-xs text-cyber-secondary">{profile.email}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${profile.status === 'approved' ? 'bg-cyber-neon/20 text-cyber-neon' : 'bg-yellow-500/20 text-yellow-500'}`}>
                          {profile.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${profile.role === 'admin' ? 'bg-red-500/20 text-red-500' : 'bg-cyber-secondary/20 text-cyber-secondary'}`}>
                          {profile.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {profile.status === 'pending' && (
                          <button 
                            onClick={() => handleApprove(profile.id)}
                            className="bg-cyber-neon/10 border border-cyber-neon text-cyber-neon px-3 py-1 rounded hover:bg-cyber-neon/20 transition-colors inline-flex items-center"
                          >
                            <UserCheck size={14} className="mr-1" /> Approve
                          </button>
                        )}
                        {profile.role === 'user' && profile.status === 'approved' && (
                          <button 
                            onClick={() => handlePromote(profile.id)}
                            className="bg-red-500/10 border border-red-500 text-red-500 px-3 py-1 rounded hover:bg-red-500/20 transition-colors inline-flex items-center"
                          >
                            <ShieldCheck size={14} className="mr-1" /> Make Admin
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </ScreenContainer>
  );
};
