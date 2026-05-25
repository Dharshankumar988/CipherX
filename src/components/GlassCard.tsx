import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`bg-cyber-card border-t border-t-cyber-accent/30 border border-cyber-secondary/10 rounded-2xl p-6 shadow-lg overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
