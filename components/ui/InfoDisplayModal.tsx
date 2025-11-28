import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import Button from './Button';
import { Search } from 'lucide-react';

interface InfoDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: string[];
}

const InfoDisplayModal: React.FC<InfoDisplayModalProps> = ({ isOpen, onClose, title, items }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItems = useMemo(() => {
        if (!searchTerm) return items;
        return items.filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [items, searchTerm]);


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${title} (${items.length})`} size="md">
      <div className="space-y-4">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
                type="text"
                placeholder={`Search ${title}...`}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full p-2 pl-9 rounded-md bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-gray-300 dark:border-gray-600"
            />
        </div>

        <div className="max-h-80 overflow-y-auto border dark:border-gray-700 rounded-lg p-2 space-y-1">
            {filteredItems.length > 0 ? (
                filteredItems.map((item, index) => (
                    <div key={index} className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md text-sm text-text-light dark:text-text-dark">
                        {item}
                    </div>
                ))
            ) : (
                <p className="text-center text-text-muted-light dark:text-text-muted-dark py-4">
                    No items match your search.
                </p>
            )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
};

export default InfoDisplayModal;
