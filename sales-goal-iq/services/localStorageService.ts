import { Sale, PayPlan, Consultant, Goals, OtherIncome, WorkSchedule } from '../types';

const STORAGE_KEY = 'salesData';
const OTHER_INCOME_KEY = 'otherIncomesData';
const GOALS_STORAGE_KEY_PREFIX = 'salesGoals_';
const SCHEDULE_KEY_PREFIX = 'workSchedule_';
const STORE_SCHEDULES_KEY = 'storeSchedules';
const ROLE_STORAGE_KEY = 'userRole';
const CONSULTANTS_LIST_KEY = 'consultantsList';
const ACTIVE_CONSULTANT_NAME_KEY = 'activeConsultantName';
const MANAGER_GOALS_KEY = 'managerGoals';
const MANAGER_PASSWORD_KEY = 'managerPassword';
const PAY_PLAN_KEY_PREFIX = 'payPlan_';
const THEME_KEY = 'theme';

export interface ManagerGoals {
    [storeName: string]: {
        newGoal: number;
        usedGoal: number;
        workingDays: number;
    }
}


export const loadSales = (): Omit<Sale, 'id' | 'cumulativeGross'>[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error("Failed to load sales data:", error);
        return [];
    }
};

export const saveSales = (sales: Sale[]): void => {
    try {
        const dataToStore = sales.map(({ cumulativeGross, viewCumulativeGross, ...rest }) => rest);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
    } catch (error) {
        console.error("Failed to save sales data:", error);
    }
};

export const loadOtherIncomes = (): OtherIncome[] => {
    try {
        const data = localStorage.getItem(OTHER_INCOME_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error("Failed to load other incomes data:", error);
        return [];
    }
};

export const saveOtherIncomes = (incomes: OtherIncome[]): void => {
    try {
        localStorage.setItem(OTHER_INCOME_KEY, JSON.stringify(incomes));
    } catch (error) {
        console.error("Failed to save other incomes data:", error);
    }
};


export const loadGoals = (consultantName: string): Goals => {
    try {
        if (!consultantName) return { unitGoal: 0, commissionGoal: 0, workingDays: 0 };
        const data = localStorage.getItem(`${GOALS_STORAGE_KEY_PREFIX}${consultantName}`);
        if (data) {
            const parsed = JSON.parse(data);
            return { unitGoal: parsed.unitGoal || 0, commissionGoal: parsed.commissionGoal || 0, workingDays: parsed.workingDays || 0 };
        }
    } catch (error) {
        console.error("Failed to load goals:", error);
        return { unitGoal: 0, commissionGoal: 0, workingDays: 0 };
    }
    return { unitGoal: 0, commissionGoal: 0, workingDays: 0 };
};

export const saveGoals = (consultantName: string, goals: Goals): void => {
    try {
        if (!consultantName) return;
        localStorage.setItem(`${GOALS_STORAGE_KEY_PREFIX}${consultantName}`, JSON.stringify(goals));
    } catch (error) {
        console.error("Failed to save goals:", error);
    }
};

export const migrateGoals = (oldName: string, newName: string): void => {
    const goals = loadGoals(oldName);
    saveGoals(newName, goals);
    localStorage.removeItem(`${GOALS_STORAGE_KEY_PREFIX}${oldName}`);
}


export const loadRole = (): 'consultant' | 'manager' => {
    return (localStorage.getItem(ROLE_STORAGE_KEY) as 'consultant' | 'manager') || 'consultant';
};

export const saveRole = (role: 'consultant' | 'manager'): void => {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
};

export const loadConsultants = (): Consultant[] => {
    try {
        const data = localStorage.getItem(CONSULTANTS_LIST_KEY);
        if (!data) return [];
        
        const parsedData = JSON.parse(data);
        if (Array.isArray(parsedData) && parsedData.every(item => typeof item === 'string')) {
            const migratedData: Consultant[] = parsedData.map(name => ({ name, store: 'Unassigned' }));
            saveConsultants(migratedData);
            return migratedData;
        }
        
        return parsedData as Consultant[];

    } catch (error) {
        console.error("Failed to load consultants list:", error);
        return [];
    }
};

export const saveConsultants = (consultants: Consultant[]): void => {
    try {
        localStorage.setItem(CONSULTANTS_LIST_KEY, JSON.stringify(consultants));
    } catch (error) {
        console.error("Failed to save consultants list:", error);
    }
};

export const loadActiveConsultantName = (): string => {
    return localStorage.getItem(ACTIVE_CONSULTANT_NAME_KEY) || '';
};

export const saveActiveConsultantName = (name: string): void => {
    localStorage.setItem(ACTIVE_CONSULTANT_NAME_KEY, name);
};

export const loadManagerGoals = (): ManagerGoals => {
    try {
        const data = localStorage.getItem(MANAGER_GOALS_KEY);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error("Failed to load manager goals:", error);
        return {};
    }
};

export const saveManagerGoals = (goals: ManagerGoals): void => {
    try {
        localStorage.setItem(MANAGER_GOALS_KEY, JSON.stringify(goals));
    } catch (error) {
        console.error("Failed to save manager goals:", error);
    }
};

export const loadManagerPassword = (): string | null => {
    return localStorage.getItem(MANAGER_PASSWORD_KEY);
};

export const saveManagerPassword = (password: string): void => {
    localStorage.setItem(MANAGER_PASSWORD_KEY, password);
};

export const removeManagerPassword = (): void => {
    localStorage.removeItem(MANAGER_PASSWORD_KEY);
};

export const loadPayPlan = (consultantName: string): PayPlan => {
    if (!consultantName) return [];
    try {
        const data = localStorage.getItem(`${PAY_PLAN_KEY_PREFIX}${consultantName}`);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error("Failed to load pay plan:", error);
        return [];
    }
};

export const savePayPlan = (consultantName: string, plan: PayPlan): void => {
    if (!consultantName) return;
    try {
        localStorage.setItem(`${PAY_PLAN_KEY_PREFIX}${consultantName}`, JSON.stringify(plan));
    } catch (error) {
        console.error("Failed to save pay plan:", error);
    }
};

export const removePayPlan = (consultantName: string): void => {
    if (!consultantName) return;
    localStorage.removeItem(`${PAY_PLAN_KEY_PREFIX}${consultantName}`);
};

export const migratePayPlan = (oldName: string, newName: string): void => {
    const plan = loadPayPlan(oldName);
    if (plan.length > 0) {
        savePayPlan(newName, plan);
        removePayPlan(oldName);
    }
};

export const loadSchedule = (consultantName: string): WorkSchedule => {
    if (!consultantName) return {};
    try {
        const data = localStorage.getItem(`${SCHEDULE_KEY_PREFIX}${consultantName}`);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error("Failed to load schedule:", error);
        return {};
    }
};

export const saveSchedule = (consultantName: string, schedule: WorkSchedule): void => {
    if (!consultantName) return;
    try {
        localStorage.setItem(`${SCHEDULE_KEY_PREFIX}${consultantName}`, JSON.stringify(schedule));
    } catch (error) {
        console.error("Failed to save schedule:", error);
    }
};

export const migrateSchedule = (oldName: string, newName: string): void => {
    const schedule = loadSchedule(oldName);
    if (Object.keys(schedule).length > 0) {
        saveSchedule(newName, schedule);
        localStorage.removeItem(`${SCHEDULE_KEY_PREFIX}${oldName}`);
    }
};

export const loadStoreSchedules = (): Record<string, WorkSchedule> => {
    try {
        const data = localStorage.getItem(STORE_SCHEDULES_KEY);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error("Failed to load store schedules:", error);
        return {};
    }
};

export const saveStoreSchedules = (schedules: Record<string, WorkSchedule>): void => {
    try {
        localStorage.setItem(STORE_SCHEDULES_KEY, JSON.stringify(schedules));
    } catch (error) {
        console.error("Failed to save store schedules:", error);
    }
};

export const loadTheme = (): 'light' | 'dark' => {
    try {
        const theme = localStorage.getItem(THEME_KEY);
        if (theme === 'light' || theme === 'dark') {
            return theme;
        }
    } catch (error) {
        console.error("Failed to load theme:", error);
    }
    return 'dark';
};

export const saveTheme = (theme: 'light' | 'dark'): void => {
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
        console.error("Failed to save theme:", error);
    }
};