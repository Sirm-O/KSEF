import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartData {
  name: string;
  projects: number;
}

interface RegionBarChartProps {
  data: ChartData[];
}

const RegionBarChart: React.FC<RegionBarChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-text-muted-light dark:text-text-muted-dark">No project data to display.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
        <XAxis dataKey="name" tick={{ fill: '#94A3B8' }} />
        <YAxis tick={{ fill: '#94A3B8' }} />
        <Tooltip 
            cursor={{fill: 'rgba(128, 128, 128, 0.1)'}}
            contentStyle={{
                backgroundColor: 'rgba(30, 41, 59, 0.8)',
                borderColor: '#00A8E8',
                color: '#E2E8F0'
            }}
        />
        <Legend />
        <Bar dataKey="projects" fill="#00A8E8" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default RegionBarChart;
