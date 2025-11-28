import React, { ReactNode } from 'react';
import Card from './ui/Card';

interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    value: ReactNode; // Changed from string
    icon: ReactNode;
    change?: string;
    changeType?: 'increase' | 'decrease';
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, icon, change, changeType, className, ...props }) => {
    const changeColor = changeType === 'increase' ? 'text-green-500' : 'text-red-500';

    return (
        <Card className={`flex flex-col justify-between ${className}`} {...props}>
            <div className="flex justify-between items-start">
                <span className="text-text-muted-light dark:text-text-muted-dark">{title}</span>
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    {icon}
                </div>
            </div>
            <div>
                {typeof value === 'string' ? (
                    <h2 className="text-3xl font-bold text-text-light dark:text-text-dark mt-2">{value}</h2>
                ) : (
                    <div className="mt-2">{value}</div>
                )}
                {change && (
                    <p className={`text-sm ${changeColor} mt-1`}>
                        {change}
                    </p>
                )}
            </div>
        </Card>
    );
};

export default DashboardCard;