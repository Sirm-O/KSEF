import React from 'react';

interface LogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

const Logo: React.FC<LogoProps> = ({ className, width = "48", height = "48" }) => {
  return (
    <img
      src="/KSEF Logo.png"
      alt="Kenya Science and Engineering Fair Logo"
      width={width}
      height={height}
      className={className}
    />
  );
};

export default Logo;
