import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { GitBranch, Check } from 'lucide-react';

const EditionSwitcher: React.FC = () => {
    const { editions, activeEdition, viewingEdition, switchViewingEdition, isHistoricalView } = useContext(AppContext);

    if (!editions || editions.length === 0) {
        return (
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-200 dark:bg-gray-700" title="No editions have been created yet.">
                <GitBranch className="w-4 h-4 text-text-muted-light dark:text-text-muted-dark" />
                <span className="text-sm font-semibold text-text-light dark:text-text-dark">No Editions</span>
            </div>
        );
    }
    
    if (!viewingEdition) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700" title="No active competition edition is set.">
               <GitBranch className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
               <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">No Active Edition</span>
           </div>
        );
    }

    const handleSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const editionId = parseInt(e.target.value, 10);
        if (editionId && editionId !== viewingEdition.id) {
            switchViewingEdition(editionId);
        }
    };

    const liveClasses = "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300";
    const historicalClasses = "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300";

    const containerClasses = `relative rounded-md ${isHistoricalView ? historicalClasses : liveClasses}`;
    const selectClasses = "w-full pl-9 pr-4 py-1.5 text-sm font-semibold rounded-md appearance-none bg-transparent border-transparent focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer";
    const iconClasses = `absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isHistoricalView ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`;


    return (
        <div className={containerClasses}>
            <GitBranch className={iconClasses} />
            <select
                value={viewingEdition.id}
                onChange={handleSwitch}
                className={selectClasses}
                aria-label="Switch competition edition view"
            >
                {editions.map(edition => (
                    <option key={edition.id} value={edition.id} className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
                        {edition.name} {edition.id === activeEdition?.id ? '(Live)' : ''}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default EditionSwitcher;