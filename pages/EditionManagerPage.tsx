import React, { useContext, useState, FormEvent } from 'react';
import { AppContext } from '../context/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Edition } from '../types';
import { GitBranch, Plus, CheckCircle, Edit, Trash2 } from 'lucide-react';
import ConfirmationModal from '../components/ui/ConfirmationModal';

const EditionManagerPage: React.FC = () => {
    const { editions, activeEdition, createEdition, switchActiveEdition, updateEdition, deleteEdition } = useContext(AppContext);
    const [newEditionName, setNewEditionName] = useState('');
    const [newEditionYear, setNewEditionYear] = useState<number | ''>(new Date().getFullYear() + 1);
    
    const [confirmActivateModal, setConfirmActivateModal] = useState<{ isOpen: boolean, edition: Edition | null }>({ isOpen: false, edition: null });
    const [confirmDeleteModal, setConfirmDeleteModal] = useState<{ isOpen: boolean, edition: Edition | null }>({ isOpen: false, edition: null });
    
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editYear, setEditYear] = useState<number | ''>('');


    const handleCreateEdition = (e: FormEvent) => {
        e.preventDefault();
        if (newEditionName.trim() && newEditionYear) {
            createEdition(newEditionName, newEditionYear);
            setNewEditionName('');
            setNewEditionYear(new Date().getFullYear() + 1);
        }
    };

    const handleActivateClick = (edition: Edition) => {
        setConfirmActivateModal({ isOpen: true, edition });
    };

    const handleConfirmActivate = () => {
        if (confirmActivateModal.edition) {
            switchActiveEdition(confirmActivateModal.edition.id);
        }
        setConfirmActivateModal({ isOpen: false, edition: null });
    };
    
    const handleDeleteClick = (edition: Edition) => {
        setConfirmDeleteModal({ isOpen: true, edition });
    };

    const handleConfirmDelete = () => {
        if (confirmDeleteModal.edition) {
            deleteEdition(confirmDeleteModal.edition.id);
        }
        setConfirmDeleteModal({ isOpen: false, edition: null });
    };
    
    const handleEditClick = (edition: Edition) => {
        setEditingId(edition.id);
        setEditName(edition.name);
        setEditYear(edition.year);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
    };

    const handleSaveEdit = () => {
        if (editingId && editName.trim() && editYear) {
            updateEdition(editingId, editName, editYear);
            setEditingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Edition Manager</h1>

            <Card>
                <h2 className="text-xl font-bold text-secondary dark:text-accent-green mb-4">Create New Edition</h2>
                <form onSubmit={handleCreateEdition} className="flex flex-wrap items-end gap-4">
                    <div className="flex-grow">
                        <label htmlFor="editionName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Edition Name</label>
                        <input
                            type="text"
                            id="editionName"
                            value={newEditionName}
                            onChange={e => setNewEditionName(e.target.value)}
                            placeholder="e.g., KSEF 2027"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-background-dark dark:border-gray-600"
                        />
                    </div>
                    <div className="flex-grow">
                        <label htmlFor="editionYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
                        <input
                            type="number"
                            id="editionYear"
                            value={newEditionYear}
                            onChange={e => setNewEditionYear(parseInt(e.target.value, 10) || '')}
                            min={new Date().getFullYear()}
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-background-dark dark:border-gray-600"
                        />
                    </div>
                    <Button type="submit" className="flex items-center gap-2">
                        <Plus /> Create
                    </Button>
                </form>
            </Card>

            <Card>
                <h2 className="text-xl font-bold text-secondary dark:text-accent-green mb-4">All Editions</h2>
                <div className="space-y-3">
                    {editions.length > 0 ? (
                        editions.map(edition => (
                            <div key={edition.id} className={`p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                                edition.is_active 
                                ? 'bg-green-50 dark:bg-green-900/30 border border-green-500' 
                                : 'bg-gray-100 dark:bg-gray-800'
                            }`}>
                                {editingId === edition.id ? (
                                    <div className="flex-grow w-full space-y-3">
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-background-dark dark:border-gray-600"
                                        />
                                        <input
                                            type="number"
                                            value={editYear}
                                            onChange={e => setEditYear(parseInt(e.target.value, 10) || '')}
                                            className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:bg-background-dark dark:border-gray-600"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <h3 className={`font-bold text-lg text-text-light dark:text-text-dark ${edition.is_active ? 'text-green-800 dark:text-green-300' : ''}`}>{edition.name}</h3>
                                        <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Year: {edition.year}</p>
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-end">
                                    {editingId === edition.id ? (
                                        <>
                                            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                                            <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                                        </>
                                    ) : (
                                        edition.is_active ? (
                                            <span className="flex items-center gap-2 font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 py-1 px-3 rounded-full">
                                                <CheckCircle className="w-5 h-5" /> Active
                                            </span>
                                        ) : (
                                            <>
                                                <Button size="sm" variant="secondary" onClick={() => handleEditClick(edition)} className="flex items-center gap-1"><Edit size={14}/> Edit</Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(edition)} className="flex items-center gap-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"><Trash2 size={14}/> Delete</Button>
                                                <Button size="sm" onClick={() => handleActivateClick(edition)}>
                                                    Activate
                                                </Button>
                                            </>
                                        )
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-text-muted-light dark:text-text-muted-dark py-8">No editions have been created yet.</p>
                    )}
                </div>
            </Card>
            
            {confirmActivateModal.isOpen && confirmActivateModal.edition && (
                <ConfirmationModal
                    isOpen={confirmActivateModal.isOpen}
                    onClose={() => setConfirmActivateModal({ isOpen: false, edition: null })}
                    onConfirm={handleConfirmActivate}
                    title="Activate Edition"
                    confirmText="Activate"
                    confirmVariant="primary"
                >
                    Are you sure you want to activate the "{confirmActivateModal.edition.name}" edition? This will change the active competition data for all users.
                </ConfirmationModal>
            )}
            
            {confirmDeleteModal.isOpen && confirmDeleteModal.edition && (
                <ConfirmationModal
                    isOpen={confirmDeleteModal.isOpen}
                    onClose={() => setConfirmDeleteModal({ isOpen: false, edition: null })}
                    onConfirm={handleConfirmDelete}
                    title="Delete Edition"
                    confirmText="Delete"
                >
                    Are you sure you want to permanently delete the "{confirmDeleteModal.edition.name}" edition? This action can only be done if no projects or assignments are associated with it and cannot be undone.
                </ConfirmationModal>
            )}
        </div>
    );
};

export default EditionManagerPage;