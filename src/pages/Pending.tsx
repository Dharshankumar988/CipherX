import React from 'react';
import { Shield } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { ScreenContainer } from '../components/ScreenContainer';

export const Pending: React.FC = () => {
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
            <p className="text-cyber-secondary mt-4 text-sm">
              Please check back later or contact an administrator.
            </p>
          </GlassCard>
        </div>
      </div>
    </ScreenContainer>
  );
};
