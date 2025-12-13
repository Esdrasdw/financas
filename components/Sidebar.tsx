import React from 'react';
import { LayoutDashboard, List, Sparkles, Target, LogOut, TrendingUp, CreditCard, CalendarDays, PieChart, Calculator, BarChart3 } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transações', icon: List },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'calendar', label: 'Calendário', icon: CalendarDays },
    { id: 'budgets', label: 'Orçamentos', icon: PieChart },
    { id: 'cards', label: 'Cartões', icon: CreditCard },
    { id: 'investments', label: 'Investimentos', icon: TrendingUp },
    { id: 'goals', label: 'Metas', icon: Target },
    { id: 'tools', label: 'Ferramentas', icon: Calculator },
    { id: 'ai-advisor', label: 'AI Advisor', icon: Sparkles },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-slate-900 text-white fixed left-0 top-0 overflow-y-auto z-20">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-gradient-to-tr from-emerald-400 to-indigo-500 rounded-lg shadow-lg shadow-indigo-900/50"></div>
          <h1 className="text-xl font-bold tracking-tight">Finanças Pro</h1>
        </div>
        
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id as ViewState)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 font-medium' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-8 border-t border-slate-800">
        <button className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors w-full px-4 py-2 hover:bg-slate-800 rounded-xl">
          <LogOut size={20} />
          <span className="font-medium text-sm">Sair</span>
        </button>
      </div>
    </aside>
  );
};
