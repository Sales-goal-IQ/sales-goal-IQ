
import React, { useState, useMemo } from 'react';
import { loadPayPlan } from '../services/localStorageService';
import { calculatePay } from '../services/payPlanService';
import { Sale, VehicleType, PayPlan } from '../types';

interface IncomeCalculatorProps {
    consultantName: string;
}

const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const IncomeCalculator: React.FC<IncomeCalculatorProps> = ({ consultantName }) => {
    const [units, setUnits] = useState<number | ''>('');
    const [avgCommission, setAvgCommission] = useState<number | ''>('');
    const [frontPvr, setFrontPvr] = useState<number | ''>('');
    const [backPvr, setBackPvr] = useState<number | ''>('');
    
    const payPlan = useMemo(() => loadPayPlan(consultantName), [consultantName]);

    const simpleCalculation = useMemo(() => {
        const u = typeof units === 'number' ? units : 0;
        const ac = typeof avgCommission === 'number' ? avgCommission : 0;
        return u * ac;
    }, [units, avgCommission]);

    const payPlanCalculation = useMemo(() => {
        if (payPlan.length === 0 || !units || units <= 0) {
            return { totalPay: 0 };
        }
        
        // Create dummy sales data based on inputs
        const dummySales: Sale[] = Array.from({ length: Math.floor(units) }, (_, i) => ({
            id: i,
            date: new Date().toISOString(),
            status: 'delivered',
            count: 1,
            frontGross: typeof frontPvr === 'number' ? frontPvr : 0,
            backGross: typeof backPvr === 'number' ? backPvr : 0,
            // Fill in other required fields with defaults
            stockNumber: '', customerName: '', salesperson: consultantName, newOrUsed: VehicleType.NEW,
            store: '', year: 0, make: '', model: '', trade: false, commission: 0, cumulativeGross: 0,
            accessory: 0, spiffs: 0, tradeSpiff: 0
        }));

        if (units % 1 !== 0) {
             dummySales.push({
                id: Math.floor(units),
                date: new Date().toISOString(),
                status: 'delivered',
                count: 0.5,
                frontGross: (typeof frontPvr === 'number' ? frontPvr : 0) * 0.5,
                backGross: (typeof backPvr === 'number' ? backPvr : 0) * 0.5,
                stockNumber: '', customerName: '', salesperson: consultantName, newOrUsed: VehicleType.NEW,
                store: '', year: 0, make: '', model: '', trade: false, commission: 0, cumulativeGross: 0,
                accessory: 0, spiffs: 0, tradeSpiff: 0
            });
        }
        
        return calculatePay(payPlan, dummySales);

    }, [payPlan, units, frontPvr, backPvr, consultantName]);

    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-semibold text-white mb-4">Income Projection Calculator</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Simple Calculator */}
                <div className="bg-slate-700/50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-400 mb-3">Simple Estimator</h4>
                    <div className="flex flex-col gap-4">
                        <Input label="Unit Count" type="number" value={units} onChange={setUnits} placeholder="e.g., 15.5"/>
                        <Input label="Avg Commission / Unit" type="number" value={avgCommission} onChange={setAvgCommission} placeholder="e.g., 450"/>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-600 flex justify-between items-center">
                        <span className="font-semibold text-slate-300">Total Income:</span>
                        <span className="font-bold text-2xl text-emerald-400">{formatCurrency(simpleCalculation)}</span>
                    </div>
                </div>
                {/* Pay Plan Calculator */}
                <div className="bg-slate-700/50 p-4 rounded-lg">
                     <h4 className="font-semibold text-blue-400 mb-3">Pay Plan Estimator</h4>
                    <div className="flex flex-col gap-4">
                        <Input label="Unit Count" type="number" value={units} onChange={setUnits} placeholder="e.g., 15.5"/>
                        <Input label="Avg Front PVR" type="number" value={frontPvr} onChange={setFrontPvr} placeholder="e.g., 2200"/>
                        <Input label="Avg Back PVR" type="number" value={backPvr} onChange={setBackPvr} placeholder="e.g., 800"/>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-600 flex justify-between items-center">
                        <span className="font-semibold text-slate-300">Total Income:</span>
                         <span className="font-bold text-2xl text-emerald-400">{formatCurrency(payPlanCalculation.totalPay)}</span>
                    </div>
                     {payPlan.length === 0 && <p className="text-xs text-amber-400 mt-2">You must set up your Pay Plan first for this calculator to work.</p>}
                </div>
            </div>
        </div>
    );
};

interface InputProps {
    label: string;
    type: string;
    value: number | '';
    onChange: (value: number | '') => void;
    placeholder: string;
}

const Input: React.FC<InputProps> = ({ label, type, value, onChange, placeholder }) => (
    <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
            placeholder={placeholder}
            className="block w-full rounded-md border-0 py-1.5 bg-slate-700 text-white shadow-sm ring-1 ring-inset ring-slate-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
        />
    </div>
);


export default IncomeCalculator;
