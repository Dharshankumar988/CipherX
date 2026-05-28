import React from 'react';
import { Shield, Key, Lock, Fingerprint } from 'lucide-react';

export const EncryptionInfo: React.FC = () => {
  return (
    <div className="bg-cyber-bg/80 border border-cyber-secondary/20 p-6 rounded-xl mt-8">
      <h3 className="text-xl font-bold text-cyber-neon mb-4 uppercase tracking-wider flex items-center">
        <Shield className="w-6 h-6 mr-3 text-cyber-accent" />
        Encryption Algorithms Explained
      </h3>
      
      <div className="space-y-6">
        <div className="flex gap-4 items-start">
          <div className="bg-cyber-secondary/10 p-3 rounded-lg text-cyber-secondary">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-cyber-text mb-1">Caesar Cipher</h4>
            <p className="text-sm text-cyber-secondary mb-2">
              A classic substitution cipher that shifts letters by a fixed number.
            </p>
            <div className="text-xs bg-cyber-bg border border-cyber-secondary/30 p-2 rounded text-cyber-text/80">
              <strong>How to use:</strong> Provide a number (e.g., "3") as the secret key. If you type "A" with a shift of 3, it becomes "D".
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-cyber-secondary/10 p-3 rounded-lg text-cyber-neon">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-cyber-text mb-1">AES (Advanced Encryption Standard)</h4>
            <p className="text-sm text-cyber-secondary mb-2">
              Military-grade symmetric encryption used worldwide to protect classified data.
            </p>
            <div className="text-xs bg-cyber-bg border border-cyber-secondary/30 p-2 rounded text-cyber-text/80">
              <strong>How to use:</strong> Provide a strong password (e.g., "mySuperSecretPassword123") as the key. The exact same password must be used by the recipient to decrypt.
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="bg-cyber-secondary/10 p-3 rounded-lg text-cyber-primary">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-cyber-text mb-1">RSA (Public-Key Cryptography)</h4>
            <p className="text-sm text-cyber-secondary mb-2">
              Asymmetric encryption where messages are locked with a public key and can only be unlocked by the corresponding private key.
            </p>
            <div className="text-xs bg-cyber-bg border border-cyber-secondary/30 p-2 rounded text-cyber-text/80">
              <strong>How to use:</strong> No secret key needed when chatting! Generate your RSA keys in Settings. When you send a message, it automatically encrypts using the recipient's public key. Only they can read it!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
