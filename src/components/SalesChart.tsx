import React from 'react';
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SalesChartProps {
    data: { 
        date: string; 
        sales: number;
        cumulativeSales: number;
        cumulativeCommission: number;
    }[];
}

const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
    // Check if dark mode is enabled
    const isDarkMode = document.documentElement.classList.contains('dark');
    const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
    const textColor = isDarkMode ? '#9ca3af' : '#6b7280';

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <BarChart
                    data={data}
                    margin={{
                        top: 20,
                        right: 5,
                        left: -5,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" stroke={textColor} tick={{ fontSize: 10, fill: textColor }} />
                    <YAxis yAxisId="left" allowDecimals={false} stroke="#16a34a" tick={{ fontSize: 10, fill: textColor }} label={{ value: 'Units', angle: -90, position: 'insideLeft', fill: textColor }} />
                    <YAxis yAxisId="right" orientation="right" allowDecimals={false} stroke="#f97316" tick={{ fontSize: 10, fill: textColor }} label={{ value: 'Commission ($)', angle: 90, position: 'insideRight', fill: textColor }} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                            borderColor: isDarkMode ? '#374151' : '#e5e7eb',
                            color: isDarkMode ? '#e5e7eb' : '#1f2937',
                        }}
                        labelStyle={{ color: isDarkMode ? '#d1d5db' : '#374151' }}
                        formatter={(value: number, name: string) => {
                            if (name === 'Cumulative Commission') {
                                return [`$${value.toLocaleString('en-US')}`, name];
                            }
                            return [value, name];
                        }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar yAxisId="left" dataKey="sales" fill="#2563eb" name="Daily Units Sold" />
                    <Line yAxisId="left" type="monotone" dataKey="cumulativeSales" stroke="#16a34a" name="Cumulative Units" strokeWidth={2} dot={{ r: 4 }} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulativeCommission" stroke="#f97316" name="Cumulative Commission" strokeWidth={2} dot={{ r: 4 }} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default SalesChart;