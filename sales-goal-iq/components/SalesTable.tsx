import React, { useState } from 'react';
import { Sale, VehicleType, OtherIncome } from '../types';
import { TrashIcon, DeliverIcon, ChevronDownIcon } from './icons';

interface SalesTableProps {
    sales: Sale[];
    onSort: (key: keyof Sale) => void;
    sortConfig: { key: keyof Sale | null; direction: 'ascending' | 'descending' };
    editingSaleId: number | null;
    editingSaleData: Sale | null;
    onEditClick: (sale: Sale) => void;
    onCancelEdit: () => void;
    onUpdateSale: (sale: Sale) => void;
    onEditChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    onDelete: (id: number) => void;
    onDeliver?: (id: number) => void;
    onUnwind?: (id: number) => void;
    role: 'consultant' | 'manager';
}

const SalesTable: React.FC<SalesTableProps> = ({ sales, onSort, sortConfig, editingSaleId, editingSaleData, onEditClick, onCancelEdit, onUpdateSale, onEditChange, onDelete, onDeliver, onUnwind, role }) => {
    
    const headers = [
        { label: '#', sortable: false },
        { label: 'Customer', key: 'customerName', sortable: true },
        ...(role === 'manager' ? [{ label: 'Salesperson', key: 'salesperson', sortable: true }] : []),
        { label: 'Vehicle', sortable: false },
        { label: 'Commission', key: 'commission', sortable: true },
        { label: 'Unit Count', key: 'count', sortable: true },
        { label: 'Date', key: 'date', sortable: true },
        { label: 'Stock #', key: 'stockNumber', sortable: true },
        { label: 'New/Used', sortable: false },
        { label: 'Store', key: 'store', sortable: true },
        { label: 'Trade', key: 'trade', sortable: true },
        { label: 'Front Gross', key: 'frontGross', sortable: true },
        { label: 'Back Gross', key: 'backGross', sortable: true },
        ...(!onDeliver ? [{ label: 'Cumulative Gross', key: 'viewCumulativeGross', sortable: true }] : []),
        { label: 'Actions', sortable: false },
    ];
    
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="hidden md:table-header-group text-xs text-slate-700 dark:text-white uppercase bg-gray-100 dark:bg-slate-700/50">
                    <tr>
                        {headers.map((header, index) => (
                            <th key={index} scope="col" className="px-4 py-3">
                                {header.sortable && header.key ? (
                                    <SortButton label={header.label} sortKey={header.key as keyof Sale} onSort={onSort} sortConfig={sortConfig} />
                                ) : (
                                    header.label
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sales.map((sale, index) => (
                        editingSaleId === sale.id && editingSaleData ? (
                            <EditableRow 
                                key={sale.id} 
                                saleData={editingSaleData} 
                                onEditChange={onEditChange} 
                                onCancel={onCancelEdit} 
                                onSave={() => onUpdateSale(editingSaleData)}
                                role={role}
                                onUnwind={onUnwind ? () => onUnwind(editingSaleData.id) : undefined}
                            />
                        ) : (
                           <DisplayRow 
                                key={sale.id}
                                sale={sale}
                                index={index}
                                onDeliver={onDeliver}
                                onEditClick={onEditClick}
                                onDelete={onDelete}
                                role={role}
                           />
                        )
                    ))}
                </tbody>
            </table>
        </div>
    );
};


const SortButton: React.FC<{label: string, sortKey: keyof Sale, onSort: (key: keyof Sale) => void, sortConfig: {key: keyof Sale | null, direction: string}}> = ({label, sortKey, onSort, sortConfig}) => {
    const isSorted = sortConfig.key === sortKey;
    const sortIcon = isSorted ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '';
    return (
        <button onClick={() => onSort(sortKey)} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
            {label}
            <span className="text-slate-500 dark:text-slate-400 w-4">{sortIcon}</span>
        </button>
    )
}

const DisplayRow: React.FC<{sale: Sale, index: number, onDeliver?: (id: number) => void, onEditClick: (sale: Sale) => void, onDelete: (id: number) => void, role: string}> = ({sale, index, onDeliver, onEditClick, onDelete, role}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const detailCellClasses = isExpanded ? '' : 'hidden md:table-cell';

    return (
         <tr onClick={() => setIsExpanded(!isExpanded)} className="block md:table-row mb-4 md:mb-0 bg-white dark:bg-slate-800 md:bg-transparent border border-gray-200 dark:border-slate-700 rounded-lg md:border-b hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer md:cursor-default">
            <Cell label="#">{index + 1}</Cell>
            <Cell label="Customer" className="font-medium text-slate-900 dark:text-white">{sale.customerName}</Cell>
            {role === 'manager' && <Cell label="Salesperson">{sale.salesperson}</Cell>}
            <Cell label="Vehicle">{`${sale.year} ${sale.make} ${sale.model}`}</Cell>
            <Cell label="Commission" className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(sale.commission)}</Cell>
            
            <Cell label="Unit Count" className={`${detailCellClasses} text-center font-bold`}>{sale.count}</Cell>
            <Cell label="Date" className={detailCellClasses}>{sale.date}</Cell>
            <Cell label="Stock #" className={detailCellClasses}>{sale.stockNumber}</Cell>
            <Cell label="New/Used" className={detailCellClasses}>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ sale.newOrUsed === VehicleType.NEW ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300' }`}>{sale.newOrUsed}</span>
            </Cell>
            <Cell label="Store" className={detailCellClasses}>{sale.store}</Cell>
            <Cell label="Trade" className={detailCellClasses}>{sale.trade ? 'Yes' : 'No'}</Cell>
            <Cell label="Front Gross" className={detailCellClasses}>{formatCurrency(sale.frontGross)}</Cell>
            <Cell label="Back Gross" className={detailCellClasses}>{formatCurrency(sale.backGross)}</Cell>
            {!onDeliver && <Cell label="Cumulative" className={`${detailCellClasses} font-medium text-blue-600 dark:text-blue-400`}>{formatCurrency(sale.viewCumulativeGross || 0)}</Cell>}
            
            <Cell label="Actions">
                <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-end md:justify-start gap-4 w-full">
                    {onDeliver && <button onClick={() => onDeliver(sale.id)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium flex items-center gap-1"><DeliverIcon /> Deliver</button>}
                    <button onClick={() => onEditClick(sale)} className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium">Edit</button>
                    <button onClick={() => onDelete(sale.id)} className="text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 font-medium flex items-center gap-1"><TrashIcon /></button>
                    <div className="ml-auto md:hidden">
                        <ChevronDownIcon className={`w-5 h-5 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </Cell>
        </tr>
    );
}

const Cell: React.FC<{label: string, children: React.ReactNode, className?: string}> = ({label, children, className}) => (
    <td className={`p-3 md:px-4 md:py-3 text-sm flex justify-between items-center md:table-cell md:whitespace-nowrap text-slate-600 dark:text-slate-300 border-b border-gray-200 dark:border-slate-700 md:border-0 ${className}`}>
        <span className="font-bold text-slate-800 dark:text-white md:hidden mr-2">{label}</span>
        {children}
    </td>
)

interface EditableRowProps { saleData: Sale; onEditChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void; onSave: () => void; onCancel: () => void; role: string; onUnwind?: () => void; }
const EditableRow: React.FC<EditableRowProps> = ({ saleData, onEditChange, onSave, onCancel, role, onUnwind }) => {
    const inputClass = "block w-full bg-gray-200 dark:bg-slate-600 text-slate-900 dark:text-white rounded p-1 text-sm border border-gray-300 dark:border-slate-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

    return (
         <tr className="bg-gray-100 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
            <td colSpan={15} className="p-4">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white md:hidden mb-4">Editing Sale</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Field label="Date"><input type="date" name="date" value={saleData.date} onChange={onEditChange} className={inputClass} /></Field>
                    <Field label="Stock #"><input name="stockNumber" value={saleData.stockNumber} onChange={onEditChange} className={inputClass} /></Field>
                    <Field label="Customer"><input name="customerName" value={saleData.customerName} onChange={onEditChange} className={inputClass} /></Field>
                    {role === 'manager' && <Field label="Salesperson"><input name="salesperson" value={saleData.salesperson} onChange={onEditChange} className={inputClass} /></Field>}
                    <Field label="Store"><input name="store" value={saleData.store} onChange={onEditChange} className={inputClass} /></Field>
                    <Field label="Year"><input type="number" name="year" value={saleData.year} onChange={onEditChange} className={inputClass} /></Field>
                    <Field label="Make"><input name="make" value={saleData.make} onChange={onEditChange} className={inputClass} /></Field>
                    <Field label="Model"><input name="model" value={saleData.model} onChange={onEditChange} className={inputClass} /></Field>
                    <Field label="New / Used"><select name="newOrUsed" value={saleData.newOrUsed} onChange={onEditChange} className={inputClass}><option value={VehicleType.NEW}>New</option><option value={VehicleType.USED}>Used</option></select></Field>
                    <Field label="Deal Count"><select name="count" value={saleData.count} onChange={onEditChange} className={inputClass}><option value={1}>1</option><option value={0.5}>0.5</option></select></Field>
                    <Field label="Front Gross"><input type="number" name="frontGross" value={saleData.frontGross} onChange={onEditChange} className={inputClass} step="any" /></Field>
                    <Field label="Back Gross"><input type="number" name="backGross" value={saleData.backGross} onChange={onEditChange} className={inputClass} step="any" /></Field>
                    <Field label="Commission"><input type="number" name="commission" value={saleData.commission} onChange={onEditChange} className={inputClass} step="any" /></Field>
                    <Field label="Accessory"><input type="number" name="accessory" value={saleData.accessory} onChange={onEditChange} className={inputClass} step="any" /></Field>
                    <Field label="Spiffs"><input type="number" name="spiffs" value={saleData.spiffs} onChange={onEditChange} className={inputClass} step="any" /></Field>
                    <Field label="Trade Spiff"><input type="number" name="tradeSpiff" value={saleData.tradeSpiff} onChange={onEditChange} className={inputClass} step="any" /></Field>
                    <div className="flex items-center pt-5">
                        <input id="trade-edit" type="checkbox" name="trade" checked={saleData.trade} onChange={onEditChange} className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 bg-gray-300 dark:bg-slate-600 border-gray-400 dark:border-slate-500" />
                        <label htmlFor="trade-edit" className="ml-2 text-sm text-slate-700 dark:text-slate-300">Trade-in</label>
                    </div>
                </div>
                <div className="flex items-center gap-4 justify-end mt-6">
                    {onUnwind && (
                        <button onClick={onUnwind} className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg">Unwind Deal</button>
                    )}
                    <button onClick={onCancel} className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium px-4 py-2 rounded-md">Cancel</button>
                    <button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg">Save Changes</button>
                </div>
            </td>
        </tr>
    );
};

const Field: React.FC<{label: string, children: React.ReactNode}> = ({label, children}) => (
    <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
        {children}
    </div>
)

interface OtherIncomeTableProps {
    incomes: OtherIncome[];
    onUpdate: (income: OtherIncome) => void;
    onDelete: (id: number) => void;
    editingId: number | null;
    setEditingId: (id: number | null) => void;
}
export const OtherIncomeTable: React.FC<OtherIncomeTableProps> = ({ incomes, onUpdate, onDelete, editingId, setEditingId }) => {
    const [editData, setEditData] = useState<OtherIncome | null>(null);

    const handleEditClick = (income: OtherIncome) => {
        setEditingId(income.id);
        setEditData(income);
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditData(null);
    };

    const handleSave = () => {
        if (editData) onUpdate(editData);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editData) return;
        const { name, value, type } = e.target;
        setEditData({ ...editData, [name]: type === 'number' ? parseFloat(value) : value });
    };

    const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const inputClass = "block w-full bg-gray-200 dark:bg-slate-600 text-slate-900 dark:text-white rounded p-1 text-sm border border-gray-300 dark:border-slate-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-700 dark:text-white uppercase bg-gray-100 dark:bg-slate-700/50">
                    <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {incomes.map(income => (
                        editingId === income.id && editData ? (
                            <tr key={income.id} className="bg-gray-200 dark:bg-slate-700">
                                <td className="px-4 py-2"><input type="date" name="date" value={editData.date} onChange={handleChange} className={inputClass} /></td>
                                <td className="px-4 py-2"><input name="description" value={editData.description} onChange={handleChange} className={inputClass} /></td>
                                <td className="px-4 py-2"><input type="number" step="any" name="amount" value={editData.amount} onChange={handleChange} className={inputClass} /></td>
                                <td className="px-4 py-2 text-right">
                                    <button onClick={handleSave} className="font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 mr-4">Save</button>
                                    <button onClick={handleCancel} className="font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">Cancel</button>
                                </td>
                            </tr>
                        ) : (
                            <tr key={income.id} className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{income.date}</td>
                                <td className="px-4 py-3 text-slate-900 dark:text-white">{income.description}</td>
                                <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(income.amount)}</td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => handleEditClick(income)} className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 mr-4">Edit</button>
                                    <button onClick={() => onDelete(income.id)} className="font-medium text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300">Delete</button>
                                </td>
                            </tr>
                        )
                    ))}
                </tbody>
            </table>
        </div>
    );
};


export default SalesTable;