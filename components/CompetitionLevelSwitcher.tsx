import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { CompetitionLevel } from '../types';
import { CheckCircle, Hourglass, Lock, Radio } from 'lucide-react';

const CompetitionLevelSwitcher: React.FC = () => {
    const { viewingLevel, setViewingLevel, overallHighestLevel, isHistoricalView, isEditionCompleted } = useContext(AppContext);
    const levels = [CompetitionLevel.SUB_COUNTY, CompetitionLevel.COUNTY, CompetitionLevel.REGIONAL, CompetitionLevel.NATIONAL];

    const levelOrder = {
        [CompetitionLevel.SUB_COUNTY]: 0,
        [CompetitionLevel.COUNTY]: 1,
        [CompetitionLevel.REGIONAL]: 2,
        [CompetitionLevel.NATIONAL]: 3,
    };

    const overallIndex = levelOrder[overallHighestLevel];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {levels.map(level => {
                const cardIndex = levelOrder[level];
                let status: 'Completed' | 'Active' | 'Not Started';
                let Icon = Hourglass;
                let colors = 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400';

                if (isHistoricalView) {
                    if (cardIndex <= overallIndex) {
                        status = 'Completed';
                        Icon = CheckCircle;
                        colors = 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300';
                    } else {
                        status = 'Not Started';
                        Icon = Lock;
                        colors = 'bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400';
                    }
                } else {
                    if (cardIndex < overallIndex) {
                        status = 'Completed';
                        Icon = CheckCircle;
                        colors = 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300';
                    } else if (cardIndex === overallIndex) {
                        const isNational = level === CompetitionLevel.NATIONAL;
                        if (isNational && isEditionCompleted) {
                            status = 'Completed';
                            Icon = CheckCircle;
                            colors = 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300';
                        } else {
                            status = 'Active';
                            Icon = Radio;
                            colors = 'bg-primary/10 text-primary';
                        }
                    } else {
                        status = 'Not Started';
                        Icon = Lock;
                        colors = 'bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400';
                    }
                }

                const isActive = viewingLevel === level;
                const highlightActive = isActive; // Always show ring for the selected tile
                const cardClasses = `flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-300 ${colors} ${highlightActive ? 'ring-2 ring-primary dark:ring-accent-green shadow-lg' : 'hover:shadow-md'}`;

                return (
                    <div key={level} onClick={() => setViewingLevel(level)} className={cardClasses} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setViewingLevel(level)}>
                        <Icon className={`w-8 h-8 flex-shrink-0 ${status === 'Active' && !isHistoricalView ? 'animate-pulse' : ''}`} />
                        <div>
                            <p className="font-bold text-lg">{level}</p>
                            <p className="text-sm font-semibold">{status}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default CompetitionLevelSwitcher;
