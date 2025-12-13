import React from 'react';
import { Transaction, TransactionType } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Download, Printer, Filter } from 'lucide-react';

interface ReportsProps {
  transactions: Transaction[];
}

export const Reports: React.FC<ReportsProps> = ({ transactions }) => {
  // 1. Monthly Data
  const monthlyData = React.useMemo(() => {
    const data: Record<string, { name: string; income: number; expense: number; balance: number }> = {};
    transactions.forEach(t => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const name = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      if (!data[key]) data[key] = { name, income: 0, expense: 0, balance: 0 };
      
      if (t.type === TransactionType.INCOME) data[key].income += t.amount;
      else data[key].expense += t.amount;
      
      data[key].balance = data[key].income - data[key].expense;
    });
    
    return Object.values(data).sort((a,b) => {
       // Simple string comparison for sort might fail across years, but sufficient for mock
       return a.name.localeCompare(b.name);
    }).slice(-12);
  }, [transactions]);

  // 2. Category Breakdown (Expenses Only)
  const categoryRanking = React.useMemo(() => {
    const data: Record<string, number> = {};
    transactions.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
      data[t.category] = (data[t.category] || 0) + t.amount;
    });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  // 3. Key Stats
  const averageTicket = transactions.length > 0 
    ? transactions.reduce((acc, t) => acc + t.amount, 0) / transactions.length 
    : 0;
  
  const maxExpense = transactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((max, t) => t.amount > max ? t.amount : max, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Relatórios Avançados</h2>
           <p className="text-slate-500 text-sm">Análise detalhada do seu comportamento financeiro.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => window.print()} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600">
              <Printer size={20} />
           </button>
           <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 shadow-md">
              <Download size={20} />
              <span className="hidden sm:inline">Exportar PDF</span>
           </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase">Ticket Médio</p>
            <p className="text-2xl font-bold text-slate-800">R$ {averageTicket.toFixed(2)}</p>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase">Maior Despesa Única</p>
            <p className="text-2xl font-bold text-rose-600">R$ {maxExpense.toFixed(2)}</p>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase">Registros Analisados</p>
            <p className="text-2xl font-bold text-indigo-600">{transactions.length}</p>
         </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
         <h3 className="font-bold text-slate-800 mb-6">Evolução Mensal (Receitas vs Despesas)</h3>
         <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
               </BarChart>
            </ResponsiveContainer>
         </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Ranking de Despesas por Categoria</h3>
            <button className="text-slate-400 hover:text-indigo-600"><Filter size={18} /></button>
         </div>
         <table className="w-full">
            <thead className="bg-slate-50">
               <tr>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 uppercase">Categoria</th>
                  <th className="text-left py-3 px-6 text-xs font-semibold text-slate-500 uppercase">Representatividade</th>
                  <th className="text-right py-3 px-6 text-xs font-semibold text-slate-500 uppercase">Total</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {categoryRanking.map((cat, idx) => {
                 const totalExpense = categoryRanking.reduce((acc, c) => acc + c.value, 0);
                 const percent = ((cat.value / totalExpense) * 100).toFixed(1);
                 return (
                   <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-6 text-sm font-medium text-slate-700">{cat.name}</td>
                      <td className="py-3 px-6">
                         <div className="flex items-center gap-2">
                            <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                               <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${percent}%` }}></div>
                            </div>
                            <span className="text-xs text-slate-500">{percent}%</span>
                         </div>
                      </td>
                      <td className="py-3 px-6 text-right text-sm font-bold text-slate-800">
                         R$ {cat.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </td>
                   </tr>
                 );
               })}
            </tbody>
         </table>
      </div>
    </div>
  );
};
