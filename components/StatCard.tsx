
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-3 md:space-x-4">
      <div className={`p-2.5 md:p-4 rounded-lg ${color} bg-opacity-10 flex items-center justify-center`}>
        <div className="scale-75 md:scale-100 origin-center">{icon}</div>
      </div>
      <div className="overflow-hidden">
        <p className="text-xs md:text-sm font-medium text-slate-500 truncate">{title}</p>
        <h3 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{value}</h3>
      </div>
    </div>
  );
};

export default StatCard;
