import React from 'react';

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    className?: string;
    valueClassName?: string;
    onClick?: () => void;
    footer?: string;
    subValue?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, className = '', valueClassName = '', onClick, footer, subValue }) => {
    return (
        <button
            onClick={onClick}
            disabled={!onClick}
            className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 flex flex-col justify-between text-left w-full transition-all duration-200 hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-default disabled:hover:border-gray-200 dark:disabled:hover:border-slate-700 disabled:bg-white dark:disabled:bg-slate-800 ${className}`}
        >
            <div className="flex items-center">
                 <div className="flex-shrink-0 bg-gray-100 dark:bg-slate-700 rounded-full p-3 mr-4">
                    <span className="text-blue-600 dark:text-blue-400">{icon}</span>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                    <p className={`text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white ${valueClassName}`}>{value}</p>
                </div>
            </div>
             {(footer || subValue) && (
                <div className="mt-2 text-right">
                    {subValue && <p className="text-sm font-semibold text-slate-700 dark:text-white">{subValue}</p>}
                    {footer && <p className="text-amber-600 dark:text-amber-400 text-sm">{footer}</p>}
                </div>
            )}
        </button>
    );
};

export default StatCard;