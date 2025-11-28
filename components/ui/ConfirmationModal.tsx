import React, { ReactNode } from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  children, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  confirmVariant = 'destructive'
}) => {
  if (!isOpen) return null;

  const confirmButtonClasses = {
      primary: 'bg-primary hover:bg-primary-dark focus:ring-primary text-white',
      secondary: 'bg-secondary hover:bg-opacity-80 focus:ring-secondary text-white',
      ghost: 'bg-transparent hover:bg-gray-200 dark:hover:bg-gray-700 text-text-light dark:text-text-dark focus:ring-gray-400',
      destructive: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="text-center">
        <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${confirmVariant === 'destructive' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-primary/10'}`}>
          <AlertTriangle className={`h-6 w-6 ${confirmVariant === 'destructive' ? 'text-red-600 dark:text-red-400' : 'text-primary'}`} aria-hidden="true" />
        </div>
        <div className="mt-3 text-center sm:mt-5">
          <div className="mt-2">
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
              {children}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-5 sm:mt-6 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
        >
          {cancelText}
        </Button>
        <Button
          type="button"
          className={confirmButtonClasses[confirmVariant]}
          onClick={() => {
            onConfirm();
          }}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
