import React from 'react';
import { Target, Trophy } from 'lucide-react';

export const Goals = () => {
  const goals = [
    { name: 'Viagem de Férias', current: 2500, target: 5000, color: 'bg-emerald-500' },
    { name: 'Reserva de Emergência', current: 8000, target: 15000, color: 'bg-indigo-500' },
    { name: 'Novo Computador', current: 1200, target: 8000, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Metas Financeiras</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal, idx) => {
          const progress = (goal.current / goal.target) * 100;
          return (
            <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Trophy size={64} className="text-slate-800" />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl bg-slate-50`}>
                    <Target className="w-6 h-6 text-slate-700" />
                  </div>
                  <span className="text-sm font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">
                    {progress.toFixed(0)}%
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">{goal.name}</h3>
                <p className="text-slate-500 text-sm mb-4">
                  R$ {goal.current} de R$ {goal.target}
                </p>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-2.5 rounded-full ${goal.color} transition-all duration-1000 ease-out`} 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Add Goal Button Placeholder */}
        <button className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-500 hover:text-indigo-500 transition-colors h-full min-h-[200px]">
          <Target size={32} className="mb-2" />
          <span className="font-medium">Criar Nova Meta</span>
        </button>
      </div>
    </div>
  );
};
