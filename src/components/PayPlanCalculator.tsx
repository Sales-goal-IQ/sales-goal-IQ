

import React, { useState, useEffect, useMemo } from 'react';
import { Sale, PayPlan, PayPlanRule, PayPlanRuleType, UnitTier, VehicleType } from '../types';
import { loadPayPlan, savePayPlan } from '../services/localStorageService';
import { calculatePay } from '../services/payPlanService';
import { TrashIcon, ChevronDownIcon } from './icons';

interface PayPlanCalculatorProps {
    salesData: Sale[];
    consultantName: string;
}

const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PayPlanCalculator: React.FC<PayPlanCalculatorProps> = ({ salesData, consultantName }) => {
    const [plan, setPlan] = useState<PayPlan>([]);
    const [isAddingRule, setIsAddingRule] = useState(false);

    useEffect(() => {
        if (consultantName) {
            setPlan(loadPayPlan(consultantName));
        }
    }, [consultantName]);

    useEffect(() => {
        if (consultantName) {
            savePayPlan(consultantName, plan);
        }
    }, [plan, consultantName]);

    const handleAddRule = (type: PayPlanRuleType) => {
        const newRule: PayPlanRule = { 
            id: Date.now().toString(), 
            type,
            appliesTo: 'All'
        };
        switch (type) {
            case PayPlanRuleType.BASE_SALARY:
                newRule.salaryAmount = 2000;
                newRule.isDraw = false;
                break;
            case PayPlanRuleType.FLAT_RATE_PER_UNIT:
                newRule.flatAmount = 250;
                break;
            case PayPlanRuleType.TIERED_UNIT_COMMISSION:
                newRule.unitTiers = [{ id: Date.now().toString(), from: 1, to: 8, amount: 100, percent: 0 }];
                newRule.isRetroactive = false;
                break;
            case PayPlanRuleType.PERCENT_OF_GROSS:
                newRule.frontEndPercent = 25;
                newRule.backEndPercent = 5;
                newRule.frontEndCap = 0;
                newRule.backEndCap = 0;
                break;
            case PayPlanRuleType.TIERED_PERCENT_OF_GROSS:
                newRule.grossTiers = [{ id: Date.now().toString(), from: 1, to: 8, amount: 0, percent: 20 }];
                newRule.isGrossRetroactive = false;
                newRule.grossType = 'Total';
                break;
            case PayPlanRuleType.UNIT_BONUS:
                newRule.unitBonuses = [{ id: Date.now().toString(), from: 15, to: null, amount: 500, percent: 0 }];
                break;
            case PayPlanRuleType.ADDON_COMMISSION:
                newRule.accessoryPercent = 10;
                newRule.spiffPercent = 100;
                newRule.tradeSpiffPercent = 100;
                break;
            case PayPlanRuleType.MINIMUM_COMMISSION:
                newRule.minCommissionAmount = 150;
                break;
        }
        setPlan(prev => [...prev, newRule]);
        setIsAddingRule(false);
    };

    const handleUpdateRule = (updatedRule: PayPlanRule) => {
        setPlan(prev => prev.map(rule => rule.id === updatedRule.id ? updatedRule : rule));
    };

    const handleDeleteRule = (id: string) => {
        setPlan(prev => prev.filter(rule => rule.id !== id));
    };

    const calculation = useMemo(() => {
        return calculatePay(plan, salesData);
    }, [plan, salesData]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Pay Plan Configuration</h3>
                {plan.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-center py-4">No pay plan rules defined. Click below to add one.</p>}
                {plan.map(rule => (
                    <RuleEditor key={rule.id} rule={rule} onUpdate={handleUpdateRule} onDelete={handleDeleteRule} />
                ))}
                <div className="relative">
                     <button onClick={() => setIsAddingRule(!isAddingRule)} className="w-full text-center py-2 px-4 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg font-semibold flex items-center justify-center gap-2">
                        Add New Pay Rule <ChevronDownIcon className={`w-5 h-5 transition-transform ${isAddingRule ? 'rotate-180' : ''}`} />
                    </button>
                    {isAddingRule && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-300 dark:bg-slate-600 border border-gray-400 dark:border-slate-500 rounded-lg shadow-xl z-10 p-2">
                           {Object.values(PayPlanRuleType).map(type => (
                               <button key={type} onClick={() => handleAddRule(type)} className="block w-full text-left px-3 py-2 rounded-md hover:bg-gray-400/50 dark:hover:bg-slate-500">{type}</button>
                           ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="bg-gray-100 dark:bg-slate-700/50 p-6 rounded-lg border border-gray-200 dark:border-slate-600">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Estimated Pay Calculation</h3>
                <div className="space-y-2 mb-6 text-sm text-slate-600 dark:text-slate-400">
                    <p>Based on <strong className="text-slate-900 dark:text-white">{calculation.totalUnits.toFixed(1)}</strong> units sold with a total gross of <strong className="text-slate-900 dark:text-white">{formatCurrency(calculation.totalGross)}</strong>.</p>
                </div>
                <div className="space-y-2">
                    {calculation.results.map((res, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                            <span className="text-slate-700 dark:text-slate-300">{res.description}</span>
                            <span className={`font-mono ${res.amount < 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{formatCurrency(res.amount)}</span>
                        </div>
                    ))}
                </div>
                <hr className="my-4 border-gray-300 dark:border-slate-600" />
                <div className="flex justify-between items-center text-lg">
                    <span className="font-bold text-slate-900 dark:text-white">Total Estimated Pay</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(calculation.totalPay)}</span>
                </div>
            </div>
        </div>
    );
};

const RuleEditor: React.FC<{rule: PayPlanRule, onUpdate: (rule: PayPlanRule) => void, onDelete: (id: string) => void}> = ({ rule, onUpdate, onDelete }) => {
    const handleChange = (field: keyof PayPlanRule, value: any) => {
        onUpdate({ ...rule, [field]: value });
    };

    const handleTierChange = (tierId: string, field: keyof UnitTier, value: any, tierType: 'unitTiers' | 'grossTiers' | 'unitBonuses') => {
        const tiers = rule[tierType] || [];
        const updatedTiers = tiers.map(t => t.id === tierId ? {...t, [field]: value} : t);
        handleChange(tierType, updatedTiers);
    };

    const addTier = (tierType: 'unitTiers' | 'grossTiers' | 'unitBonuses') => {
        const tiers = rule[tierType] || [];
        const lastTier = tiers[tiers.length - 1];
        const isPercentTier = tierType === 'grossTiers';
        const isBonusTier = tierType === 'unitBonuses';
        const newTier: UnitTier = { 
            id: Date.now().toString(), 
            from: (lastTier?.from ?? (isBonusTier ? 15 : 0)) + (isBonusTier ? 5 : 1), 
            to: isBonusTier ? null : null, 
            amount: isBonusTier ? (lastTier?.amount ?? 0) + 250 : isPercentTier ? 0 : (lastTier?.amount ?? 0) + 50,
            percent: isPercentTier ? (lastTier?.percent ?? 0) + 2 : 0,
        };
        handleChange(tierType, [...tiers, newTier]);
    };

    const removeTier = (tierId: string, tierType: 'unitTiers' | 'grossTiers' | 'unitBonuses') => {
        const tiers = rule[tierType] || [];
        handleChange(tierType, tiers.filter(t => t.id !== tierId));
    }

    const inputClass = "w-full bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded p-1 text-sm border border-gray-300 dark:border-slate-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";
    const selectClass = inputClass.replace('p-1', 'py-1 px-2');
    const hasAppliesTo = rule.type !== PayPlanRuleType.BASE_SALARY && rule.type !== PayPlanRuleType.PERCENT_OF_GROSS && rule.type !== PayPlanRuleType.MINIMUM_COMMISSION;

    return (
        <div className="bg-gray-100 dark:bg-slate-700/50 p-4 rounded-lg border border-gray-200 dark:border-slate-600">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h4 className="font-semibold text-blue-600 dark:text-blue-400">{rule.type}</h4>
                    {hasAppliesTo && (
                         <select value={rule.appliesTo} onChange={e => handleChange('appliesTo', e.target.value)} className={`${selectClass} text-xs mt-1 w-auto`}>
                            <option value="All">All Units</option>
                            <option value={VehicleType.NEW}>New Units Only</option>
                            <option value={VehicleType.USED}>Used Units Only</option>
                        </select>
                    )}
                </div>
                <button onClick={() => onDelete(rule.id)} className="text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300 flex-shrink-0"><TrashIcon /></button>
            </div>
            {rule.type === PayPlanRuleType.BASE_SALARY && (
                <div className="flex items-center gap-4">
                    <div className="flex-grow">
                        <label className="text-xs text-slate-500 dark:text-slate-400">Amount</label>
                        <input type="number" value={rule.salaryAmount ?? ''} onChange={e => handleChange('salaryAmount', parseFloat(e.target.value))} className={inputClass} />
                    </div>
                    <div className="flex items-center pt-5">
                        <input type="checkbox" id={`isDraw-${rule.id}`} checked={rule.isDraw} onChange={e => handleChange('isDraw', e.target.checked)} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 bg-gray-300 dark:bg-slate-600 border-gray-400 dark:border-slate-500" />
                        <label htmlFor={`isDraw-${rule.id}`} className="ml-2 text-sm text-slate-700 dark:text-slate-300">Is Draw</label>
                    </div>
                </div>
            )}
             {rule.type === PayPlanRuleType.FLAT_RATE_PER_UNIT && (
                 <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Amount per Unit</label>
                    <input type="number" value={rule.flatAmount ?? ''} onChange={e => handleChange('flatAmount', parseFloat(e.target.value))} className={inputClass} />
                </div>
            )}
            {rule.type === PayPlanRuleType.PERCENT_OF_GROSS && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400">Front-End %</label>
                        <input type="number" value={rule.frontEndPercent ?? ''} onChange={e => handleChange('frontEndPercent', parseFloat(e.target.value))} className={inputClass} placeholder="e.g., 25" />
                    </div>
                     <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400">Back-End %</label>
                        <input type="number" value={rule.backEndPercent ?? ''} onChange={e => handleChange('backEndPercent', parseFloat(e.target.value))} className={inputClass} placeholder="e.g., 5" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayPlanCalculator;