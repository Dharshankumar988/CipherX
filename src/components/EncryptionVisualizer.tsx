import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

export interface VisualizerProps {
  isActive: boolean;
  algorithm: string;
  originalText: string;
  processedText: string;
  isEncrypting: boolean;
}

export const EncryptionVisualizer: React.FC<VisualizerProps> = ({
  isActive,
  algorithm,
  originalText,
  processedText,
  isEncrypting
}) => {
  const [displayText, setDisplayText] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setDisplayText('');
      setProgress(0);
      return;
    }

    let interval: NodeJS.Timeout;
    const duration = 1500; // 1.5 seconds animation
    const steps = 30;
    const stepTime = duration / steps;
    let currentStep = 0;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';

    interval = setInterval(() => {
      currentStep++;
      const ratio = currentStep / steps;
      setProgress(Math.round(ratio * 100));

      if (currentStep >= steps) {
        setDisplayText(processedText);
        clearInterval(interval);
      } else {
        // Scramble animation
        const targetLength = processedText.length;
        let scrambled = '';
        for (let i = 0; i < targetLength; i++) {
          if (Math.random() < ratio) {
            scrambled += processedText[i];
          } else {
            scrambled += chars[Math.floor(Math.random() * chars.length)];
          }
        }
        setDisplayText(scrambled);
      }
    }, stepTime);

    return () => clearInterval(interval);
  }, [isActive, processedText]);

  if (!isActive) return null;

  return (
    <div className="fixed bottom-6 left-20 z-50 w-80 bg-cyber-bg border border-cyber-accent rounded-xl shadow-[0_0_15px_rgba(57,255,20,0.2)] overflow-hidden">
      <div className="bg-cyber-card p-3 border-b border-cyber-accent/30 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          {isEncrypting ? (
            <ShieldCheck size={16} className="text-cyber-accent" />
          ) : (
            <ShieldAlert size={16} className="text-yellow-400" />
          )}
          <span className="text-xs font-bold text-cyber-text uppercase">
            {isEncrypting ? 'Encrypting' : 'Decrypting'}
          </span>
        </div>
        <span className="text-xs text-cyber-accent font-mono">{algorithm}</span>
      </div>
      
      <div className="p-4 space-y-4">
        <div>
          <div className="text-[10px] text-cyber-secondary uppercase mb-1">Input</div>
          <div className="text-sm text-cyber-text font-mono truncate opacity-50">{originalText}</div>
        </div>
        
        <div>
          <div className="text-[10px] text-cyber-secondary uppercase mb-1">Output Processing... {progress}%</div>
          <div className="text-sm text-cyber-accent font-mono break-all line-clamp-3 h-16">{displayText}</div>
        </div>
        
        <div className="w-full bg-cyber-card h-1 mt-2">
          <div 
            className="bg-cyber-accent h-full transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
