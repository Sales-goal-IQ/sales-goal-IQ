import React from 'react';

interface TabsProps {
    tabs: string[];
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange }) => {
    return (
        <div className="border-b border-slate-700">
            <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Tabs">
                {tabs.map((tab) => {
                    const isYTD = tab === 'YTD';
                    const isActive = tab === activeTab;
                    return (
                        <button
                            key={tab}
                            onClick={() => onTabChange(tab)}
                            className={`
                                ${isActive
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
                                }
                                ${isYTD ? 'font-bold' : ''}
                                whitespace-nowrap py-3 px-3 border-b-2 font-medium text-sm transition-colors
                            `}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            {tab}
                        </button>
                    )
                })}
            </nav>
        </div>
    );
};

export default Tabs;