import React, { ReactNode, forwardRef } from 'react';

// FIX: Extended CardProps to include all standard div attributes to allow passing props like `onClick`.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

// FIX: Destructured and spread `...props` to the underlying div element.
// --- NEW ---: Added animated border effect on hover.
// --- NEW ---: Wrapped with forwardRef to allow passing refs.
const Card = forwardRef<HTMLDivElement, CardProps>(({ children, className = '', ...props }, ref) => {
  return (
    <div 
      ref={ref}
      className={`relative group rounded-xl shadow-lg p-6 overflow-hidden transition-shadow duration-300 hover:shadow-2xl hover:shadow-accent-green/20 ${className}`} 
      {...props}
    >
      {/* Background element provides the color and sits behind everything */}
      <div className="absolute inset-0 bg-card-light dark:bg-card-dark rounded-xl z-[-10]" aria-hidden="true"></div>

      {/* Animated border spans for the "running line" effect on hover. z-[-1] places them above the background but below the content. */}
      <span className="absolute top-0 left-0 w-0 h-[2px] bg-accent-green transition-all duration-200 ease-out group-hover:w-full z-[-1]" aria-hidden="true"></span>
      <span className="absolute top-0 right-0 w-[2px] h-0 bg-accent-green transition-all duration-200 ease-out delay-200 group-hover:h-full z-[-1]" aria-hidden="true"></span>
      <span className="absolute bottom-0 right-0 w-0 h-[2px] bg-accent-green transition-all duration-200 ease-out delay-[400ms] group-hover:w-full z-[-1]" aria-hidden="true"></span>
      <span className="absolute bottom-0 left-0 w-[2px] h-0 bg-accent-green transition-all duration-200 ease-out delay-[600ms] group-hover:h-full z-[-1]" aria-hidden="true"></span>
      
      {children}
    </div>
  );
});

Card.displayName = "Card";

export default Card;
