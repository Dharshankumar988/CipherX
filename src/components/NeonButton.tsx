import React from 'react';

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const NeonButton: React.FC<NeonButtonProps> = ({ title, variant = 'primary', className = '', ...props }) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary': return 'border-cyber-accent bg-transparent';
      case 'danger': return 'border-red-500 bg-red-500/10';
      default: return 'border-cyber-neon bg-cyber-neon/10';
    }
  };

  const getVariantText = () => {
    switch (variant) {
      case 'secondary': return 'text-cyber-accent';
      case 'danger': return 'text-red-500';
      default: return 'text-cyber-neon';
    }
  };

  return (
    <button 
      className={`border-2 rounded-full py-3 px-6 flex items-center justify-center my-2 transition-all hover:scale-[1.02] active:scale-95 ${getVariantClasses()} ${className}`}
      {...props}
    >
      <span className={`font-bold text-lg tracking-widest ${getVariantText()}`}>
        {title.toUpperCase()}
      </span>
    </button>
  );
};
