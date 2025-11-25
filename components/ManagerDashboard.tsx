

import React, { useState, useMemo, useEffect } from 'react';
import { Sale, VehicleType, Consultant, WorkSchedule } from '../types';
import { ManagerGoals } from '../services/localStorageService';
import StatCard from './StatCard';
import SalesForm from './SalesForm';
import SalesTable from './SalesTable';
import Modal from './Modal';
import { CarIcon, DollarIcon, EditIcon, PaceIcon, PercentIcon, SearchIcon, TagIcon, TradeIcon, TrashIcon, UsersIcon } from './icons';

interface ManagerDashboardProps {
    allSales: Sale[];
    pendingSales: Sale[];
    onSaleAdded: (sale: Omit<Sale, 'id' | 'cumulativeGross'>) => void;
    onSaleUpdated: (sale: Sale) => void;
    onSaleDeleted: (id: number) => void;
    onSaleDelivered: (id: number) => void;
    consultants: Consultant[];
    onAddConsultant: (name: string, store: string) => void;
    onDeleteConsultant: (name: string) => void;
    onUpdateConsultant: (oldName: string, updatedConsultant: Consultant) => void;
    goals: ManagerGoals;
    setGoals: (goals: ManagerGoals) => void;
    storeSchedules: Record<string, WorkSchedule>;
}

interface LeaderboardEntry {
    name: string;
    new: number;
    used: number;
    count: number;
    gross: number;
    commission: number;
    pvr: number;
    pendingCount: number;
}

const getPaceColor = (pace: number, goal: number): string => {
    if (goal <= 0) return 'text-slate-700 dark:text-slate-300';
    const ratio = pace / goal;
    if (ratio >= 1) return 'text-green-500 dark:text-green-400 font-semibold';
    if (ratio >= 0.9) return 'text-yellow-500 dark:text-yellow-400 font-semibold';
    return 'text-red-500 dark:text-red-400 font-semibold';
};


const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ allSales, pendingSales: allPendingSales, onSaleAdded, onSaleUpdated, onSaleDeleted, onSaleDelivered, consultants, onAddConsultant, onDeleteConsultant, onUpdateConsultant, goals, setGoals, storeSchedules }) => {
    const [selectedStores, setSelectedStores] = useState<string[]>([]);
    const [vehicleTypeFilter, setVehicleTypeFilter] = useState<'All' | 'New' | 'Used'>('All');
    const [dateView, setDateView] = useState('YTD');
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Sale | 'pvr'; direction: 'ascending' | 'descending' }>({ key: 'count', direction: 'descending' });

    const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
    const [editingSaleData, setEditingSaleData] = useState<Sale | null>(null);
    
    const [newConsultantName, setNewConsultantName] = useState('');
    const [newConsultantStore, setNewConsultantStore] = useState('');

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingConsultant, setEditingConsultant] = useState<Consultant | null>(null);
    const [tempConsultantData, setTempConsultantData] = useState<{ name: string; store: string } | null>(null);

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailModalTitle, setDetailModalTitle] = useState('');
    const [detailModalContent, setDetailModalContent] = useState<React.ReactNode>(null);
    
    const months = useMemo(() => [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ], []);
    const dateViews = useMemo(() => [...months.map(m => m.substring(0,3)), 'YTD'], [months]);
    const currentMonthView = useMemo(() => months[new Date().getMonth()].substring(0, 3), [months]);


    const availableStores = useMemo(() => [...new Set(consultants.map(c => c.store))].sort(), [consultants]);

    const filteredSales = useMemo(() => {
        const currentYear = new Date().getFullYear();
        
        return allSales.filter(sale => {
            const saleDate = new Date(sale.date);
            if (dateView === 'YTD') {
                if (saleDate.getFullYear() !== currentYear) return false;
            } else {
                const monthIndex = months.findIndex(m => m.startsWith(dateView));
                if (monthIndex === -1 || saleDate.getMonth() !== monthIndex || saleDate.getFullYear() !== currentYear) {
                    return false;
                }
            }
            if (selectedStores.length > 0 && !selectedStores.includes(sale.store)) return false;
            if (vehicleTypeFilter !== 'All' && sale.newOrUsed !== vehicleTypeFilter) return false;
            return true;
        });
    }, [allSales, selectedStores, vehicleTypeFilter, dateView, months]);
    
    const deliveredSales = useMemo(() => filteredSales.filter(s => s.status === 'delivered'), [filteredSales]);
    const pendingSales = useMemo(() => filteredSales.filter(s => s.status === 'pending'), [filteredSales]);

    const paceData = useMemo(() => {
        const getPassedWorkingDays = (store: string, month: number, year: number): number => {
            const today = new Date();
            const schedule = storeSchedules[store] || {};

            if (today.getMonth() !== month || today.getFullYear() !== year) {
                if (new Date(year, month, 1) > today) return 0; // Future
                return goals[store]?.workingDays || new Date(year, month + 1, 0).getDate(); // Past
            }
            
            let passedWorkDays = 0;
            for (let day = 1; day <= today.getDate(); day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                if (schedule[dateStr] !== false) {
                    passedWorkDays++;
                }
            }
            return passedWorkDays;
        };
        
        const today = new Date();
        const currentYear = today.getFullYear();
        const monthIndex = months.findIndex(m => m.startsWith(dateView));

        if (monthIndex === -1) { // This happens for YTD view
            return { storePaces: [], totals: { newGoal: 0, newActual: 0, usedGoal: 0, usedActual: 0, totalGoal: 0, totalActual: 0 } };
        }
        
        const salesForMonth = allSales.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate.getMonth() === monthIndex && saleDate.getFullYear() === currentYear;
        });

        const monthDelivered = salesForMonth.filter(s => s.status === 'delivered');
        const monthPending = salesForMonth.filter(s => s.status === 'pending');

        const storePaces = availableStores.map(store => {
            const storeDelivered = monthDelivered.filter(s => s.store === store);
            const storePending = monthPending.filter(s => s.store === store);
            const storeGoals = goals[store] || { newGoal: 0, usedGoal: 0, workingDays: 0 };
            const passedWorkDays = getPassedWorkingDays(store, monthIndex, currentYear);
            
            const paceMultiplier = passedWorkDays > 0 && storeGoals.workingDays > 0 ? storeGoals.workingDays / passedWorkDays : 0;

            const newActual = storeDelivered.filter(s => s.newOrUsed === VehicleType.NEW).reduce((sum, s) => sum + s.count, 0);
            const usedActual = storeDelivered.filter(s => s.newOrUsed === VehicleType.USED).reduce((sum, s) => sum + s.count, 0);
            
            const newPending = storePending.filter(s => s.newOrUsed === VehicleType.NEW).reduce((sum, s) => sum + s.count, 0);
            const usedPending = storePending.filter(s => s.newOrUsed === VehicleType.USED).reduce((sum, s) => sum + s.count, 0);

            return {
                store,
                ...storeGoals,
                newActual,
                newPace: newActual * paceMultiplier,
                newPaceWithPending: (newActual + newPending) * paceMultiplier,
                usedActual,
                usedPace: usedActual * paceMultiplier,
                usedPaceWithPending: (usedActual + usedPending) * paceMultiplier,
                totalGoal: storeGoals.newGoal + storeGoals.usedGoal,
                totalActual: newActual + usedActual,
                totalPace: (newActual + usedActual) * paceMultiplier,
                totalPaceWithPending: (newActual + usedActual + newPending + usedPending) * paceMultiplier,
            };
        });

        const totals = storePaces.reduce((acc, curr) => {
            acc.newGoal += curr.newGoal;
            acc.newActual += curr.newActual;
            acc.usedGoal += curr.usedGoal;
            acc.usedActual += curr.usedActual;
            acc.totalGoal += curr.totalGoal;
            acc.totalActual += curr.totalActual;
            return acc;
        }, { newGoal: 0, newActual: 0, usedGoal: 0, usedActual: 0, totalGoal: 0, totalActual: 0 });
        
        return { storePaces, totals };
    }, [allSales, goals, availableStores, storeSchedules, dateView, months]);

    const dailyGoalsData = useMemo(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const selectedMonthIndex = months.findIndex(m => m.startsWith(dateView));

        if (selectedMonthIndex !== today.getMonth() || currentYear !== today.getFullYear()) {
            return { sellingDaysLeft: 0, newUnitsPerDay: 0, usedUnitsPerDay: 0 };
        }

        let maxSellingDaysLeft = 0;

        for(const store in storeSchedules) {
            const schedule = storeSchedules[store];
            let remainingWorkDays = 0;
            const totalDaysInMonth = new Date(currentYear, selectedMonthIndex + 1, 0).getDate();
            for (let day = today.getDate() + 1; day <= totalDaysInMonth; day++) {
                const dateStr = `${currentYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                if (schedule[dateStr] !== false) remainingWorkDays++;
            }
            if (remainingWorkDays > maxSellingDaysLeft) {
                maxSellingDaysLeft = remainingWorkDays;
            }
        }
        
        const newUnitsToGoal = Math.max(0, paceData.totals.newGoal - paceData.totals.newActual);
        const usedUnitsToGoal = Math.max(0, paceData.totals.usedGoal - paceData.totals.usedActual);
        
        const newUnitsPerDay = maxSellingDaysLeft > 0 ? newUnitsToGoal / maxSellingDaysLeft : 0;
        const usedUnitsPerDay = maxSellingDaysLeft > 0 ? usedUnitsToGoal / maxSellingDaysLeft : 0;

        return {
            sellingDaysLeft: maxSellingDaysLeft,
            newUnitsPerDay,
            usedUnitsPerDay,
        };
    }, [goals, paceData.totals, storeSchedules, dateView, months]);

    const stats = useMemo(() => {
        const data = deliveredSales;
        const totalSales = data.reduce((sum, s) => sum + s.count, 0);
        const totalGross = data.reduce((sum, s) => sum + s.frontGross + s.backGross, 0);
        const totalFrontGross = data.reduce((sum, s) => sum + s.frontGross, 0);
        const totalBackGross = data.reduce((sum, s) => sum + s.backGross, 0);
        const totalCommission = data.reduce((sum, s) => sum + s.commission, 0);
        const newVehicles = data.filter(s => s.newOrUsed === VehicleType.NEW).reduce((sum, s) => sum + s.count, 0);
        const usedVehicles = data.filter(s => s.newOrUsed === VehicleType.USED).reduce((sum, s) => sum + s.count, 0);
        const totalTrades = data.filter(s => s.trade).length;
        const tradePercentage = totalSales > 0 ? (totalTrades / data.length) * 100 : 0;
        return { 
            totalSales, totalGross, totalFrontGross, totalBackGross, totalCommission, newVehicles, usedVehicles, 
            totalTrades, tradePercentage,
            avgPVR: totalSales > 0 ? totalGross / totalSales : 0,
            avgFrontGross: totalSales > 0 ? totalFrontGross / totalSales : 0,
            avgBackGross: totalSales > 0 ? totalBackGross / totalSales : 0,
        };
    }, [deliveredSales]);
    
    const todaySales = useMemo(() => {
         const todayStr = new Date().toISOString().split('T')[0];
        return allSales.filter(s => s.date === todayStr && s.status === 'delivered');
    }, [allSales]);

    const todayStats = useMemo(() => {
        const data = todaySales;
        const totalSales = data.reduce((sum, s) => sum + s.count, 0);
        const totalGross = data.reduce((sum, s) => sum + s.frontGross + s.backGross, 0);
        const newVehicles = data.filter(s => s.newOrUsed === VehicleType.NEW).reduce((sum, s) => sum + s.count, 0);
        const usedVehicles = data.filter(s => s.newOrUsed === VehicleType.USED).reduce((sum, s) => sum + s.count, 0);
        return { totalSales, totalGross, newVehicles, usedVehicles };
    }, [todaySales]);

    const leaderboardData = useMemo(() => {
        const salesByPerson = deliveredSales.reduce((acc, sale) => {
            const person = sale.salesperson;
            if (!acc[person]) {
                acc[person] = { name: person, new: 0, used: 0, count: 0, gross: 0, commission: 0 };
            }
            acc[person].count += sale.count;
            acc[person].gross += sale.frontGross + sale.backGross;
            acc[person].commission += sale.commission;
            if (sale.newOrUsed === VehicleType.NEW) acc[person].new += sale.count;
            else acc[person].used += sale.count;
            return acc;
        }, {} as Record<string, Omit<LeaderboardEntry, 'pvr' | 'pendingCount'>>);

        const pendingByPerson = allPendingSales.reduce((acc, sale) => {
            const person = sale.salesperson;
            if (!acc[person]) acc[person] = { count: 0 };
            acc[person].count += sale.count;
            return acc;
        }, {} as Record<string, {count: number}>);

        const data: LeaderboardEntry[] = Object.values(salesByPerson).map((p: any) => ({ 
            ...p, 
            pvr: p.count > 0 ? p.gross / p.count : 0,
            pendingCount: pendingByPerson[p.name]?.count || 0
        }));
        
        data.sort((a, b) => {
            const key = sortConfig.key as keyof LeaderboardEntry;
            if (!key) return 0;
            const aVal = a[key];
            const bVal = b[key];
            if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });

        return data;
    }, [deliveredSales, allPendingSales, sortConfig]);
    
    const handleStoreToggle = (store: string) => {
        setSelectedStores(prev => prev.includes(store) ? prev.filter(s => s !== store) : [...prev, store]);
    };
    
    const handleGoalChange = (store: string, type: 'newGoal' | 'usedGoal' | 'workingDays', value: string) => {
        const numValue = value === '' ? 0 : parseInt(value, 10);
        setGoals({
            ...goals,
            [store]: { ...(goals[store] || { newGoal: 0, usedGoal: 0, workingDays: 0 }), [type]: numValue }
        });
    };
    
    const handleAddConsultantClick = () => {
        onAddConsultant(newConsultantName.trim(), newConsultantStore.trim());
        setNewConsultantName('');
        setNewConsultantStore('');
    }

    const handleSort = (key: keyof Sale | 'pvr') => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending' }));
    };

    const handleEditClick = (sale: Sale) => { setEditingSaleId(sale.id); setEditingSaleData({ ...sale }); };
    const handleCancelEdit = () => { setEditingSaleId(null); setEditingSaleData(null); };
    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!editingSaleData) return;
        const { name, value, type } = e.target;
        let pValue: string|number|boolean = value;
        if (type === 'checkbox') pValue = (e.target as HTMLInputElement).checked;
        else if (type === 'number' || name === 'count') pValue = value === '' ? 0 : parseFloat(value);
        setEditingSaleData({ ...editingSaleData, [name]: pValue });
    };

    const handleOpenEditModal = (consultant: Consultant) => {
        setEditingConsultant(consultant);
        setTempConsultantData({ ...consultant });
        setIsEditModalOpen(true);
    };
    
    const handleSaveChanges = () => {
        if (editingConsultant && tempConsultantData) {
            onUpdateConsultant(editingConsultant.name, tempConsultantData);
            setIsEditModalOpen(false);
            setEditingConsultant(null);
            setTempConsultantData(null);
        }
    };
    
    const handleSubmitSale = (sale: Omit<Sale, 'id' | 'cumulativeGross'>) => {
        onSaleAdded(sale);
        setIsFormVisible(false);
    };

    const handleStatClick = (title: string, data: Sale[]) => {
        setDetailModalTitle(`${title} Details`);
        
        const content = (
             <div className="overflow-auto max-h-96">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-700 dark:text-white uppercase bg-gray-100 dark:bg-slate-700/50">
                        <tr>
                            <th className="px-4 py-2">Salesperson</th>
                            <th className="px-4 py-2">Vehicle</th>
                            <th className="px-4 py-2">Gross</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                        {data.map((sale) => (
                            <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-2">{sale.salesperson}</td>
                                <td className="px-4 py-2">{`${sale.year} ${sale.make} ${sale.model}`}</td>
                                <td className="px-4 py-2">${(sale.frontGross + sale.backGross).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );

        setDetailModalContent(data.length > 0 ? content : <p>No sales data for this category.</p>);
        setIsDetailModalOpen(true);
    };

    const displayDateView = dateView === 'YTD' ? 'Year-to-Date' : months.find(m => m.startsWith(dateView));


    return (
        <div className="space-y-8">
            <section className="bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700 space-y-4 no-print">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Filters</h3>
                <div className="flex flex-wrap gap-4 items-center">
                    <div>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 mr-2">Stores:</span>
                        {availableStores.map(store => (
                            <button key={store} onClick={() => handleStoreToggle(store)} className={`px-3 py-1 text-sm rounded-full mr-2 transition-colors ${selectedStores.includes(store) ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600'}`}>{store}</button>
                        ))}
                        <button onClick={() => setSelectedStores([])} className="px-3 py-1 text-sm rounded-full bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600">All</button>
                    </div>
                     <div>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 mr-2">Vehicle Type:</span>
                        {(['All', 'New', 'Used'] as const).map(type => (
                            <button key={type} onClick={() => setVehicleTypeFilter(type)} className={`px-3 py-1 text-sm rounded-full mr-2 transition-colors ${vehicleTypeFilter === type ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600'}`}>{type}</button>
                        ))}
                    </div>
                     <div className="overflow-x-auto whitespace-nowrap py-2">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 mr-2">Date:</span>
                        {dateViews.map(view => (
                            <button key={view} onClick={() => setDateView(view)} className={`px-3 py-1 text-sm rounded-full mr-2 transition-colors ${dateView === view ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600'}`}>{view}</button>
                        ))}
                    </div>
                </div>
            </section>
            
            {dateView !== 'YTD' && availableStores.length > 0 && (
                <section className="bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">Monthly Goals & Pace for {months.find(m => m.startsWith(dateView))}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 -mt-2">Pace format: Delivered Pace / <span className="text-amber-500 dark:text-amber-400">Pace including Pending Deals</span></p>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px] text-sm text-center">
                            <thead className="text-xs text-slate-700 dark:text-white uppercase bg-gray-100 dark:bg-slate-700/50">
                                <tr>
                                    <th className="px-2 py-3 text-left w-1/4">Store</th>
                                    <th className="px-2 py-3">Work Days</th>
                                    <th className="px-2 py-3">New Goal</th>
                                    <th className="px-2 py-3">New Actual</th>
                                    <th className="px-2 py-3">New Pace</th>
                                    <th className="px-2 py-3">Used Goal</th>
                                    <th className="px-2 py-3">Used Actual</th>
                                    <th className="px-2 py-3">Used Pace</th>
                                    <th className="px-2 py-3">Total Goal</th>
                                    <th className="px-2 py-3">Total Actual</th>
                                    <th className="px-2 py-3">Total Pace</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paceData.storePaces.map(data => (
                                    <tr key={data.store} className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">
                                        <td className="px-2 py-2 text-left font-medium text-slate-900 dark:text-white">{data.store}</td>
                                        <td><input type="number" value={data.workingDays || ''} onChange={e => handleGoalChange(data.store, 'workingDays', e.target.value)} className="w-20 rounded-md border-0 py-1 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500 text-center" placeholder="e.g. 26" /></td>
                                        <td><input type="number" value={data.newGoal || ''} onChange={e => handleGoalChange(data.store, 'newGoal', e.target.value)} className="w-20 rounded-md border-0 py-1 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500 text-center" placeholder="0" /></td>
                                        <td className="font-bold text-lg text-green-600 dark:text-green-400">{data.newActual}</td>
                                        <td className={`${getPaceColor(data.newPaceWithPending, data.newGoal)} text-lg`}>{data.newPace.toFixed(1)} / <span className="text-amber-500 dark:text-amber-400 font-semibold">{data.newPaceWithPending.toFixed(1)}</span></td>
                                        <td><input type="number" value={data.usedGoal || ''} onChange={e => handleGoalChange(data.store, 'usedGoal', e.target.value)} className="w-20 rounded-md border-0 py-1 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500 text-center" placeholder="0" /></td>
                                        <td className="font-bold text-lg text-orange-600 dark:text-orange-400">{data.usedActual}</td>
                                        <td className={`${getPaceColor(data.usedPaceWithPending, data.usedGoal)} text-lg`}>{data.usedPace.toFixed(1)} / <span className="text-amber-500 dark:text-amber-400 font-semibold">{data.usedPaceWithPending.toFixed(1)}</span></td>
                                        <td className="font-semibold text-lg text-slate-700 dark:text-slate-300">{data.totalGoal}</td>
                                        <td className="font-bold text-lg text-blue-600 dark:text-blue-400">{data.totalActual}</td>
                                        <td className={`${getPaceColor(data.totalPaceWithPending, data.totalGoal)} font-bold text-lg`}>{data.totalPace.toFixed(1)} / <span className="text-amber-500 dark:text-amber-400 font-bold">{data.totalPaceWithPending.toFixed(1)}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
            
            <section className="bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                 <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">Daily Sales Snapshot (Today)</h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <StatCard title="Total Units" value={todayStats.totalSales.toString()} icon={<CarIcon />} onClick={() => handleStatClick("Today's Total Units", todaySales)} />
                     <StatCard title="New Units" value={todayStats.newVehicles.toString()} icon={<CarIcon />} onClick={() => handleStatClick("Today's New Units", todaySales.filter(s => s.newOrUsed === VehicleType.NEW))} />
                     <StatCard title="Used Units" value={todayStats.usedVehicles.toString()} icon={<CarIcon />} onClick={() => handleStatClick("Today's Used Units", todaySales.filter(s => s.newOrUsed === VehicleType.USED))} />
                     <StatCard title="Total Gross" value={`$${todayStats.totalGross.toLocaleString()}`} icon={<DollarIcon />} onClick={() => handleStatClick("Today's Total Gross", todaySales)} />
                </div>
            </section>
            
            {dateView === currentMonthView && (
                 <section className="bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                    <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-4 text-center">
                        <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300">Daily Units Required to Meet Goal for {months.find(m => m.startsWith(dateView))}</h4>
                        <p className="text-slate-600 dark:text-slate-400 mt-2">
                            For the remaining <strong className="text-slate-900 dark:text-white text-lg">{dailyGoalsData.sellingDaysLeft}</strong> working days, the team needs to average:
                        </p>
                        <div className="flex justify-center gap-8 mt-3">
                            <div>
                                <span className="text-2xl font-bold text-green-600 dark:text-green-400">{dailyGoalsData.newUnitsPerDay.toFixed(1)}</span>
                                <span className="block text-sm text-slate-600 dark:text-slate-400">New Units / Day</span>
                            </div>
                            <div>
                                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{dailyGoalsData.usedUnitsPerDay.toFixed(1)}</span>
                                <span className="block text-sm text-slate-600 dark:text-slate-400">Used Units / Day</span>
                            </div>
                        </div>
                    </div>
                </section>
            )}
            
            <section className="bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">Overall Performance ({displayDateView})</h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                     <StatCard title="Total Units" value={`${stats.totalSales} (+${pendingSales.length} Pending)`} icon={<CarIcon />} onClick={() => handleStatClick(`${displayDateView} Total Units`, deliveredSales)} />
                     <StatCard title="Total Gross" value={`$${stats.totalGross.toLocaleString()}`} icon={<DollarIcon />} onClick={() => handleStatClick(`${displayDateView} Total Gross`, deliveredSales)} />
                     <StatCard title="Total Back Gross" value={`$${stats.totalBackGross.toLocaleString()}`} icon={<DollarIcon />} onClick={() => handleStatClick(`${displayDateView} Back Gross`, deliveredSales.filter(s => s.backGross > 0))} />
                     <StatCard title="Front PVR" value={`$${stats.avgFrontGross.toFixed(2)}`} icon={<TagIcon />} onClick={() => handleStatClick(`${displayDateView} Front PVR`, deliveredSales)} />
                     <StatCard title="Back PVR" value={`$${stats.avgBackGross.toFixed(2)}`} icon={<TagIcon />} onClick={() => handleStatClick(`${displayDateView} Back PVR`, deliveredSales)} />
                     <StatCard title="Trade %" value={`${stats.tradePercentage.toFixed(1)}%`} icon={<PercentIcon />} onClick={() => handleStatClick(`${displayDateView} Trades`, deliveredSales.filter(s => s.trade))} />
                </div>
            </section>

            <section className="bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">Sales Consultant Leaderboard</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-700 dark:text-white uppercase bg-gray-100 dark:bg-slate-700/50">
                            <tr>
                                {[{l:'Rank'},{l:'Name',k:'name'},{l:'Total Units',k:'count'},{l:'New',k:'new'},{l:'Used',k:'used'},{l:'Total Gross',k:'gross'},{l:'Avg PVR',k:'pvr'},{l:'Commission',k:'commission'}].map(h => (
                                    <th key={h.l} scope="col" className="px-4 py-3">
                                        {h.k ? <button onClick={() => handleSort(h.k as any)} className="flex items-center gap-1">{h.l} {sortConfig.key === h.k && (sortConfig.direction === 'ascending' ? '▲' : '▼')}</button> : h.l}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {leaderboardData.map((p, i) => (
                                <tr key={p.name} className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">#{i + 1}</td>
                                    <td className="px-4 py-3 font-medium text-blue-600 dark:text-blue-400">{p.name}</td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">{p.count} {p.pendingCount > 0 && <span className="text-amber-500 dark:text-amber-400 ml-1">(+{p.pendingCount})</span>}</td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.new}</td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.used}</td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">${p.gross.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">${p.pvr.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">${p.commission.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="flex justify-between items-center mb-4 gap-4 no-print">
                <div className="relative w-full sm:w-64">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 dark:text-slate-400"><SearchIcon /></span>
                    <input type="text" placeholder="Search sales..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full rounded-md py-1.5 pl-10 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white ring-1 ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"/>
                </div>
                <button onClick={() => setIsFormVisible(!isFormVisible)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg">{isFormVisible ? 'Close Form' : '+ Add Sale'}</button>
            </div>
            
            {isFormVisible && <SalesForm onSubmit={handleSubmitSale} role="manager" consultants={consultants} className="no-print"/>}
            
            {pendingSales.length > 0 && (
                <section className="bg-gray-50 dark:bg-slate-800/50 p-6 rounded-xl border-2 border-amber-500/30 dark:border-amber-400/50">
                    <h2 className="text-xl font-semibold text-amber-600 dark:text-amber-300 mb-4">Pending Deals ({pendingSales.length})</h2>
                    <SalesTable sales={pendingSales} onSort={handleSort as any} sortConfig={sortConfig as any} editingSaleId={editingSaleId} editingSaleData={editingSaleData} onEditClick={handleEditClick} onCancelEdit={handleCancelEdit} onUpdateSale={onSaleUpdated} onEditChange={handleEditChange} onDelete={onSaleDeleted} onDeliver={onSaleDelivered} role="manager" />
                </section>
            )}

            <section className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Delivered Sales Log</h2>
                <SalesTable sales={deliveredSales} onSort={handleSort as any} sortConfig={sortConfig as any} editingSaleId={editingSaleId} editingSaleData={editingSaleData} onEditClick={handleEditClick} onCancelEdit={handleCancelEdit} onUpdateSale={onSaleUpdated} onEditChange={handleEditChange} onDelete={onSaleDeleted} role="manager" />
            </section>
            
            <section className="bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700 mt-8">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2"><UsersIcon /> Team Management</h3>
                <div className="mb-4">
                    <h4 className="font-semibold text-slate-600 dark:text-slate-400 mb-2">Sales Consultants</h4>
                    {consultants.length > 0 ? (
                        <ul className="space-y-2">
                            {consultants.map(c => (
                                <li key={c.name} className="flex items-center justify-between bg-gray-100 dark:bg-slate-700/50 p-2 rounded-md">
                                    <span className="text-slate-900 dark:text-white">{c.name} <span className="text-xs text-slate-500 dark:text-slate-400">({c.store})</span></span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleOpenEditModal(c)} className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 p-1"><EditIcon /></button>
                                        <button onClick={() => onDeleteConsultant(c.name)} className="text-red-600 dark:text-red-500 hover:text-red-500 dark:hover:text-red-400 p-1"><TrashIcon /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-slate-500 text-sm">No consultants added yet. Add one below.</p>
                    )}
                </div>
                <div>
                     <h4 className="font-semibold text-slate-600 dark:text-slate-400 mb-2">Add New Consultant</h4>
                     <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                            type="text" 
                            value={newConsultantName}
                            onChange={(e) => setNewConsultantName(e.target.value)}
                            placeholder="Consultant's full name"
                            className="flex-grow rounded-md border-0 py-1.5 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"
                        />
                         <input 
                            type="text" 
                            value={newConsultantStore}
                            onChange={(e) => setNewConsultantStore(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddConsultantClick()}
                            placeholder="Store location (e.g. Acura)"
                            className="flex-grow rounded-md border-0 py-1.5 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"
                        />
                        <button onClick={handleAddConsultantClick} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-lg">Add</button>
                     </div>
                </div>
            </section>
            
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Consultant">
                {tempConsultantData && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Name</label>
                            <input
                                type="text"
                                value={tempConsultantData.name}
                                onChange={(e) => setTempConsultantData({ ...tempConsultantData, name: e.target.value })}
                                className="block w-full rounded-md border-0 py-1.5 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                         <div>
                            <label className="text-sm text-slate-500 dark:text-slate-400 block mb-1">Store</label>
                            <input
                                type="text"
                                value={tempConsultantData.store}
                                onChange={(e) => setTempConsultantData({ ...tempConsultantData, store: e.target.value })}
                                className="block w-full rounded-md border-0 py-1.5 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex justify-end pt-4 gap-2">
                            <button onClick={() => setIsEditModalOpen(false)} className="bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                            <button onClick={handleSaveChanges} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Save Changes</button>
                        </div>
                    </div>
                )}
            </Modal>
             <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={detailModalTitle}>
                {detailModalContent}
            </Modal>

        </div>
    );
};

export default ManagerDashboard;