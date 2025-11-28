
import React, { ReactNode } from 'react';

// FIX: Added a `size` prop to the ButtonProps interface to allow for different button sizes.
// --- MODIFICATION START ---
// Added 'as' prop to allow rendering as a different element (e.g., a <label>).
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  as?: 'button' | 'label';
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ children, as = 'button', variant = 'primary', size = 'md', className = '', ...props }) => {
  // FIX: Moved padding classes from baseClasses to a new sizeClasses object to handle different sizes.
  // Added flex properties for consistent alignment of content like icons.
  const baseClasses = 'inline-flex items-center justify-center rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };
  
  const variantClasses = {
    primary: 'bg-primary hover:bg-primary-dark text-white focus:ring-primary',
    secondary: 'bg-secondary hover:bg-opacity-80 text-white focus:ring-secondary',
    ghost: 'bg-transparent hover:bg-gray-200 dark:hover:bg-gray-700 text-text-light dark:text-text-dark focus:ring-gray-400',
  };

  const combinedClassName = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  if (as === 'label') {
    // Filter out props that are not valid for a <label> element.
    const { type, ...labelProps } = props as any;
    return (
      <label className={combinedClassName} {...labelProps}>
        {children}
      </label>
    );
  }

  return (
    <button className={combinedClassName} {...props}>
      {children}
    </button>
  );
};
// --- MODIFICATION END ---

export default Button;
