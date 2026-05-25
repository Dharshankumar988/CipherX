import React, { useEffect, useState } from 'react';
import { ScreenContainer } from '../components/ScreenContainer';
import { EncryptionInfo } from '../components/EncryptionInfo';
import { GlassCard } from '../components/GlassCard';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Save, Copy, Eye, EyeOff, RefreshCw, Camera } from 'lucide-react';
import { generateRSAKeys } from '../lib/ciphers/rsa';

export const Settings: React.FC = () => {
  const { profile, session, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [algorithm, setAlgorithm] = useState('caesar');
  const [defaultShift, setDefaultShift] = useState('3');
  const [showVisualization, setShowVisualization] = useState(true);
  const [rsaPublicKey, setRsaPublicKey] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [rsaPrivateKey, setRsaPrivateKey] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setRsaPublicKey(profile.rsa_public_key || '');
      setAvatarUrl(profile.avatar_url || '');
    }
    if (session?.user.id) {
      supabase.from('user_settings').select('*').eq('user_id', session.user.id).single()
        .then(({ data }) => {
          if (data) {
            setAlgorithm(data.default_algorithm || 'caesar');
            setDefaultShift(data.default_shift || '3');
            setShowVisualization(data.show_visualization ?? false);
            setRsaPrivateKey(data.rsa_private_key || '');
          }
        });
    }
  }, [profile, session]);

  const handleGenerateRSAKeys = async () => {
    setGeneratingKeys(true);
    setMessage('');
    setTimeout(() => {
      try {
        const keys = generateRSAKeys();
        setRsaPublicKey(keys.publicKey);
        setRsaPrivateKey(keys.privateKey);
        setMessage('RSA Keys generated successfully! Click "Save Settings" to persist.');
      } catch (e) {
        console.error(e);
        setMessage('Error generating RSA keys.');
      } finally {
        setGeneratingKeys(false);
      }
    }, 100);
  };

  const handleSave = async () => {
    if (!session?.user.id) return;
    setSaving(true);
    setMessage('');
    
    try {
      // Update profile
      const { error: profileError } = await supabase.from('profiles').update({ 
        display_name: displayName,
        rsa_public_key: rsaPublicKey || null,
        avatar_url: avatarUrl || null
      }).eq('id', session.user.id);
      
      if (profileError) throw new Error(profileError.message);
      
      // Update settings
      const { error: settingsError } = await supabase.from('user_settings')
        .upsert({ 
          user_id: session.user.id, 
          default_algorithm: algorithm,
          default_shift: defaultShift,
          show_visualization: showVisualization,
          rsa_private_key: rsaPrivateKey || null
        });
        
      if (settingsError) throw new Error(settingsError.message);
        
      await refreshProfile();
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setMessage(err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer showSidebar={true}>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-cyber-text tracking-wide mb-8">SYSTEM <span className="text-cyber-neon">SETTINGS</span></h1>
        
        <GlassCard>
          <h2 className="text-xl font-bold text-cyber-neon mb-6 border-b border-cyber-secondary/20 pb-4">USER PROFILE</h2>
          <div className="space-y-4 max-w-md">
            {/* Profile Picture Section */}
            <div className="flex items-start space-x-4">
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-20 h-20 rounded-full border-2 border-cyber-neon/50 object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyber-neon/30 to-cyber-accent/30 border-2 border-cyber-neon/50 flex items-center justify-center text-cyber-neon text-2xl font-bold">
                    {(() => {
                      const name = displayName || profile?.username || '?';
                      return name.slice(0, 2).toUpperCase();
                    })()}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 bg-cyber-bg border border-cyber-neon/50 rounded-full p-1">
                  <Camera size={12} className="text-cyber-neon" />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-cyber-secondary text-xs font-bold mb-2 uppercase">Avatar URL</label>
                <input
                  type="text"
                  className="w-full bg-cyber-bg border border-cyber-secondary/20 text-cyber-text p-3 rounded-lg focus:border-cyber-accent focus:outline-none"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
                <p className="text-cyber-secondary/60 text-xs mt-1">Enter a URL to your profile picture (e.g. from Gravatar, GitHub, etc.)</p>
              </div>
            </div>
            <div>
              <label className="block text-cyber-secondary text-xs font-bold mb-2 uppercase">Display Name</label>
              <input 
                type="text"
                className="w-full bg-cyber-bg border border-cyber-secondary/20 text-cyber-text p-3 rounded-lg focus:border-cyber-accent focus:outline-none"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
              />
            </div>
            <div>
              <label className="block text-cyber-secondary text-xs font-bold mb-2 uppercase">Email (Read Only)</label>
              <input 
                type="text"
                className="w-full bg-cyber-bg/50 border border-cyber-secondary/10 text-cyber-secondary p-3 rounded-lg cursor-not-allowed"
                value={profile?.email || ''}
                readOnly
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-xl font-bold text-cyber-accent mb-6 border-b border-cyber-secondary/20 pb-4">ENCRYPTION PREFERENCES</h2>
          <div className="space-y-6 max-w-md">
            <div>
              <label className="block text-cyber-secondary text-xs font-bold mb-2 uppercase">Default Algorithm</label>
              <select 
                className="w-full bg-cyber-bg border border-cyber-secondary/20 text-cyber-text p-3 rounded-lg focus:border-cyber-accent focus:outline-none appearance-none"
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
              >
                <option value="caesar">Caesar Cipher</option>
                <option value="vigenere">Vigenère Cipher</option>
                <option value="aes">AES-256</option>
                <option value="rsa">RSA (Asymmetric)</option>
              </select>
            </div>

            {algorithm !== 'rsa' && (
              <div>
                <label className="block text-cyber-secondary text-xs font-bold mb-2 uppercase">
                  {algorithm === 'caesar' ? 'Symmetric Shift (Positive Integer)' : 'Symmetric Key / Keyword'}
                </label>
                <input 
                  type={algorithm === 'caesar' ? 'number' : 'text'}
                  className="w-full bg-cyber-bg border border-cyber-secondary/20 text-cyber-text p-3 rounded-lg focus:border-cyber-accent focus:outline-none"
                  value={defaultShift}
                  onChange={(e) => setDefaultShift(e.target.value)}
                  placeholder={algorithm === 'caesar' ? 'e.g. 3' : 'e.g. KEY or secret_phrase'}
                />
              </div>
            )}
            
            <div className="flex items-center justify-between p-4 border border-cyber-secondary/20 rounded-lg">
              <div>
                <div className="text-cyber-text font-bold">Visualize Encryption</div>
                <div className="text-xs text-cyber-secondary mt-1">Show animation during sending/receiving</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={showVisualization} onChange={(e) => setShowVisualization(e.target.checked)} />
                <div className="w-11 h-6 bg-cyber-secondary/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyber-neon"></div>
              </label>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-xl font-bold text-cyber-neon mb-6 border-b border-cyber-secondary/20 pb-4">ASYMMETRIC RSA KEYS</h2>
          <p className="text-cyber-secondary text-xs mb-6">
            RSA uses a keypair. Other users use your <strong>Public Key</strong> to encrypt messages they send to you. You use your <strong>Private Key</strong> to decrypt them.
          </p>
          
          <div className="space-y-4">
            {rsaPublicKey ? (
              <>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-cyber-secondary text-xs font-bold uppercase">Public Key (Shared with contacts)</label>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(rsaPublicKey);
                        setMessage('Public Key copied to clipboard!');
                        setTimeout(() => setMessage(''), 3000);
                      }}
                      className="text-cyber-accent hover:text-white flex items-center text-xs"
                    >
                      <Copy size={12} className="mr-1" /> Copy
                    </button>
                  </div>
                  <textarea 
                    className="w-full bg-cyber-bg/50 border border-cyber-secondary/15 text-cyber-secondary font-mono text-[10px] p-3 rounded-lg h-24 focus:outline-none cursor-text resize-none"
                    value={rsaPublicKey}
                    readOnly
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-cyber-secondary text-xs font-bold uppercase">Private Key (Keep Secret)</label>
                    <button 
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="text-cyber-accent hover:text-white flex items-center text-xs"
                    >
                      {showPrivateKey ? <EyeOff size={12} className="mr-1" /> : <Eye size={12} className="mr-1" />} 
                      {showPrivateKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <textarea 
                    className="w-full bg-cyber-bg/50 border border-cyber-secondary/15 text-cyber-secondary font-mono text-[10px] p-3 rounded-lg h-24 focus:outline-none cursor-text resize-none"
                    value={showPrivateKey ? rsaPrivateKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                    readOnly
                  />
                </div>
              </>
            ) : (
              <div className="p-4 border border-dashed border-cyber-secondary/20 rounded-lg text-center">
                <p className="text-sm text-cyber-secondary mb-3">No RSA keys detected for your secure identity.</p>
              </div>
            )}
            
            <button
              type="button"
              onClick={handleGenerateRSAKeys}
              disabled={generatingKeys}
              className="bg-cyber-accent/10 border border-cyber-accent text-cyber-accent font-bold py-2 px-4 rounded hover:bg-cyber-accent/20 transition-colors flex items-center text-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={`mr-2 ${generatingKeys ? 'animate-spin' : ''}`} />
              {generatingKeys ? 'GENERATING SECURE RSA KEYPAIR (2048-bit)...' : rsaPublicKey ? 'REGENERATE NEW RSA KEYPAIR' : 'GENERATE RSA KEYPAIR'}
            </button>
          </div>
        </GlassCard>

        <div className="flex items-center space-x-4">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="bg-cyber-neon/10 border-2 border-cyber-neon text-cyber-neon font-bold py-3 px-8 rounded-lg hover:bg-cyber-neon/20 transition-colors flex items-center"
          >
            <Save size={18} className="mr-2" />
            {saving ? 'SAVING...' : 'SAVE SETTINGS'}
          </button>
          {message && <span className="text-cyber-neon text-sm">{message}</span>}
        </div>

        <EncryptionInfo />
      </div>
    </ScreenContainer>
  );
};
