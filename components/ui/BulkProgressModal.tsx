import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { Loader } from 'lucide-react';

const BulkProgressModal: React.FC = () => {
    const { bulkTaskProgress } = useContext(AppContext);

    if (!bulkTaskProgress) {
        return null;
    }

    const { current, total, task } = bulkTaskProgress;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
        <div
            className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
        >
            <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-2xl w-full max-w-md p-6 text-center">
                <Loader className="w-12 h-12 text-primary mx-auto animate-spin mb-4" />
                <h2 className="text-xl font-bold text-secondary dark:text-accent-green mb-2">{task} in Progress...</h2>
                <p className="text-text-muted-light dark:text-text-muted-dark mb-4">
                    Please wait while the operation completes. Do not close this window.
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div
                        className="bg-primary h-4 rounded-full transition-all duration-300 ease-linear"
                        style={{ width: `${percentage}%` }}
                    ></div>
                </div>
                <p className="mt-2 font-semibold text-lg text-primary">{percentage}%</p>
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                    Processed {current} of {total} items.
                </p>
            </div>
        </div>
    );
};

export default BulkProgressModal;