import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { Transaction, TransactionType, FinancialSummary, Investment } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Landmark, PieChart as PieChartIcon, Activity } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  investments: Investment[]; // Added investments
  summary: FinancialSummary;
}

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6', '#EC4899'];

export const Dashboard: React.FC<DashboardProps> = ({ transactions, investments, summary }) => {
  
  // Prepare data for Monthly Trend Chart
  const trendData = useMemo(() => {
    const data: Record<string, { name: string; income: number; expense: number }> = {};
    transactions.forEach(t => {
      const date = new Date(t.date);
      const key = `${date.getMonth() + 1}/${date.getFullYear()}`;
      if (!data[key]) data[key] = { name: key, income: 0, expense: 0 };
      if (t.type === TransactionType.INCOME) data[key].income += t.amount;
      else data[key].expense += t.amount;
    });
    return Object.values(data).slice(-6).reverse();
  }, [transactions]);

  // Category Pie Chart
  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .forEach(t => { data[t.category] = (data[t.category] || 0) + t.amount; });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  // Stat Card Component
  const StatCard = ({ title, value, icon: Icon, color, subtext, highlight }: any) => (
    <div className={`p-6 rounded-2xl shadow-sm border flex items-start justify-between ${highlight ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'}`}>
      <div>
        <p className={`text-sm font-medium mb-1 ${highlight ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
        <h3 className={`text-2xl font-bold ${highlight ? 'text-white' : 'text-slate-800'}`}>
          {typeof value === 'number' && title !== 'Score de Saúde' 
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
            : value}
        </h3>
        {subtext && <p className={`text-xs mt-2 ${color}`}>{subtext}</p>}
      </div>
      <div className={`p-3 rounded-xl ${highlight ? 'bg-white/10' : color.replace('text-', 'bg-').replace('600', '100')}`}>
        <Icon className={`w-6 h-6 ${color} ${highlight ? 'text-white' : ''}`} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Score de Saúde" 
          value={summary.healthScore} 
          icon={Activity} 
          color={summary.healthScore > 70 ? "text-emerald-400" : summary.healthScore > 40 ? "text-amber-400" : "text-rose-400"}
          highlight={true}
          subtext={summary.healthScore > 70 ? "Excelente" : "Requer atenção"}
        />
        <StatCard 
          title="Saldo em Conta" 
          value={summary.totalBalance} 
          icon={Wallet} 
          color="text-indigo-600"
          subtext="Disponível"
        />
        <StatCard 
          title="Investimentos" 
          value={summary.investmentTotal} 
          icon={TrendingUp} 
          color="text-purple-600"
          subtext={`${investments.length} ativos custodiados`}
        />
        <StatCard 
          title="Fluxo Mensal" 
          value={summary.totalIncome - summary.totalExpense} 
          icon={DollarSign} 
          color="text-amber-600"
          subtext={`Economia: ${summary.savingsRate.toFixed(0)}%`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Fluxo de Caixa (6 Meses)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                />
                <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" name="Receitas" />
                <Area type="monotone" dataKey="expense" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" name="Despesas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown Panel */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Distribuição</h3>
          
          <div className="flex-1">
             <div className="h-48 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                      {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                  </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="mt-4 space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                {/* Fix: Creating a copy of categoryData using spread syntax before sorting */}
                {[...categoryData].sort((a,b) => b.value - a.value).map((cat, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      <span className="text-slate-600 truncate max-w-[100px]">{cat.name}</span>
                    </div>
                    <span className="font-bold text-slate-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cat.value)}</span>
                  </div>
                ))}
             </div>
          </div>
          
          {/* Quick Investment Summary */}
          {investments.length > 0 && (
             <div className="mt-6 pt-6 border-t border-slate-100">
               <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                 <PieChartIcon size={12} /> Top Investimentos
               </h4>
               <div className="space-y-2">
                  {investments.slice(0,3).map(inv => (
                    <div key={inv.id} className="flex justify-between text-xs">
                       <span className="text-slate-600">{inv.name}</span>
                       <span className="text-emerald-600 font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.amount)}</span>
                    </div>
                  ))}
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
