import React, { useState, useEffect, useMemo, useContext } from 'react';
import { FileUp } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { UserRole } from '../../types';

const ADMIN_ROLES = [
    UserRole.SUPER_ADMIN, UserRole.NATIONAL_ADMIN, UserRole.REGIONAL_ADMIN,
    UserRole.COUNTY_ADMIN, UserRole.SUB_COUNTY_ADMIN
];

const DeadlineCountdownBanner: React.FC = () => {
    const { user, submissionDeadline } = useContext(AppContext);
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });
    const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
    const [isUrgent, setIsUrgent] = useState(false);

    const isRelevantUser = user && (user.currentRole === UserRole.PATRON || ADMIN_ROLES.includes(user.currentRole));

    useEffect(() => {
        if (!submissionDeadline || !isRelevantUser) return;

        const calculateTimeLeft = () => {
            const deadlineDate = new Date(submissionDeadline);
            const now = new Date();
            const difference = deadlineDate.getTime() - now.getTime();

            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                setTimeLeft({ days, hours, minutes });
                setIsDeadlinePassed(false);
                setIsUrgent(days < 2); // Urgent if less than 2 days left
                return true;
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0 });
                setIsDeadlinePassed(true);
                setIsUrgent(false);
                return false;
            }
        };
        
        // Run once on mount to set initial state correctly
        if (!calculateTimeLeft()) {
            return; 
        }

        const interval = setInterval(() => {
            if (!calculateTimeLeft()) {
                clearInterval(interval);
            }
        }, 60000); // Update every minute is enough

        return () => clearInterval(interval);
    }, [submissionDeadline, isRelevantUser]);


    if (!submissionDeadline || !isRelevantUser) {
        return null;
    }

    const formattedTime = useMemo(() => {
        if (timeLeft.days > 0) {
            return `${timeLeft.days}d ${String(timeLeft.hours).padStart(2, '0')}h`;
        }
        return `${String(timeLeft.hours).padStart(2, '0')}h ${String(timeLeft.minutes).padStart(2, '0')}m`;
    }, [timeLeft]);

    const titleText = isDeadlinePassed
        ? `The project submission deadline has passed.`
        : `Deadline for project submissions: ${new Date(submissionDeadline).toLocaleString()}`;

    return (
        <div title={titleText} className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md border transition-colors duration-300 ${
            isDeadlinePassed
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                : isUrgent
                ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
            }`}>
            <FileUp className="w-4 h-4" />
            <span className="font-semibold whitespace-nowrap">{isDeadlinePassed ? 'Deadline Passed' : 'Deadline'}</span>
            {!isDeadlinePassed && (
                <>
                    <div className="w-px h-3 bg-current opacity-30"></div>
                    <span className="font-mono tracking-tighter font-bold">{formattedTime}</span>
                </>
            )}
        </div>
    );
};

export default DeadlineCountdownBanner;
