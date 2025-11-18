
export enum VehicleType {
    NEW = 'New',
    USED = 'Used',
}

export interface Consultant {
    name: string;
    store: string;
}

export interface OtherIncome {
    id: number;
    date: string;
    description: string;
    amount: number;
    salesperson: string;
}

export interface Sale {
    id: number;
    date: string;
    stockNumber: string;
    customerName: string;
    salesperson: string;
    newOrUsed: VehicleType;
    store: string;
    year: number;
    make: string;
    model: string;
    trade: boolean;
    frontGross: number;
    backGross: number;
    commission: number;
    cumulativeGross: number; // YTD cumulative
    viewCumulativeGross?: number; // Cumulative for the current view (e.g., MTD)
    accessory: number;
    spiffs: number;
    tradeSpiff: number;
    count: 0.5 | 1; // For split deals
    status: 'pending' | 'delivered'; // To distinguish between pending and completed sales
}

export interface Goals {
    unitGoal: number;
    commissionGoal: number;
    workingDays: number;
}

export type WorkSchedule = Record<string, boolean>; // Key: YYYY-MM-DD, Value: isWorkDay

export interface SalesStats {
    totalSales: number;
    totalGross: number;
    totalFrontGross: number;

    totalBackGross: number;
    totalCommission: number;
    newVehicles: number;
    usedVehicles: number;
    avgCommission: number;
    avgFrontGross: number;
    avgBackGross: number;
    totalTrades: number;
    tradePercentage: number;
    monthlyPace: number;
    commissionPace: number;
    pendingSalesCount: number;
    totalAccessories: number;
    totalSpiffs: number;
    totalTradeSpiffs: number;
    totalOtherIncome: number;
    sellingDaysLeft: number;
    unitsPerDayToGoal: number;
}

export interface ManagerGoals {
    [storeName: string]: {
        newGoal: number;
        usedGoal: number;
        workingDays: number;
    }
}

// Pay Plan Types
export enum PayPlanRuleType {
    BASE_SALARY = 'Base Salary / Draw',
    FLAT_RATE_PER_UNIT = 'Flat Rate Per Unit',
    TIERED_UNIT_COMMISSION = 'Tiered Rate Per Unit',
    PERCENT_OF_GROSS = 'Percentage of Gross Profit',
    TIERED_PERCENT_OF_GROSS = 'Tiered Percentage of Gross',
    UNIT_BONUS = 'Unit Bonus (Volume Bonus)',
    ADDON_COMMISSION = 'Add-on Commission',
    MINIMUM_COMMISSION = 'Minimum Commission per Unit',
}


export interface UnitTier {
    id: string;
    from: number;
    to: number | null; // null for open-ended tier
    amount: number; // For dollar amounts
    percent: number; // For percentages
}

export interface PayPlanRule {
    id: string;
    type: PayPlanRuleType;
    appliesTo: 'All' | VehicleType.NEW | VehicleType.USED;

    // For BASE_SALARY
    salaryAmount?: number;
    isDraw?: boolean;

    // For FLAT_RATE_PER_UNIT
    flatAmount?: number;

    // For TIERED_UNIT_COMMISSION
    unitTiers?: UnitTier[];
    isRetroactive?: boolean;

    // For PERCENT_OF_GROSS
    frontEndPercent?: number;
    backEndPercent?: number;
    frontEndCap?: number;
    backEndCap?: number;
    
    // For TIERED_PERCENT_OF_GROSS
    grossTiers?: UnitTier[];
    isGrossRetroactive?: boolean;
    grossType?: 'Front' | 'Back' | 'Total';

    // For UNIT_BONUS
    unitBonuses?: UnitTier[]; // Using UnitTier for simplicity: `from` is the threshold, `amount` is the bonus

    // For ADDON_COMMISSION
    accessoryPercent?: number;
    spiffPercent?: number;
    tradeSpiffPercent?: number;

    // For MINIMUM_COMMISSION
    minCommissionAmount?: number;
}

export type PayPlan = PayPlanRule[];
