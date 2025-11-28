import React from 'react';

const LoadingSpinner: React.FC<{ fullPage?: boolean }> = ({ fullPage = false }) => {
  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-background-light dark:bg-background-dark flex items-center justify-center z-[200]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>;
};

export default LoadingSpinner;
