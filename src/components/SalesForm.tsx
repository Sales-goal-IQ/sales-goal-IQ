import React, { useState, useEffect } from 'react';
import { Sale, VehicleType, Consultant, OtherIncome } from '../types';
import { loadPayPlan } from '../services/localStorageService';
import { calculateSimpleCommission } from '../services/payPlanService';
import { CalculatorIcon } from './icons';

interface SalesFormProps {
    onSubmit: (sale: Omit<Sale, 'id' | 'cumulativeGross'>) => void;
    role: 'consultant' | 'manager';
    consultantName?: string;
    consultants: Consultant[];
    className?: string;
}

interface FormData {
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
    accessory: number;
    spiffs: number;
    tradeSpiff: number;
    count: 0.5 | 1;
    status: 'pending' | 'delivered';
}


const SalesForm: React.FC<SalesFormProps> = ({ onSubmit, role, consultantName, consultants, className }) => {
    const today = new Date().toISOString().split('T')[0];
    const [formData, setFormData] = useState<FormData>({
        date: today,
        stockNumber: '',
        customerName: '',
        salesperson: role === 'consultant' ? consultantName || '' : consultants[0]?.name || '',
        newOrUsed: VehicleType.NEW,
        store: '',
        year: new Date().getFullYear(),
        make: '',
        model: '',
        trade: false,
        frontGross: 0,
        backGross: 0,
        commission: 0,
        accessory: 0,
        spiffs: 0,
        tradeSpiff: 0,
        count: 1,
        status: 'delivered',
    });
    const [isPending, setIsPending] = useState(false);

    useEffect(() => {
        const currentConsultant = consultants.find(c => c.name === (role === 'consultant' ? consultantName : formData.salesperson));
        if (currentConsultant) {
            setFormData(prev => ({
                ...prev,
                salesperson: currentConsultant.name,
                store: prev.store || currentConsultant.store
            }));
        } else if (role === 'manager' && consultants.length > 0) {
            setFormData(prev => ({...prev, salesperson: consultants[0].name, store: consultants[0].store}));
        }
    }, [consultantName, role, consultants, formData.salesperson]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
            const { checked, name: checkboxName } = e.target as HTMLInputElement;
             if (checkboxName === 'isPending') {
                setIsPending(checked);
                setFormData(prev => ({ ...prev, status: checked ? 'pending' : 'delivered' }));
            } else {
                setFormData(prev => ({ ...prev, [name]: checked }));
            }
        } else {
             setFormData(prev => ({ ...prev, [name]: type === 'number' || name === 'count' ? parseFloat(value) : value }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
        if (role === 'manager') {
           setFormData(prev => ({...prev, stockNumber: '', customerName: '', make: '', model: ''}));
        } else {
            setFormData(prev => ({...prev, stockNumber: '', customerName: '', make: '', model: ''}));
        }
    };
    
    const handleCalculateCommission = () => {
        const plan = loadPayPlan(formData.salesperson);
        if (!plan || plan.length === 0) {
            alert("No pay plan configured for this salesperson. Please set one up in the consultant's view.");
            return;
        }
        const calculated = calculateSimpleCommission(formData, plan);
        setFormData(prev => ({ ...prev, commission: calculated }));
    };

    return (
        <form onSubmit={handleSubmit} className={`p-6 mb-8 bg-slate-200/50 dark:bg-slate-700/50 rounded-lg border border-slate-300 dark:border-slate-600 ${className}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Column 1 */}
                <div className="flex flex-col gap-4">
                    <Input a="date" l="Date" t="date" v={formData.date} o={handleChange} />
                    {role === 'manager' ? (
                        <Select a="salesperson" l="Salesperson" v={formData.salesperson} o={handleChange}>
                            {consultants.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </Select>
                    ) : (
                        <Input a="salesperson" l="Salesperson" v={formData.salesperson} o={handleChange} required disabled />
                    )}
                    <Input a="stockNumber" l="Stock #" v={formData.stockNumber} o={handleChange} required />
                    <Input a="customerName" l="Customer Name" v={formData.customerName} o={handleChange} required />
                    <Select a="newOrUsed" l="New / Used" v={formData.newOrUsed} o={handleChange}>
                        <option value={VehicleType.NEW}>New</option>
                        <option value={VehicleType.USED}>Used</option>
                    </Select>
                     <Select a="count" l="Deal Count" v={formData.count} o={handleChange}>
                        <option value={1}>Full (1)</option>
                        <option value={0.5}>Split (0.5)</option>
                    </Select>
                </div>

                {/* Column 2 */}
                <div className="flex flex-col gap-4">
                    <Input a="store" l="Store" v={formData.store} o={handleChange} required />
                    <Input a="year" l="Year" t="number" v={formData.year} o={handleChange} required />
                    <Input a="make" l="Make" v={formData.make} o={handleChange} required />
                    <Input a="model" l="Model" v={formData.model} o={handleChange} required />
                </div>

                {/* Column 3 */}
                <div className="flex flex-col gap-4">
                    <Input a="frontGross" l="Front Gross $" t="number" v={formData.frontGross} o={handleChange} step="any" />
                    <Input a="backGross" l="Back Gross $" t="number" v={formData.backGross} o={handleChange} step="any" />
                    <div>
                        <div className="flex justify-between items-end mb-1">
                            <label htmlFor="commission" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Commission $</label>
                            <div className="relative group">
                                <button type="button" onClick={handleCalculateCommission} className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
                                    <CalculatorIcon /> Calculate
                                </button>
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 text-center text-xs bg-slate-600 text-white p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    Estimates commission based on simple rules (e.g., % of gross). Tiered rules are not applied.
                                </span>
                            </div>
                        </div>
                        <input type="number" name="commission" id="commission" value={formData.commission} onChange={handleChange} required step="any" className="block w-full rounded-md border-0 py-1.5 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6" />
                    </div>
                     <div className="flex items-center h-full pt-2">
                        <input id="trade" name="trade" type="checkbox" checked={formData.trade} onChange={handleChange} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 bg-gray-300 dark:bg-slate-600 border-gray-400 dark:border-slate-500" />
                        <label htmlFor="trade" className="ml-3 block text-sm font-medium text-slate-700 dark:text-slate-300">Trade-in</label>
                    </div>
                </div>
                
                {/* Column 4 */}
                <div className="flex flex-col gap-4">
                    <Input a="accessory" l="Accessory $" t="number" v={formData.accessory} o={handleChange} step="any" />
                    <Input a="spiffs" l="Spiffs $" t="number" v={formData.spiffs} o={handleChange} step="any" />
                    <Input a="tradeSpiff" l="Trade Spiff $" t="number" v={formData.tradeSpiff} o={handleChange} step="any" />
                    <div className="flex items-center h-full pt-2">
                        <input id="isPending" name="isPending" type="checkbox" checked={isPending} onChange={handleChange} className="h-4 w-4 rounded text-amber-500 focus:ring-amber-500 bg-gray-300 dark:bg-slate-600 border-gray-400 dark:border-slate-500" />
                        <label htmlFor="isPending" className="ml-3 block text-sm font-medium text-slate-700 dark:text-slate-300">Mark as Pending</label>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-end">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                    Add Sale
                </button>
            </div>
        </form>
    );
};

interface InputProps { a: string; l: string; t?: string; v: string | number; o: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void; required?: boolean; step?: string; disabled?: boolean; }
const Input: React.FC<InputProps> = ({ a, l, t = 'text', v, o, required = false, step, disabled = false }) => (
    <div>
        <label htmlFor={a} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{l}</label>
        <input type={t} name={a} id={a} value={v} onChange={o} required={required} step={step} disabled={disabled} className="block w-full rounded-md border-0 py-1.5 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 disabled:opacity-50" />
    </div>
);

interface SelectProps { a: string; l: string; v: string | VehicleType | 0.5 | 1; o: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void; children: React.ReactNode; }
const Select: React.FC<SelectProps> = ({ a, l, v, o, children }) => (
    <div>
        <label htmlFor={a} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{l}</label>
        <select id={a} name={a} value={v} onChange={o} className="block w-full rounded-md border-0 py-1.5 bg-gray-200 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-600 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6">
            {children}
        </select>
    </div>
);

interface OtherIncomeFormProps {
    onSubmit: (income: Omit<OtherIncome, 'id'>) => void;
    consultantName: string;
}
export const OtherIncomeForm: React.FC<OtherIncomeFormProps> = ({ onSubmit, consultantName }) => {
    const today = new Date().toISOString().split('T')[0];
    const [formData, setFormData] = useState({
        date: today,
        description: '',
        amount: 0,
        salesperson: consultantName,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.description || formData.amount <= 0) {
            alert('Please enter a valid description and amount.');
            return;
        }
        onSubmit(formData);
        setFormData({ ...formData, description: '', amount: 0 });
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 mb-4 bg-slate-200/50 dark:bg-slate-700/50 rounded-lg border border-slate-300 dark:border-slate-600">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <Input a="date" l="Date" t="date" v={formData.date} o={handleChange} />
                <div className="md:col-span-2">
                    <Input a="description" l="Description" v={formData.description} o={handleChange} required />
                </div>
                <Input a="amount" l="Amount $" t="number" v={formData.amount} o={handleChange} required step="any" />
            </div>
            <div className="mt-4 flex justify-end">
                <button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    Add Income
                </button>
            </div>
        </form>
    );
};

export default SalesForm;