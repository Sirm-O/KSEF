import React, { ReactNode } from 'react';
import Card from './Card';
import { X } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
    >
      <Card 
        className="w-full max-w-lg max-h-[80vh] flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
          <h2 id="info-modal-title" className="text-xl font-bold text-secondary dark:text-accent-green">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto pr-2">
          {children}
        </div>
      </Card>
    </div>
  );
};

export default InfoModal;

// Add some simple animations to tailwind config if not already present
// In a real project, this would go into tailwind.config.js, but for this context, it's a comment
/*
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-out forwards;
}
.animate-slide-up {
  animation: slide-up 0.4s ease-out forwards;
}
*/
// You can add these keyframes to a style tag in index.html for this environment
const style = document.createElement('style');
style.textContent = `
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-out forwards;
}
.animate-slide-up {
  animation: slide-up 0.4s ease-out forwards;
}
`;
document.head.appendChild(style);