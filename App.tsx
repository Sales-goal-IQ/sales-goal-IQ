
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Sale, VehicleType, Consultant, Goals, SalesStats, OtherIncome, WorkSchedule, ManagerGoals } from './types';
import SalesForm, { OtherIncomeForm } from './components/SalesForm';
import SalesTable, { OtherIncomeTable } from './components/SalesTable';
import StatCard from './components/StatCard';
import SalesChart from './components/SalesChart';
import ManagerDashboard from './components/ManagerDashboard';
import PayPlanCalculator from './components/PayPlanCalculator';
import IncomeCalculator from './components/IncomeCalculator';
import { CarIcon, ChartIcon, DollarIcon, SearchIcon, SparklesIcon, TagIcon, TradeIcon, UploadIcon, DownloadIcon, PercentIcon, UsersIcon, PrintIcon, SettingsIcon, ChevronDownIcon, ShareIcon, FileIcon, DatabaseIcon } from './components/icons';
import Tabs from './components/Tabs';
import Modal from './components/Modal';
// Replace local storage service with cloud Firestore-backed service
import * as dbService from './services/firebaseService';
import * as localStorageService from './services/localStorageService'; // Keep for Theme only
import { auth } from './services/firebaseClient';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, User } from 'firebase/auth';
import type { UserProfile } from './services/firebaseService';


const processSalesData = (data: (Omit<Sale, 'id' | 'cumulativeGross'> | Partial<Sale>)[]): Sale[] => {
    let cumulativeGross = 0;
    
    const allSales = data.map((sale, index) => ({
        ...sale,
        id: (sale as Sale).id || Date.now() + index,
        stockNumber: (sale as Sale).stockNumber || '',
        status: (sale as Sale).status || 'delivered',
        count: (sale as Sale).count || 1,
        salesperson: (sale as Sale).salesperson || 'Unassigned',
    })) as Sale[];

    const deliveredSales = allSales.filter(s => s.status === 'delivered').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const pendingSales = allSales.filter(s => s.status === 'pending');

    const processedDelivered = deliveredSales.map(sale => {
        cumulativeGross += sale.frontGross + sale.backGross;
        return { ...sale, cumulativeGross };
    });

    return [...processedDelivered, ...pendingSales];
};

const parseCSVRobust = (csvText: string): Record<string, string>[] => {
    const lines = csvText.trim().replace(/\r/g, '').split('\n');
    const headerLine = lines.shift();
    if (!headerLine) return [];

    const headers = headerLine.split(',').map(h => h.trim());
    
    return lines.map(line => {
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const row: Record<string, string> = {};
        headers.forEach((header, i) => {
            let value = values[i] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            row[header] = value.replace(/""/g, '"');
        });
        return row;
    });
};

const App: React.FC = () => {
    
    // Firebase Auth state
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

// Initialize with empty arrays for async loading
    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [otherIncomes, setOtherIncomes] = useState<OtherIncome[]>([]);

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [role, setRole] = useState<'consultant' | 'manager'>(() => localStorageService.loadRole());
    
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [activeConsultantName, setActiveConsultantName] = useState<string>(() => localStorageService.loadActiveConsultantName());
    
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isOtherIncomeFormVisible, setIsOtherIncomeFormVisible] = useState(false);
    const [currentView, setCurrentView] = useState('YTD');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Sale; direction: 'ascending' | 'descending' }>({ key: 'date', direction: 'descending' });

    const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
    const [editingSaleData, setEditingSaleData] = useState<Sale | null>(null);

    const [editingOtherIncomeId, setEditingOtherIncomeId] = useState<number | null>(null);
    
    const jsonFileInputRef = useRef<HTMLInputElement>(null);
    const csvFileInputRef = useRef<HTMLInputElement>(null);
    
    const [goals, setGoals] = useState<Goals>({ unitGoal: 0, commissionGoal: 0, workingDays: 0 });
    const [schedule, setSchedule] = useState<WorkSchedule>({});
    
    const [managerGoals, setManagerGoals] = useState<ManagerGoals>({});
    const [storeSchedules, setStoreSchedules] = useState<Record<string, WorkSchedule>>({});

    const [isConsultantModalOpen, setIsConsultantModalOpen] = useState(false);
    const [tempConsultantName, setTempConsultantName] = useState('');
    const [tempConsultantStore, setTempConsultantStore] = useState('');


    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalContent, setModalContent] = useState<React.ReactNode>(null);
    const [isDataActionsModalOpen, setIsDataActionsModalOpen] = useState(false);

    const [isManagerAuthenticated, setIsManagerAuthenticated] = useState(false);
    const [isManagerLoginOpen, setIsManagerLoginOpen] = useState(false);
    const [managerPasswordInput, setManagerPasswordInput] = useState('');
    const [managerPasswordError, setManagerPasswordError] = useState('');
    const [managerPassword, setManagerPassword] = useState<string | null>(null);

    const [appView, setAppView] = useState<'dashboard' | 'settings'>('dashboard');
    const [theme, setTheme] = useState<'light' | 'dark'>(localStorageService.loadTheme);
    
    const [isDragging, setIsDragging] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [csvImportPreview, setCsvImportPreview] = useState<Partial<Sale>[]>([]);

    
    // Watch Firebase Auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setAuthUser(user);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Load user profile (role, name, store) once we have an auth user
    useEffect(() => {
        const loadProfile = async () => {
            if (!authUser) {
                setUserProfile(null);
                return;
            }
            setProfileLoading(true);
            try {
                const profile = await dbService.loadUserProfile(authUser.uid);
                if (profile) {
                    setUserProfile(profile);
                    // Set app role based on profile
                    if (profile.role === 'manager') {
                        setRole('manager');
                    } else {
                        setRole('consultant');
                    }
                    // For consultants, default active consultant name to their profile name
                    if (profile.role === 'consultant' && profile.name) {
                        setActiveConsultantName(profile.name);
                    }
                }
            } catch (e) {
                console.error('Failed to load user profile', e);
            } finally {
                setProfileLoading(false);
            }
        };
        loadProfile();
    }, [authUser]);
// Initial Data Load from Supabase
    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                const [salesData, consultantsData, incomeData, pass, mgrGoals, strSched] = await Promise.all([
                    dbService.fetchSales(),
                    dbService.fetchConsultants(),
                    dbService.fetchOtherIncomes(),
                    dbService.loadManagerPassword(),
                    dbService.loadManagerGoals(),
                    dbService.loadStoreSchedules()
                ]);
                
                setAllSales(processSalesData(salesData));
                setConsultants(consultantsData);
                setOtherIncomes(incomeData);
                setManagerPassword(pass);
                setManagerGoals(mgrGoals);
                setStoreSchedules(strSched);

            } catch (err) {
                console.error("Failed to load data from Firestore", err);
                alert("Failed to connect to the database. Please check your internet connection.");
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, []);

    // Load consultant specific data when active consultant changes
    useEffect(() => {
        const loadConsultantData = async () => {
            if (activeConsultantName) {
                const [g, s] = await Promise.all([
                    dbService.loadGoals(activeConsultantName),
                    dbService.loadSchedule(activeConsultantName)
                ]);
                setGoals(g);
                setSchedule(s);
            }
        }
        loadConsultantData();
        localStorageService.saveActiveConsultantName(activeConsultantName);
    }, [activeConsultantName]);

     useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorageService.saveTheme(theme);
    }, [theme]);
    
    useEffect(() => {
        if (!isLoadingData && role === 'consultant' && consultants.length === 0) {
            setIsConsultantModalOpen(true);
        } else if (!isLoadingData && role === 'consultant' && consultants.length > 0 && !activeConsultantName) {
            setActiveConsultantName(consultants[0].name);
        }
    }, [role, consultants, activeConsultantName, isLoadingData]);

    // Sync changes to DB (Debounced or on change)
    // Note: We removed auto-saving useEffects. We will save in handlers.
    
    useEffect(() => { localStorageService.saveRole(role); }, [role]);

    const months = useMemo(() => [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
    ], []);
    
    useEffect(() => {
        if (role === 'manager') return;
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

        let workDaysInCurrentMonth = 0;
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (schedule[dateStr] !== false) {
                workDaysInCurrentMonth++;
            }
        }
        
        if (workDaysInCurrentMonth > 0 && goals.workingDays !== workDaysInCurrentMonth) {
            const newGoals = {...goals, workingDays: workDaysInCurrentMonth};
            setGoals(newGoals);
            dbService.saveGoals(activeConsultantName, newGoals);
        }

    }, [schedule, role, activeConsultantName]);
    
    const processCSVText = (text: string) => {
        try {
            const parsedData = parseCSVRobust(text);
            const newSales: Partial<Sale>[] = parsedData.map((row) => ({
                date: row['Date'] || row['date'] || new Date().toISOString().split('T')[0],
                customerName: row['Customer Name'] || row['customerName'] || 'N/A',
                salesperson: row['Salesperson'] || row['salesperson'] || activeConsultantName,
                newOrUsed: (row['New/Used'] || row['newOrUsed']) === 'New' ? VehicleType.NEW : VehicleType.USED,
                store: row['Store'] || row['store'] || consultants.find(c => c.name === (row['Salesperson'] || row['salesperson']))?.store || '',
                year: parseInt(row['Year'] || row['year']) || new Date().getFullYear(),
                make: row['Make'] || row['make'] || '',
                model: row['Model'] || row['model'] || '',
                trade: (row['Trade'] || row['trade'])?.toLowerCase() === 'true' || (row['Trade'] || row['trade']) === 'Yes',
                frontGross: parseFloat(row['Front Gross'] || row['frontGross']) || 0,
                backGross: parseFloat(row['Back Gross'] || row['backGross']) || 0,
                commission: parseFloat(row['Commission'] || row['commission']) || 0,
                accessory: parseFloat(row['Accessory'] || row['accessory']) || 0,
                spiffs: parseFloat(row['Spiffs'] || row['spiffs']) || 0,
                tradeSpiff: parseFloat(row['Trade Spiff'] || row['tradeSpiff']) || 0,
                count: parseFloat(row['Unit Count'] || row['count']) === 0.5 ? 0.5 : 1,
                status: 'delivered',
                stockNumber: row['Stock #'] || row['stockNumber'] || '',
            }));
            setCsvImportPreview(newSales);
            setIsImportModalOpen(true);
        } catch (err) {
            alert('Failed to parse CSV file. Please ensure it is correctly formatted.');
            console.error(err);
        }
    };

     useEffect(() => {
        const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
        const handleDragLeave = (e: DragEvent) => { e.preventDefault(); setIsDragging(false); };
        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer?.files?.[0]) {
                const file = e.dataTransfer.files[0];
                if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const text = event.target?.result as string;
                        processCSVText(text);
                    };
                    reader.readAsText(file);
                } else {
                    alert('Please drop a CSV file.');
                }
            }
        };
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('drop', handleDrop);
        return () => {
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('drop', handleDrop);
        };
    }, [activeConsultantName, consultants]);


    const consultantSales = useMemo(() => {
        if (role === 'manager') return allSales;
        return allSales.filter(s => s.salesperson === activeConsultantName);
    }, [allSales, role, activeConsultantName]);
    
    const consultantOtherIncomes = useMemo(() => {
        if (role === 'manager') return otherIncomes;
        return otherIncomes.filter(i => i.salesperson === activeConsultantName);
    }, [otherIncomes, role, activeConsultantName]);

    const views = useMemo(() => [...months.map(m => m.substring(0,3)), 'YTD'], [months]);

    const deliveredSales = useMemo(() => consultantSales.filter(s => s.status === 'delivered'), [consultantSales]);
    const pendingSales = useMemo(() => consultantSales.filter(s => s.status === 'pending'), [consultantSales]);
    
    const salesForCurrentView = useMemo(() => {
        if (currentView === 'YTD') return deliveredSales;
        const monthIndex = months.findIndex(m => m.startsWith(currentView));
        if (monthIndex === -1) return [];
        const currentYear = new Date().getFullYear();
        return deliveredSales.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate.getMonth() === monthIndex && saleDate.getFullYear() === currentYear;
        });
    }, [currentView, deliveredSales, months]);
    
    const otherIncomesForCurrentView = useMemo(() => {
        if (currentView === 'YTD') return consultantOtherIncomes;
        const monthIndex = months.findIndex(m => m.startsWith(currentView));
        if (monthIndex === -1) return [];
        const currentYear = new Date().getFullYear();
        return consultantOtherIncomes.filter(income => {
            const incomeDate = new Date(income.date);
            return incomeDate.getMonth() === monthIndex && incomeDate.getFullYear() === currentYear;
        });
    }, [currentView, consultantOtherIncomes, months]);


    const stats: SalesStats = useMemo(() => {
        const getPassedWorkingDays = (month: number, year: number): number => {
            const today = new Date();
            if (today.getMonth() !== month || today.getFullYear() !== year) {
                if (new Date(year, month, 1) > today) return 0;
                return goals.workingDays || new Date(year, month + 1, 0).getDate();
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

        const data = salesForCurrentView;
        const totalSales = data.reduce((sum, s) => sum + s.count, 0);
        const totalGross = data.reduce((sum, s) => sum + s.frontGross + s.backGross, 0);
        const totalFrontGross = data.reduce((sum, s) => sum + s.frontGross, 0);
        const totalBackGross = data.reduce((sum, s) => sum + s.backGross, 0);
        const totalOtherIncome = otherIncomesForCurrentView.reduce((sum, i) => sum + i.amount, 0);
        const totalCommission = data.reduce((sum, s) => sum + s.commission, 0) + totalOtherIncome;
        const totalAccessories = data.reduce((sum, s) => sum + s.accessory, 0);
        const totalSpiffs = data.reduce((sum, s) => sum + s.spiffs, 0);
        const totalTradeSpiffs = data.reduce((sum, s) => sum + s.tradeSpiff, 0);
        const newVehicles = data.filter(s => s.newOrUsed === VehicleType.NEW).reduce((sum, s) => sum + s.count, 0);
        const usedVehicles = data.filter(s => s.newOrUsed === VehicleType.USED).reduce((sum, s) => sum + s.count, 0);
        const totalTrades = data.filter(s => s.trade).length;
        const tradePercentage = totalSales > 0 ? (totalTrades / data.length) * 100 : 0;
        const pendingSalesCount = pendingSales.length;
        
        let monthlyPace = 0;
        let commissionPace = 0;
        let sellingDaysLeft = 0;
        let unitsPerDayToGoal = 0;

        if (currentView !== 'YTD') {
            const today = new Date();
            const currentYear = today.getFullYear();
            const monthIndex = months.findIndex(m => m.startsWith(currentView));
            
            if (monthIndex !== -1) {
                const totalWorkingDays = goals.workingDays || new Date(currentYear, monthIndex + 1, 0).getDate();
                const passedDays = getPassedWorkingDays(monthIndex, currentYear);
                const paceMultiplier = passedDays > 0 ? totalWorkingDays / passedDays : 0;

                monthlyPace = totalSales * paceMultiplier;
                commissionPace = totalCommission * paceMultiplier;
                
                let remainingWorkDays = 0;
                if (today.getMonth() === monthIndex && today.getFullYear() === currentYear) {
                    const totalDaysInMonth = new Date(currentYear, monthIndex + 1, 0).getDate();
                     for (let day = today.getDate() + 1; day <= totalDaysInMonth; day++) {
                        const dateStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        if (schedule[dateStr] !== false) remainingWorkDays++;
                    }
                }
                sellingDaysLeft = remainingWorkDays;
                
                const unitsToGoal = Math.max(0, goals.unitGoal - totalSales);
                unitsPerDayToGoal = sellingDaysLeft > 0 ? unitsToGoal / sellingDaysLeft : 0;
            }
        }

        return { 
            totalSales, totalGross, totalFrontGross, totalBackGross, totalCommission, newVehicles, usedVehicles, 
            totalTrades, tradePercentage, monthlyPace, commissionPace, pendingSalesCount, 
            avgCommission: totalSales > 0 ? totalCommission / totalSales : 0,
            avgFrontGross: totalSales > 0 ? totalFrontGross / totalSales : 0,
            avgBackGross: totalSales > 0 ? totalBackGross / totalSales : 0,
            totalAccessories,
            totalSpiffs,
            totalTradeSpiffs,
            totalOtherIncome,
            sellingDaysLeft,
            unitsPerDayToGoal,
        };
    }, [salesForCurrentView, pendingSales, currentView, months, goals, otherIncomesForCurrentView, schedule]);
    
    const displayedDeliveredSales = useMemo(() => {
        let sortableItems = [...salesForCurrentView];
        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            sortableItems = sortableItems.filter(sale => Object.values(sale).some(val => String(val).toLowerCase().includes(lowercasedFilter)));
        }
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const aVal = a[sortConfig.key!];
                const bVal = b[sortConfig.key!];
                if (sortConfig.key === 'date') return (new Date(bVal as string).getTime() - new Date(aVal as string).getTime()) * (sortConfig.direction === 'ascending' ? -1 : 1);
                if (typeof aVal === 'string') return aVal.localeCompare(bVal as string) * (sortConfig.direction === 'ascending' ? 1 : -1);
                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        let viewCumulativeGross = 0;
        return sortableItems.map(sale => {
            viewCumulativeGross += sale.frontGross + sale.backGross;
            return { ...sale, viewCumulativeGross };
        });
    }, [salesForCurrentView, searchTerm, sortConfig]);
    
    const displayedPendingSales = useMemo(() => {
        let sortableItems = [...pendingSales];
        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            sortableItems = sortableItems.filter(sale => Object.values(sale).some(val => String(val).toLowerCase().includes(lowercasedFilter)));
        }
        return sortableItems;
    }, [pendingSales, searchTerm]);

    const chartData = useMemo(() => {
        if (currentView === 'YTD') {
            const salesByMonth = deliveredSales.reduce((acc, sale) => {
                const month = new Date(sale.date).getMonth();
                if (!acc[month]) acc[month] = { sales: 0, commission: 0 };
                acc[month].sales += sale.count;
                acc[month].commission += sale.commission;
                return acc;
            }, {} as { [key: number]: { sales: number; commission: number } });
            
            const otherIncomesByMonth = consultantOtherIncomes.reduce((acc, income) => {
                const month = new Date(income.date).getMonth();
                acc[month] = (acc[month] || 0) + income.amount;
                return acc;
            }, {} as {[key: number]: number});

            const monthlyData = months.map((monthName, index) => ({ 
                date: monthName.substring(0, 3), 
                sales: salesByMonth[index]?.sales || 0, 
                commission: (salesByMonth[index]?.commission || 0) + (otherIncomesByMonth[index] || 0)
            }));
            
            let cumulativeSales = 0, cumulativeCommission = 0;
            return monthlyData.map(d => ({ ...d, cumulativeSales: cumulativeSales += d.sales, cumulativeCommission: cumulativeCommission += d.commission }));

        } else {
             const salesByDate = salesForCurrentView.reduce((acc, sale) => {
                const date = new Date(sale.date).toLocaleDateString('en-CA');
                if (!acc[date]) acc[date] = { sales: 0, commission: 0 };
                acc[date].sales += sale.count;
                acc[date].commission += sale.commission;
                return acc;
            }, {} as Record<string, { sales: number; commission: number }>);

            const otherIncomesByDate = otherIncomesForCurrentView.reduce((acc, income) => {
                const date = new Date(income.date).toLocaleDateString('en-CA');
                acc[date] = (acc[date] || 0) + income.amount;
                return acc;
            }, {} as Record<string, number>);

            const allDates = [...new Set([...Object.keys(salesByDate), ...Object.keys(otherIncomesByDate)])];
            
            const combinedDailyData = allDates.map(date => ({
                date,
                sales: salesByDate[date]?.sales || 0,
                commission: (salesByDate[date]?.commission || 0) + (otherIncomesByDate[date] || 0)
            }));

            const sortedDailyData = combinedDailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            let cumulativeSales = 0, cumulativeCommission = 0;
            return sortedDailyData.map(d => ({ ...d, cumulativeSales: cumulativeSales += d.sales, cumulativeCommission: cumulativeCommission += d.commission }));
        }
    }, [currentView, deliveredSales, salesForCurrentView, months, consultantOtherIncomes, otherIncomesForCurrentView]);

    const addSale = async (newSaleData: Omit<Sale, 'id' | 'cumulativeGross'>) => {
        try {
            const saleWithId = { ...newSaleData, id: Date.now() };
            await dbService.createSale(saleWithId);
            const newSalesList = [...allSales, saleWithId];
            setAllSales(processSalesData(newSalesList));
            if (newSaleData.status === 'delivered' && role === 'consultant') {
                setCurrentView(months[new Date(newSaleData.date).getMonth()].substring(0,3));
            }
            setIsFormVisible(false);
        } catch(e) {
            console.error(e);
            alert("Failed to save sale.");
        }
    };
    
    const addOtherIncome = async (newIncome: Omit<OtherIncome, 'id'>) => {
        try {
            const incomeWithId = { ...newIncome, id: Date.now() };
            await dbService.createOtherIncome(incomeWithId);
            setOtherIncomes([...otherIncomes, incomeWithId]);
            setIsOtherIncomeFormVisible(false);
        } catch (e) {
            console.error(e);
            alert("Failed to save income.");
        }
    };

    const updateOtherIncome = async (updatedIncome: OtherIncome) => {
        try {
            await dbService.updateOtherIncome(updatedIncome);
            setOtherIncomes(otherIncomes.map(i => i.id === updatedIncome.id ? updatedIncome : i));
            setEditingOtherIncomeId(null);
        } catch(e) {
            console.error(e);
            alert("Failed to update income.");
        }
    };

    const deleteOtherIncome = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this income entry?')) {
            try {
                await dbService.deleteOtherIncome(id);
                setOtherIncomes(otherIncomes.filter(i => i.id !== id));
            } catch(e) {
                console.error(e);
                alert("Failed to delete income.");
            }
        }
    };


    const handleUpdateSale = async (updatedSale: Sale) => {
        try {
            await dbService.updateSale(updatedSale);
            const updatedSales = allSales.map(s => s.id === updatedSale.id ? updatedSale : s);
            setAllSales(processSalesData(updatedSales));
            handleCancelEdit();
        } catch(e) {
            console.error(e);
            alert("Failed to update sale.");
        }
    };

    const handleDeleteSale = async (idToDelete: number) => {
        if (window.confirm('Are you sure you want to delete this sale?')) {
            try {
                await dbService.deleteSale(idToDelete);
                setAllSales(processSalesData(allSales.filter(s => s.id !== idToDelete)));
            } catch(e) {
                console.error(e);
                alert("Failed to delete sale.");
            }
        }
    };
    
    const handleMarkAsDelivered = async (idToDeliver: number) => {
        const sale = allSales.find(s => s.id === idToDeliver);
        if (sale) {
            const updated = { ...sale, status: 'delivered' as const, date: new Date().toISOString().split('T')[0] };
            try {
                await dbService.updateSale(updated);
                const updatedSales = allSales.map(s => s.id === idToDeliver ? updated : s);
                setAllSales(processSalesData(updatedSales));
            } catch(e) {
                console.error(e);
                alert("Failed to deliver sale.");
            }
        }
    };

     const handleUnwindSale = async (idToUnwind: number) => {
        if (window.confirm("Are you sure you want to unwind this deal? It will be moved to Pending Deals.")) {
             const sale = allSales.find(s => s.id === idToUnwind);
             if (sale) {
                const updated = { ...sale, status: 'pending' as const };
                try {
                    await dbService.updateSale(updated);
                    const updatedSales = allSales.map(s => s.id === idToUnwind ? updated : s);
                    setAllSales(processSalesData(updatedSales));
                    handleCancelEdit();
                } catch(e) {
                    console.error(e);
                    alert("Failed to unwind sale.");
                }
            }
        }
    };
const handleSort = (key: keyof Sale) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending' }));
    };

    const handleEditClick = (sale: Sale) => {
        setEditingSaleId(sale.id);
        setEditingSaleData({ ...sale });
    };

    const handleCancelEdit = () => {
        setEditingSaleId(null);
        setEditingSaleData(null);
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!editingSaleData) return;
        const { name, value, type } = e.target;
        let processedValue: string | number | boolean = value;
        if (type === 'checkbox') processedValue = (e.target as HTMLInputElement).checked;
        else if (type === 'number' || name === 'count') processedValue = value === '' ? 0 : parseFloat(value);
        setEditingSaleData({ ...editingSaleData, [name]: processedValue });
    };
    
    const handleGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const newGoals = { ...goals, [name]: value === '' ? 0 : parseFloat(value) };
        setGoals(newGoals);
        dbService.saveGoals(activeConsultantName, newGoals); // Save immediately/debounced in real app, here direct
    };

    const handleExport = () => {
        const exportData = {
            sales: allSales,
            otherIncomes: otherIncomes,
            consultants: consultants,
        }
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `auto-sales-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsDataActionsModalOpen(false);
    };

    const handleImportClick = () => jsonFileInputRef.current?.click();
    const handleImportCSVClick = () => csvFileInputRef.current?.click();

    const handleJSONFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const importedData = JSON.parse(text);
                
                if (window.confirm("This will overwrite all current data. Are you sure?")) {
                   // For Supabase, bulk import logic would be needed here. 
                   // For this demo, we will just alert that full backup restore to DB is not fully implemented in this specific client snippet
                   // but typically one would iterate and insert.
                   alert("Bulk restore from JSON to DB is not implemented in this version.");
                }
            } catch (err: any) {
                alert(`Error importing file: ${err.message}`);
            } finally {
                if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
                setIsDataActionsModalOpen(false);
            }
        };
        reader.readAsText(file);
    };
    
    const handleCSVFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            processCSVText(text);
        };
        reader.readAsText(file);
        setIsDataActionsModalOpen(false);
        if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    };

    const handleConfirmImport = async () => {
        try {
            const promises = csvImportPreview.map(s => {
               // ensure type safety for insert
               const sale = {
                   ...s,
                   id: Date.now() + Math.random(), // temp ID
                   status: 'delivered',
                   cumulativeGross: 0
               } as any;
               return dbService.createSale(sale);
            });
            await Promise.all(promises);
            
            const newSales = await dbService.fetchSales();
            setAllSales(processSalesData(newSales));
            setIsImportModalOpen(false);
            setCsvImportPreview([]);
        } catch(e) {
            console.error(e);
            alert("Failed to import sales.");
        }
    };
    
    const DetailTable = ({ data, columns }: { data: any[], columns: { Header: string, accessor: string, isCurrency?: boolean }[] }) => (
        <div className="overflow-auto max-h-96">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 dark:text-white uppercase bg-gray-100 dark:bg-slate-700/50">
                    <tr>
                        {columns.map(col => <th key={col.accessor} className="px-4 py-2">{col.Header}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {data.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                            {columns.map(col => (
                                <td key={col.accessor} className="px-4 py-2 whitespace-nowrap">
                                    {col.isCurrency ? `$${row[col.accessor].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : row[col.accessor]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const handleStatCardClick = (title: string) => {
        setModalTitle(`${currentView} ${title} Details`);
        let content: React.ReactNode = null;
        let dataToShow: any[] = [];
        let columns: {Header: string, accessor: string, isCurrency?: boolean}[] = [];
        
        switch (title) {
            case 'Total Gross':
                dataToShow = salesForCurrentView.map(s => ({ customer: s.customerName, vehicle: `${s.year} ${s.make} ${s.model}`, front: s.frontGross, back: s.backGross, total: s.frontGross + s.backGross }));
                columns = [{Header: 'Customer', accessor: 'customer'}, {Header: 'Vehicle', accessor: 'vehicle'}, {Header: 'Front', accessor: 'front', isCurrency: true}, {Header: 'Back', accessor: 'back', isCurrency: true}, {Header: 'Total', accessor: 'total', isCurrency: true}];
                break;
            case 'Front PVR':
                 dataToShow = salesForCurrentView.map(s => ({ customer: s.customerName, vehicle: `${s.year} ${s.make} ${s.model}`, front: s.frontGross }));
                columns = [{Header: 'Customer', accessor: 'customer'}, {Header: 'Vehicle', accessor: 'vehicle'}, {Header: 'Front Gross', accessor: 'front', isCurrency: true}];
                break;
            case 'Back PVR':
                 dataToShow = salesForCurrentView.map(s => ({ customer: s.customerName, vehicle: `${s.year} ${s.make} ${s.model}`, back: s.backGross }));
                columns = [{Header: 'Customer', accessor: 'customer'}, {Header: 'Vehicle', accessor: 'vehicle'}, {Header: 'Back Gross', accessor: 'back', isCurrency: true}];
                break;
            case 'Total Commission':
                 dataToShow = salesForCurrentView.map(s => ({ customer: s.customerName, vehicle: `${s.year} ${s.make} ${s.model}`, commission: s.commission }));
                columns = [{Header: 'Customer', accessor: 'customer'}, {Header: 'Vehicle', accessor: 'vehicle'}, {Header: 'Commission', accessor: 'commission', isCurrency: true}];
                break;
            case 'Other Income':
                dataToShow = otherIncomesForCurrentView.map(i => ({ date: i.date, description: i.description, amount: i.amount }));
                columns = [{Header: 'Date', accessor: 'date'}, {Header: 'Description', accessor: 'description'}, {Header: 'Amount', accessor: 'amount', isCurrency: true}];
                break;
            case 'Total Sales':
                content = (
                    <div>
                        <p>Total delivered units for the selected period.</p>
                        <p className="mt-2"><strong className="text-slate-900 dark:text-white">New Units:</strong> {stats.newVehicles}</p>
                        <p><strong className="text-slate-900 dark:text-white">Used Units:</strong> {stats.usedVehicles}</p>
                        {stats.pendingSalesCount > 0 && <p className="mt-2 text-amber-400">There are {stats.pendingSalesCount} pending deals not included.</p>}
                    </div>
                );
                break;
            case 'Total Trades':
                const trades = salesForCurrentView.filter(s => s.trade);
                content = trades.length > 0 ? <ul className="space-y-2 text-sm">{trades.map(s => <li key={s.id} className="p-2 bg-slate-200 dark:bg-slate-700/50 rounded-md"><strong className="text-slate-900 dark:text-white">{s.customerName}</strong> ({s.year} {s.make} {s.model})</li>)}</ul> : <p>No trades recorded for this period.</p>;
                break;
            default:
                content = <p>Details for {title}.</p>;
        }

        if (dataToShow.length > 0) {
            content = <DetailTable data={dataToShow} columns={columns} />;
        } else if (!content) {
            content = <p>No data to display for this category in the selected period.</p>;
        }

        setModalContent(content);
        setIsModalOpen(true);
    };

    const handleSetFirstConsultant = async () => {
        if(tempConsultantName.trim() && tempConsultantStore.trim()) {
            const newConsultant: Consultant = {
                name: tempConsultantName.trim(),
                store: tempConsultantStore.trim()
            };
            try {
                await dbService.createConsultant(newConsultant);
                setConsultants([newConsultant]);
                setActiveConsultantName(newConsultant.name);
                setIsConsultantModalOpen(false);
            } catch(e) {
                console.error(e);
                alert("Failed to create consultant.");
            }
        }
    }

    const handleSwitchToConsultant = () => {
        setRole('consultant');
        setIsManagerAuthenticated(false);
    };

    const handleSwitchToManager = () => {
        if (role !== 'manager') {
            setIsManagerLoginOpen(true);
        }
    };
    
    const handleManagerLogin = async () => {
        if (!managerPassword) {
            if (managerPasswordInput.length < 4) {
                setManagerPasswordError('Password must be at least 4 characters.');
                return;
            }
            await dbService.saveManagerPassword(managerPasswordInput);
            setManagerPassword(managerPasswordInput);
            setIsManagerAuthenticated(true);
            setIsManagerLoginOpen(false);
            setManagerPasswordInput('');
            setManagerPasswordError('');
            setRole('manager');
        } else {
            if (managerPasswordInput === managerPassword) {
                setIsManagerAuthenticated(true);
                setIsManagerLoginOpen(false);
                setManagerPasswordInput('');
                setManagerPasswordError('');
                setRole('manager');
            } else {
                setManagerPasswordError('Incorrect password.');
            }
        }
    };
    
    const handleResetManagerPassword = async () => {
        if(window.confirm("Are you sure you want to reset the manager password? You will be prompted to create a new one.")) {
            await dbService.removeManagerPassword();
            setManagerPassword(null);
            setManagerPasswordInput('');
            setManagerPasswordError('');
        }
    }
    
    const handleAddConsultant = async (name: string, store: string) => {
        if (name && store && !consultants.some(c => c.name === name)) {
            const newC = { name, store };
            try {
                await dbService.createConsultant(newC);
                setConsultants([...consultants, newC].sort((a, b) => a.name.localeCompare(b.name)));
            } catch(e) {
                console.error(e);
                alert("Failed to add consultant.");
            }
        } else {
            alert(consultants.some(c => c.name === name) ? 'This consultant name already exists.' : 'Please provide a valid name and store.');
        }
    };

    const handleDeleteConsultant = async (nameToDelete: string) => {
        if (window.confirm(`Are you sure you want to delete consultant "${nameToDelete}"? This cannot be undone.`)) {
            try {
                await dbService.deleteConsultant(nameToDelete);
                const newConsultants = consultants.filter(c => c.name !== nameToDelete);
                setConsultants(newConsultants);
                if (activeConsultantName === nameToDelete) {
                    setActiveConsultantName(newConsultants[0]?.name || '');
                }
            } catch(e) {
                console.error(e);
                alert("Failed to delete consultant.");
            }
        }
    };

    const handleUpdateConsultant = async (oldName: string, updatedConsultant: Consultant) => {
        try {
            await dbService.updateConsultant(oldName, updatedConsultant);
            setConsultants(prev => prev.map(c => c.name === oldName ? updatedConsultant : c));
            // In a real app, we'd reload sales to reflect keys, but optimistic update:
            setAllSales(prev => prev.map(s => s.salesperson === oldName ? { ...s, salesperson: updatedConsultant.name, store: updatedConsultant.store } : s));
            setOtherIncomes(prev => prev.map(i => i.salesperson === oldName ? { ...i, salesperson: updatedConsultant.name } : i));
            
            if (activeConsultantName === oldName) setActiveConsultantName(updatedConsultant.name);
        } catch(e) {
            console.error(e);
            alert("Failed to update consultant.");
        }
    };

    const paceColor = useMemo(() => {
        if (goals.unitGoal <= 0 || currentView === 'YTD') return '';
        const ratio = stats.monthlyPace / goals.unitGoal;
        if (ratio >= 1) return 'text-green-500 dark:text-green-400';
        if (ratio >= 0.9) return 'text-yellow-500 dark:text-yellow-400';
        return 'text-red-500 dark:text-red-400';
    }, [stats.monthlyPace, goals.unitGoal, currentView]);

    const commissionPaceColor = useMemo(() => {
        if (goals.commissionGoal <= 0 || currentView === 'YTD') return '';
        const ratio = stats.commissionPace / goals.commissionGoal;
        if (ratio >= 1) return 'text-green-500 dark:text-green-400';
        if (ratio >= 0.9) return 'text-yellow-500 dark:text-yellow-400';
        return 'text-red-500 dark:text-red-400';
    }, [stats.commissionPace, goals.commissionGoal, currentView]);
    
    const handleDownloadCSV = () => {
        if (displayedDeliveredSales.length === 0) {
            alert("No data to download for the current view.");
            return;
        }

        const headers = Object.keys(displayedDeliveredSales[0]).filter(key => key !== 'id' && key !== 'cumulativeGross');
        const csvContent = [
            headers.join(','),
            ...displayedDeliveredSales.map(row => 
                headers.map(header => {
                    let cell = (row as any)[header];
                    if (typeof cell === 'string') {
                        cell = cell.includes(',') ? `"${cell.replace(/"/g, '""')}"` : cell;
                    }
                    return cell;
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `sales_log_${currentView}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        setIsDataActionsModalOpen(false);
    };
    
    // --- Handlers for Settings Page that need DB ---
    const handleUpdateSchedule = async (newSchedule: WorkSchedule) => {
        setSchedule(newSchedule);
        await dbService.saveSchedule(activeConsultantName, newSchedule);
    }

    const handleUpdateStoreSchedules = async (newSchedules: Record<string, WorkSchedule>) => {
        setStoreSchedules(newSchedules);
        await dbService.saveStoreSchedules(newSchedules);
    }
    
    const handleUpdateManagerGoals = async (newGoals: ManagerGoals) => {
        setManagerGoals(newGoals);
        await dbService.saveManagerGoals(newGoals);
    }



    // Auth gating: show auth screen until user is logged in
    if (authLoading || profileLoading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900 text-slate-800 dark:text-white">Loading account...</div>;
    }

    if (!authUser) {
        return <AuthScreen />;
    }

    if (isLoadingData) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900 text-slate-800 dark:text-white">Loading Data from Cloud...</div>;
    }
    
    const consultantDashboardProps = {
        consultants, activeConsultantName, setActiveConsultantName,
        currentView, setCurrentView, views, months,
        goals, handleGoalChange, paceColor, commissionPaceColor,
        stats, handleStatCardClick, chartData, allSales,
        isFormVisible, setIsFormVisible, searchTerm, setSearchTerm, addSale,
        displayedPendingSales, sortConfig, handleSort, editingSaleId,
        editingSaleData, handleEditClick, handleCancelEdit, handleUpdateSale,
        handleEditChange, handleDeleteSale, handleMarkAsDelivered, handleUnwindSale,
        displayedDeliveredSales, consultantOtherIncomes, otherIncomesForCurrentView,
        isOtherIncomeFormVisible, setIsOtherIncomeFormVisible, addOtherIncome,
        updateOtherIncome, deleteOtherIncome, editingOtherIncomeId, setEditingOtherIncomeId,
        salesForCurrentView,
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-slate-900 text-slate-800 dark:text-gray-200 p-4 sm:p-6 lg:p-8 font-sans">
             {isDragging && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] pointer-events-none">
                    <div className="text-center p-10 bg-slate-700 rounded-lg border-4 border-dashed border-blue-400 flex flex-col items-center gap-4">
                        <FileIcon className="w-16 h-16 text-blue-300" />
                        <p className="text-white text-2xl font-bold">Drop CSV file to import sales</p>
                    </div>
                </div>
            )}
            <div className="max-w-7xl mx-auto">
                <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Auto Sales Tracker</h1>
                        <div className="text-slate-500 dark:text-slate-400 mt-1 text-sm sm:text-base flex items-center gap-2">
                             {role === 'consultant' ? (
                                <>
                                    <span>Consultant:</span>
                                    {consultants.length > 0 ? (
                                        <select value={activeConsultantName} onChange={(e) => setActiveConsultantName(e.target.value)} className="bg-gray-200 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md py-1 px-2 text-slate-900 dark:text-white text-sm focus:ring-blue-500 focus:border-blue-500">
                                            {consultants.map(c => <option key={c.name} value={c.name}>{c.name} ({c.store})</option>)}
                                        </select>
                                    ) : <span>Not Set</span>}
                                </>
                             ) : 'Manager Dashboard'}
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        <div className="p-1 flex items-center gap-1 rounded-lg bg-gray-200 dark:bg-slate-700">
                            <button 
                                onClick={handleSwitchToConsultant} 
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${role === 'consultant' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-gray-300/50 dark:hover:bg-slate-600/50'}`}
                            >
                                Consultant
                            </button>
                            <button 
                                onClick={handleSwitchToManager}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${role === 'manager' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-gray-300/50 dark:hover:bg-slate-600/50'}`}
                            >
                                Manager
                            </button>
                        </div>
                         <input type="file" ref={jsonFileInputRef} onChange={handleJSONFileChange} accept=".json" className="hidden" />
                         <input type="file" ref={csvFileInputRef} onChange={handleCSVFileChange} accept=".csv" className="hidden" />
                        <button onClick={() => setIsDataActionsModalOpen(true)} className="bg-slate-500 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm flex items-center gap-2"><DatabaseIcon /> Data Actions</button>
                        <button onClick={() => setAppView('settings')} className="bg-slate-500 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm flex items-center gap-2"><SettingsIcon /> Settings</button>
                        <button onClick={() => signOut(auth)} className="bg-gray-300 hover:bg-gray-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm">Sign out</button>
                    </div>
                </header>

                {appView === 'dashboard' && role === 'consultant' && activeConsultantName && <ConsultantDashboard {...consultantDashboardProps} />}
                {appView === 'dashboard' && role === 'manager' && isManagerAuthenticated && (
                    <ManagerDashboard 
                        allSales={allSales}
                        pendingSales={pendingSales}
                        onSaleAdded={addSale}
                        onSaleUpdated={handleUpdateSale}
                        onSaleDeleted={handleDeleteSale}
                        onSaleDelivered={handleMarkAsDelivered}
                        consultants={consultants}
                        onAddConsultant={handleAddConsultant}
                        onDeleteConsultant={handleDeleteConsultant}
                        onUpdateConsultant={handleUpdateConsultant}
                        goals={managerGoals}
                        setGoals={handleUpdateManagerGoals}
                        storeSchedules={storeSchedules}
                    />
                )}
                 {appView === 'dashboard' && role === 'manager' && !isManagerAuthenticated && (
                     <div className="text-center py-20">
                        <p className="text-slate-500 dark:text-slate-400">Please authenticate to view the Manager Dashboard.</p>
                    </div>
                )}

                {appView === 'settings' && role === 'consultant' && (
                    <SettingsPage
                        role="consultant"
                        consultantName={activeConsultantName}
                        schedule={schedule}
                        setSchedule={handleUpdateSchedule}
                        salesData={salesForCurrentView}
                        theme={theme}
                        setTheme={setTheme}
                        onClose={() => setAppView('dashboard')}
                    />
                )}
                {appView === 'settings' && role === 'manager' && isManagerAuthenticated && (
                    <SettingsPage
                        role="manager"
                        schedules={storeSchedules}
                        setSchedules={handleUpdateStoreSchedules}
                        goals={managerGoals}
                        setGoals={handleUpdateManagerGoals}
                        consultants={consultants}
                        theme={theme}
                        setTheme={setTheme}
                        onClose={() => setAppView('dashboard')}
                    />
                )}


                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
                    {modalContent}
                </Modal>
                <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Confirm CSV Import">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Found {csvImportPreview.length} sales to import. This will add them to your existing log. Please review the preview below.
                    </p>
                    <DetailTable 
                        data={csvImportPreview} 
                        columns={[
                            {Header: 'Date', accessor: 'date'},
                            {Header: 'Customer', accessor: 'customerName'},
                            {Header: 'Vehicle', accessor: 'make'},
                            {Header: 'Gross', accessor: 'frontGross', isCurrency: true},
                        ]}
                    />
                     <div className="mt-6 flex justify-end gap-3">
                        <button onClick={() => setIsImportModalOpen(false)} className="bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg">Cancel</button>
                        <button onClick={handleConfirmImport} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Confirm & Add Sales</button>
                    </div>
                </Modal>
                <Modal isOpen={isDataActionsModalOpen} onClose={() => setIsDataActionsModalOpen(false)} title="Data Actions" size="large">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-100 dark:bg-slate-700/50 p-4 rounded-lg">
                            <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><UploadIcon/> Import Sales Log</h3>
                            <button onClick={handleImportCSVClick} className="w-full text-left p-3 bg-white dark:bg-slate-600 hover:bg-gray-50 dark:hover:bg-slate-500 rounded-lg mb-2 transition-colors">From CSV file</button>
                            <p className="text-xs text-slate-500 dark:text-slate-400">For Excel or Google Sheets, please save/export your data as a CSV file first.</p>
                        </div>

                        <div className="bg-gray-100 dark:bg-slate-700/50 p-4 rounded-lg">
                             <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><DatabaseIcon/> App Data Backup</h3>
                             <button onClick={handleImportClick} className="w-full text-left p-3 bg-white dark:bg-slate-600 hover:bg-gray-50 dark:hover:bg-slate-500 rounded-lg mb-2 transition-colors">Import from Backup (.json)</button>
                             <button onClick={handleExport} className="w-full text-left p-3 bg-white dark:bg-slate-600 hover:bg-gray-50 dark:hover:bg-slate-500 rounded-lg transition-colors">Export Full Backup (.json)</button>
                        </div>
                        
                         <div className="bg-gray-100 dark:bg-slate-700/50 p-4 rounded-lg">
                             <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><ShareIcon/> Share & Download</h3>
                             <button onClick={() => { window.print(); setIsDataActionsModalOpen(false); }} className="w-full text-left p-3 bg-white dark:bg-slate-600 hover:bg-gray-50 dark:hover:bg-slate-500 rounded-lg mb-2 transition-colors">Print Current Page</button>
                             <button onClick={handleDownloadCSV} className="w-full text-left p-3 bg-white dark:bg-slate-600 hover:bg-gray-50 dark:hover:bg-slate-500 rounded-lg transition-colors">Download Sales as CSV</button>
                        </div>
                    </div>
                </Modal>
                <Modal isOpen={isConsultantModalOpen} onClose={() => {}} title="Welcome">
                    <div className="p-2">
                        <p className="text-slate-600 dark:text-slate-300 mb-4">Please enter your name and store to get started.</p>
                        <div className="space-y-4">
                            <input
                                type="text"
                                value={tempConsultantName}
                                onChange={(e) => setTempConsultantName(e.target.value)}
                                className="block w-full rounded-md border-0 py-1.5 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., Jane Doe"
                            />
                             <input
                                type="text"
                                value={tempConsultantStore}
                                onChange={(e) => setTempConsultantStore(e.target.value)}
                                className="block w-full rounded-md border-0 py-1.5 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., Honda World"
                            />
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button onClick={handleSetFirstConsultant} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Save</button>
                        </div>
                    </div>
                </Modal>
                 <Modal isOpen={isManagerLoginOpen} onClose={() => setIsManagerLoginOpen(false)} title={managerPassword ? "Manager Login" : "Set Manager Password"}>
                     <div className="p-2 space-y-4">
                        <p className="text-slate-600 dark:text-slate-300">{managerPassword ? "Please enter the password to access the manager dashboard." : "Create a password to protect the manager dashboard. (min 4 characters)"}</p>
                        <input
                            type="password"
                            value={managerPasswordInput}
                            onChange={(e) => { setManagerPasswordInput(e.target.value); setManagerPasswordError(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleManagerLogin()}
                            className="block w-full rounded-md border-0 py-1.5 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"
                            placeholder="Password"
                        />
                        {managerPasswordError && <p className="text-red-400 text-sm">{managerPasswordError}</p>}
                        <div className="mt-6 flex justify-between items-center">
                            {managerPassword && (
                                <button onClick={handleResetManagerPassword} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">Reset Password</button>
                            )}
                            <div className="flex-grow"></div>
                            <button onClick={handleManagerLogin} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                                {managerPassword ? "Login" : "Save Password"}
                            </button>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
};

// Define Dashboard as a sub-component within App.tsx
const ConsultantDashboard = (props: any) => {
    const {
        activeConsultantName, currentView, setCurrentView, views, months,
        goals, handleGoalChange, paceColor, commissionPaceColor,
        stats, handleStatCardClick, chartData,
        isFormVisible, setIsFormVisible, searchTerm, setSearchTerm, addSale,
        displayedPendingSales, sortConfig, handleSort, editingSaleId,
        editingSaleData, handleEditClick, handleCancelEdit, handleUpdateSale,
        handleEditChange, handleDeleteSale, handleMarkAsDelivered, handleUnwindSale,
        displayedDeliveredSales, consultantOtherIncomes, otherIncomesForCurrentView,
        isOtherIncomeFormVisible, setIsOtherIncomeFormVisible, addOtherIncome,
        updateOtherIncome, deleteOtherIncome, editingOtherIncomeId, setEditingOtherIncomeId,
        salesForCurrentView,
    } = props;

    return (
        <>
            <div className="no-print">
                <Tabs tabs={views} activeTab={currentView} onTabChange={setCurrentView} />
            </div>
            <main>
                <div className="border border-gray-200 dark:border-slate-700 rounded-b-xl p-4 sm:p-6 bg-gray-50 dark:bg-slate-800/50">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 no-print">
                        <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">
                            Performance Summary: <span className="text-blue-600 dark:text-blue-400">{currentView === 'YTD' ? 'Year-to-Date' : months.find((m: string) => m.startsWith(currentView))}</span>
                        </h2>
                    </div>
                    
                    {currentView !== 'YTD' && (
                        <section className="mb-6 bg-white dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">My Monthly Goals & Pace</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-2">
                                        <label htmlFor="unitGoal" className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Unit Goal</label>
                                        <input id="unitGoal" name="unitGoal" type="number" value={goals.unitGoal || ''} onChange={handleGoalChange} placeholder="0" className="w-full rounded-md border-0 py-1 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"/>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label htmlFor="commissionGoal" className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Income Goal $</label>
                                        <input id="commissionGoal" name="commissionGoal" type="number" value={goals.commissionGoal || ''} onChange={handleGoalChange} placeholder="0" className="w-full rounded-md border-0 py-1 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"/>
                                    </div>
                                     <div className="flex items-center gap-2">
                                        <label htmlFor="workingDays" className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Working Days</label>
                                        <input id="workingDays" name="workingDays" type="number" value={goals.workingDays || ''} onChange={handleGoalChange} placeholder="e.g. 26" className="w-full rounded-md border-0 py-1 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"/>
                                    </div>
                                </div>
                                <div className="md:col-span-2 bg-gray-100 dark:bg-slate-900/50 p-4 rounded-md">
                                    <div className="grid grid-cols-3 text-center text-sm">
                                        <div className="font-semibold text-slate-600 dark:text-slate-400">Metric</div>
                                        <div className="font-semibold text-slate-600 dark:text-slate-400">Actual</div>
                                        <div className="font-semibold text-slate-600 dark:text-slate-400">Pace</div>
                                        
                                        <div className="py-2 border-t border-gray-200 dark:border-slate-700">Units</div>
                                        <div className="py-2 border-t border-gray-200 dark:border-slate-700 font-bold text-xl text-slate-900 dark:text-white">
                                            <span className="text-green-600 dark:text-green-400">{stats.newVehicles}</span>
                                            <span className="text-slate-500 dark:text-slate-400 mx-1">/</span>
                                            <span className="text-orange-600 dark:text-orange-400">{stats.usedVehicles}</span>
                                            <span className="text-slate-500 dark:text-slate-400 mx-2">-</span>
                                            <span>{stats.totalSales}</span>
                                        </div>
                                        <div className={`py-2 border-t border-gray-200 dark:border-slate-700 font-bold text-xl ${paceColor}`}>~{stats.monthlyPace.toFixed(1)}</div>

                                        <div className="py-2 border-t border-gray-200 dark:border-slate-700">Income</div>
                                        <div className="py-2 border-t border-gray-200 dark:border-slate-700 font-bold text-xl text-slate-900 dark:text-white">{`$${stats.totalCommission.toLocaleString()}`}</div>
                                        <div className={`py-2 border-t border-gray-200 dark:border-slate-700 font-bold text-xl ${commissionPaceColor}`}>~{`$${stats.commissionPace.toLocaleString('en-US', {maximumFractionDigits:0})}`}</div>
                                    </div>
                                    <div className="pt-3 mt-3 border-t border-gray-200 dark:border-slate-700 text-center">
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            To meet your goal, you need to sell an average of 
                                            <strong className="text-slate-900 dark:text-white text-base mx-1">{stats.unitsPerDayToGoal.toFixed(1)}</strong> 
                                            units per day for the remaining 
                                            <strong className="text-slate-900 dark:text-white text-base mx-1">{stats.sellingDaysLeft}</strong> selling days.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
                        <StatCard title="Total Sales" value={stats.totalSales.toString()} icon={<CarIcon />} onClick={() => handleStatCardClick('Total Sales')} className="col-span-2 xl:col-span-1" footer={stats.pendingSalesCount > 0 ? `+${stats.pendingSalesCount} Pending` : undefined} subValue={`New: ${stats.newVehicles} / Used: ${stats.usedVehicles}`} />
                        <StatCard title="Total Gross" value={`$${stats.totalGross.toLocaleString()}`} icon={<DollarIcon />} onClick={() => handleStatCardClick('Total Gross')} />
                        <StatCard title="Front PVR" value={`$${stats.avgFrontGross.toLocaleString('en-US',{minimumFractionDigits: 2, maximumFractionDigits:2})}`} icon={<DollarIcon />} onClick={() => handleStatCardClick('Front PVR')} />
                        <StatCard title="Back PVR" value={`$${stats.avgBackGross.toLocaleString('en-US',{minimumFractionDigits: 2, maximumFractionDigits:2})}`} icon={<DollarIcon />} onClick={() => handleStatCardClick('Back PVR')} />
                        <StatCard title="Total Commission" value={`$${stats.totalCommission.toLocaleString()}`} icon={<TagIcon />} onClick={() => handleStatCardClick('Total Commission')} valueClassName="!text-emerald-500 dark:!text-emerald-400 font-bold" />
                        <StatCard title="Other Income" value={`$${stats.totalOtherIncome.toLocaleString()}`} icon={<DollarIcon />} onClick={() => handleStatCardClick('Other Income')} />
                        <StatCard title="Avg. Commission" value={`$${stats.avgCommission.toLocaleString('en-US',{minimumFractionDigits: 2, maximumFractionDigits:2})}`} icon={<ChartIcon />} />
                        <StatCard title="Total Trades" value={stats.totalTrades.toString()} icon={<TradeIcon />} onClick={() => handleStatCardClick('Total Trades')} />
                        <StatCard title="Trade %" value={`${stats.tradePercentage.toFixed(1)}%`} icon={<PercentIcon />} />
                    </section>
                    
                    <section className="grid grid-cols-1 lg:grid-cols-1 gap-8 mb-8">
                        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700">
                            <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Sales Performance Over Time</h2>
                            {salesForCurrentView.length > 0 || otherIncomesForCurrentView.length > 0 ? <SalesChart data={chartData} /> : <div className="flex items-center justify-center h-[300px] text-slate-500 dark:text-slate-400">No delivered sales for this period.</div>}
                        </div>
                    </section>

                    <div className="flex justify-between items-center mb-4 gap-4 no-print">
                        <div className="relative w-full sm:w-64">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 dark:text-slate-400"><SearchIcon /></span>
                            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full rounded-md border-0 py-1.5 pl-10 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"/>
                        </div>
                        <button onClick={() => setIsFormVisible(!isFormVisible)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg w-full sm:w-auto">{isFormVisible ? 'Close Form' : '+ Add Sale'}</button>
                    </div>
                    
                    {isFormVisible && <SalesForm onSubmit={addSale} role="consultant" consultantName={activeConsultantName} consultants={[]} className="no-print"/>}
                    
                     {displayedPendingSales.length > 0 && (
                        <section className="bg-gray-50 dark:bg-slate-800/50 p-4 sm:p-6 rounded-xl border-2 border-amber-500/30 dark:border-amber-400/50 mb-8">
                            <h2 className="text-xl font-semibold text-amber-600 dark:text-amber-300 mb-4">Pending Deals ({displayedPendingSales.length})</h2>
                            <SalesTable sales={displayedPendingSales} onSort={handleSort} sortConfig={sortConfig} editingSaleId={editingSaleId} editingSaleData={editingSaleData} onEditClick={handleEditClick} onCancelEdit={handleCancelEdit} onUpdateSale={handleUpdateSale} onEditChange={handleEditChange} onDelete={handleDeleteSale} onDeliver={handleMarkAsDelivered} role={'consultant'} />
                        </section>
                     )}

                    <section className="bg-white dark:bg-slate-800 p-0 sm:p-6 rounded-xl sm:border border-gray-200 dark:border-slate-700">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 px-4 sm:px-0 pt-4 sm:pt-0">Delivered Sales Log</h2>
                        {displayedDeliveredSales.length > 0 ? (
                            <SalesTable sales={displayedDeliveredSales} onSort={handleSort} sortConfig={sortConfig} editingSaleId={editingSaleId} editingSaleData={editingSaleData} onEditClick={handleEditClick} onCancelEdit={handleCancelEdit} onUpdateSale={handleUpdateSale} onEditChange={handleEditChange} onDelete={handleDeleteSale} role={'consultant'} onUnwind={handleUnwindSale} />
                        ) : (
                             <div className="text-center py-8 text-slate-500 dark:text-slate-400">{searchTerm ? `No sales match "${searchTerm}".` : 'No delivered sales for this period.'}</div>
                        )}
                    </section>

                    <section className="mt-8 bg-white dark:bg-slate-800 p-0 sm:p-6 rounded-xl sm:border border-gray-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-4 px-4 sm:px-0 pt-4 sm:pt-0">
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Other Income Log</h2>
                            <button onClick={() => setIsOtherIncomeFormVisible(!isOtherIncomeFormVisible)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg text-sm">{isOtherIncomeFormVisible ? 'Close' : '+ Add Other Income'}</button>
                        </div>
                        {isOtherIncomeFormVisible && <OtherIncomeForm onSubmit={addOtherIncome} consultantName={activeConsultantName} />}
                        {otherIncomesForCurrentView.length > 0 ? (
                            <OtherIncomeTable 
                                incomes={otherIncomesForCurrentView}
                                onUpdate={updateOtherIncome}
                                onDelete={deleteOtherIncome}
                                editingId={editingOtherIncomeId}
                                setEditingId={setEditingOtherIncomeId}
                            />
                        ) : (
                            <div className="text-center py-8 text-slate-500 dark:text-slate-400">No other income logged for this period.</div>
                        )}
                    </section>

                    <section className="mt-8 no-print">
                        <IncomeCalculator consultantName={activeConsultantName} />
                    </section>

                </div>
            </main>
        </>
    );
};

type BaseSettingsProps = { onClose: () => void; theme: 'light' | 'dark'; setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>; };
type ConsultantSettingsProps = BaseSettingsProps & {
    role: 'consultant';
    consultantName: string;
    schedule: WorkSchedule;
    setSchedule: (schedule: WorkSchedule) => void;
    salesData: Sale[];
};
type ManagerSettingsProps = BaseSettingsProps & {
    role: 'manager';
    schedules: Record<string, WorkSchedule>;
    setSchedules: (schedules: Record<string, WorkSchedule>) => void;
    goals: ManagerGoals;
    setGoals: (goals: ManagerGoals) => void;
    consultants: Consultant[];
};
type SettingsPageProps = ConsultantSettingsProps | ManagerSettingsProps;

const SettingsPage = (props: SettingsPageProps) => {
    const { onClose, theme, setTheme } = props;
    const isManager = props.role === 'manager';
    
    const [widgets, setWidgets] = useState({ goals: true, stats: true, chart: true, insights: true, incomeCalc: true });
    const [notifications, setNotifications] = useState({ type: 'email', contact: '', enabled: false });
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const availableStores = useMemo(() => isManager ? [...new Set(props.consultants.map(c => c.store))].sort() : [], [isManager, props.role === 'manager' && props.consultants]);
    const [selectedStore, setSelectedStore] = useState(availableStores[0] || '');

    useEffect(() => {
        if (isManager && !selectedStore && availableStores.length > 0) {
            setSelectedStore(availableStores[0]);
        }
    }, [isManager, selectedStore, availableStores]);
    
     useEffect(() => {
        if (props.role !== 'manager' || !selectedStore) return;

        const { schedules, setGoals } = props;
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
        const storeSchedule = schedules[selectedStore] || {};
        
        let workDaysInCurrentMonth = 0;
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (storeSchedule[dateStr] !== false) {
                workDaysInCurrentMonth++;
            }
        }
        
        const currentWorkingDays = props.goals[selectedStore]?.workingDays;
        
        if (workDaysInCurrentMonth >= 0 && currentWorkingDays !== workDaysInCurrentMonth) {
            setGoals({
                ...props.goals,
                [selectedStore]: {
                    ...(props.goals[selectedStore] || { newGoal: 0, usedGoal: 0 }),
                    workingDays: workDaysInCurrentMonth
                }
            });
        }
    }, [isManager, selectedStore, props.role === 'manager' && props.schedules, currentMonth]);


    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDayOfMonth });
    
    const handleDayToggle = (day: number) => {
        const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (props.role === 'manager') {
            const { schedules, setSchedules } = props;
            const storeSchedule = schedules[selectedStore] || {};
            const isWorkDay = storeSchedule[dateStr] !== false;
            setSchedules({
                ...schedules,
                [selectedStore]: { ...storeSchedule, [dateStr]: !isWorkDay }
            });
        } else {
            const { schedule, setSchedule } = props;
            const isWorkDay = schedule[dateStr] !== false;
            setSchedule({ ...schedule, [dateStr]: !isWorkDay });
        }
    };

    const currentScheduleForCalendar = isManager ? (props.schedules[selectedStore] || {}) : props.schedule;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Settings & Profile</h2>
                <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Save & Close</button>
            </div>
            
            <section className="bg-white dark:bg-slate-800/50 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">Appearance</h3>
                 <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Theme</span>
                    <div className="flex items-center gap-3">
                        <span className={`text-sm ${theme === 'light' ? 'text-blue-600 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>Light</span>
                        <button
                            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <span className={`text-sm ${theme === 'dark' ? 'text-blue-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>Dark</span>
                    </div>
                </div>
            </section>
            
            <section className="bg-white dark:bg-slate-800/50 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">{isManager ? 'Store Schedule' : 'Work Schedule'}</h3>
                {isManager && (
                     <div className="mb-4">
                        <label htmlFor="store-select" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Editing Schedule For</label>
                        <select
                            id="store-select"
                            value={selectedStore}
                            onChange={(e) => setSelectedStore(e.target.value)}
                            className="bg-gray-200 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md py-2 px-3 text-slate-900 dark:text-white text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            {availableStores.map(store => <option key={store} value={store}>{store}</option>)}
                        </select>
                    </div>
                )}
                <p className="text-sm text-slate-500 dark:text-slate-400 -mt-2 mb-4">Click days to toggle them on or off. This will automatically update 'Working Days' for goals and pace calculations.</p>
                <div className="bg-gray-100 dark:bg-slate-800 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>&lt; Prev</button>
                        <h4 className="font-semibold text-slate-900 dark:text-white">{currentMonth.toLocaleString('default', { month: 'long' })} {currentMonth.getFullYear()}</h4>
                        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>Next &gt;</button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 dark:text-slate-400 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {emptyDays.map((_, i) => <div key={`empty-${i}`}></div>)}
                        {calendarDays.map(day => {
                             const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                             const isWorkDay = currentScheduleForCalendar[dateStr] !== false;
                             return (
                                <button key={day} onClick={() => handleDayToggle(day)} className={`h-16 rounded-md p-1.5 flex flex-col justify-between text-left transition-colors ${ isWorkDay ? 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600' : 'bg-gray-50 dark:bg-slate-900 hover:bg-gray-200 dark:hover:bg-slate-800 opacity-60'}`}>
                                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{day}</span>
                                    <span className={`text-xs font-semibold ${ isWorkDay ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{isWorkDay ? 'Work Day' : 'Day Off'}</span>
                                </button>
                             );
                        })}
                    </div>
                </div>
            </section>
            
            {!isManager && (
                <section className="bg-white dark:bg-slate-800/50 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
                    <PayPlanCalculator salesData={props.salesData} consultantName={props.consultantName} />
                </section>
            )}

            <section className="bg-white dark:bg-slate-800/50 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">Dashboard Widgets</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {Object.entries(widgets).map(([key, value]) => (
                        <div key={key} className="flex items-center">
                            <input id={`widget-${key}`} type="checkbox" checked={value} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 bg-gray-300 dark:bg-slate-600 border-gray-400 dark:border-slate-500" />
                            <label htmlFor={`widget-${key}`} className="ml-2 text-slate-600 dark:text-slate-300">{key.charAt(0).toUpperCase() + key.slice(1).replace('Calc', ' Calculator')}</label>
                        </div>
                    ))}
                </div>
                 <p className="text-xs text-slate-500 mt-4">Note: Widget toggle functionality is a visual placeholder to be implemented.</p>
            </section>
            
            <section className="bg-white dark:bg-slate-800/50 p-6 rounded-lg border border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4">Notifications</h3>
                <div className="space-y-4">
                     <div className="flex items-center">
                        <input id="notif-enabled" type="checkbox" checked={notifications.enabled} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 bg-gray-300 dark:bg-slate-600 border-gray-400 dark:border-slate-500" />
                        <label htmlFor="notif-enabled" className="ml-2 text-slate-600 dark:text-slate-300">Enable daily summary notifications</label>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="text-slate-600 dark:text-slate-400">Method:</label>
                        <div className="flex items-center gap-2">
                             <input type="radio" id="notif-email" name="notif-type" value="email" checked={notifications.type === 'email'} />
                             <label htmlFor="notif-email">Email</label>
                        </div>
                        <div className="flex items-center gap-2">
                             <input type="radio" id="notif-text" name="notif-type" value="text" checked={notifications.type === 'text'} />
                             <label htmlFor="notif-text">Text</label>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="notif-contact" className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Email Address or Phone Number</label>
                        <input id="notif-contact" type="text" placeholder="your.email@example.com" className="block w-full sm:w-1/2 rounded-md border-0 py-1.5 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-inset focus:ring-blue-500" />
                    </div>
                </div>
                 <p className="text-xs text-slate-500 mt-4">Note: This is a UI placeholder. The backend service required to send notifications has not been implemented.</p>
            </section>

        </div>
    );
};


// === Auth Screen ===
// Simple email/password auth screen with signup + login, tailored UI.
const AuthScreen: React.FC = () => {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [role, setRole] = useState<'consultant' | 'manager'>('consultant');
    const [name, setName] = useState('');
    const [store, setStore] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [managerId, setManagerId] = useState<string>('');
    const [managers, setManagers] = useState<UserProfile[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string>('');

    // Load available managers for the optional manager dropdown
    useEffect(() => {
        const loadManagers = async () => {
            try {
                const mgrs = await dbService.fetchManagers();
                setManagers(mgrs);
            } catch (e) {
                console.error('Failed to load managers', e);
            }
        };
        loadManagers();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            if (mode === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
                // onAuthStateChanged in App will take over
                return;
            }

            // Signup flow
            if (!name.trim()) {
                setError('Please enter your name.');
                return;
            }

            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const uid = cred.user.uid;

            const profile: UserProfile = {
                uid,
                name: name.trim(),
                email: email.toLowerCase(),
                role,
                store: store.trim() || undefined,
                managerId: role === 'consultant' ? (managerId || undefined) : undefined,
                createdAt: new Date().toISOString(),
            };

            await dbService.saveUserProfile(profile);

            // Also create a Consultant record so the main app can use it
            if (role === 'consultant') {
                const consultant: Consultant = {
                    name: profile.name,
                    store: profile.store || '',
                };
                await dbService.createConsultant(consultant);
            }

            // Auth state listener will switch the UI into the main app
        } catch (e: any) {
            console.error(e);
            setError(e?.message || 'Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-slate-900 flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-8">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sales Goal IQ</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                        Sign in to track deals, goals, and income — or create your account to get started.
                    </p>
                </div>

                {/* Login / Signup toggle */}
                <div className="flex mb-6 rounded-lg bg-gray-100 dark:bg-slate-700 p-1">
                    <button
                        type="button"
                        onClick={() => setMode('login')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                            mode === 'login'
                                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow'
                                : 'text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('signup')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                            mode === 'signup'
                                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow'
                                : 'text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        Create Account
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'signup' && (
                        <>
                            {/* Role toggle */}
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setRole('consultant')}
                                    className={`flex-1 py-2 text-xs font-semibold rounded-md border ${
                                        role === 'consultant'
                                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-700/60'
                                            : 'border-gray-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    I&apos;m a Consultant
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole('manager')}
                                    className={`flex-1 py-2 text-xs font-semibold rounded-md border ${
                                        role === 'manager'
                                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-700/60'
                                            : 'border-gray-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    I&apos;m a Manager
                                </button>
                            </div>

                            {/* Name & Store */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="block w-full rounded-md border-0 py-2 px-3 bg-gray-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g. Jane Doe"
                                    autoComplete="name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Store (optional)
                                </label>
                                <input
                                    type="text"
                                    value={store}
                                    onChange={(e) => setStore(e.target.value)}
                                    className="block w-full rounded-md border-0 py-2 px-3 bg-gray-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g. Honda World"
                                />
                            </div>

                            {/* Manager dropdown for consultants */}
                            {role === 'consultant' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Choose Manager (optional)
                                    </label>
                                    <select
                                        value={managerId}
                                        onChange={(e) => setManagerId(e.target.value)}
                                        className="block w-full rounded-md border-0 py-2 px-3 bg-gray-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">No manager (solo user)</option>
                                        {managers.map((m) => (
                                            <option key={m.uid} value={m.uid}>
                                                {m.name}
                                                {m.store ? ` (${m.store})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Managers can also add consultants later from the Manager Dashboard.
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="block w-full rounded-md border-0 py-2 px-3 bg-gray-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"
                            placeholder="you@example.com"
                            autoComplete="email"
                            required
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full rounded-md border-0 py-2 px-3 bg-gray-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-blue-500"
                            placeholder="At least 6 characters"
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            required
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-500 dark:text-red-400">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg shadow-md transition-colors"
                    >
                        {mode === 'login'
                            ? (isSubmitting ? 'Signing in...' : 'Login')
                            : (isSubmitting ? 'Creating account...' : 'Create Account')}
                    </button>
                </form>

                <p className="mt-6 text-center text-xs text-slate-400">
                    Your data is stored securely in the cloud using Firebase. You can use this as a solo rep or as part of a team with a manager dashboard.
                </p>
            </div>
        </div>
    );
};

export default App;
