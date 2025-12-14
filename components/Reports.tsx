import React from 'react';
import { Transaction, TransactionType } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Download, Printer, Filter } from 'lucide-react';

interface ReportsProps {
  transactions: Transaction[];
}

export const Reports: React.FC<ReportsProps> = ({ transactions }) => {
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const percentage = (part: number, total: number) => {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((part / total) * 100));
  };
  const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const parseMonthKey = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    return new Date(year, (month || 1) - 1, 1);
  };
  const today = React.useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = React.useState<string>(monthKey(today));

  const availableMonths = React.useMemo(() => {
    const keys = new Set<string>(['all', monthKey(today)]);
    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (!Number.isNaN(d.getTime())) keys.add(monthKey(d));
    });
    return Array.from(keys).sort((a, b) => {
      if (a === 'all') return -1;
      if (b === 'all') return 1;
      return b.localeCompare(a);
    });
  }, [transactions, today]);

  const referenceDate = selectedMonth === 'all' ? today : parseMonthKey(selectedMonth);
  const referenceLabel =
    selectedMonth === 'all'
      ? 'Todos os meses'
      : referenceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const monthTransactions = React.useMemo(
    () =>
      selectedMonth === 'all'
        ? [...transactions]
        : transactions.filter((t) => {
            const d = new Date(t.date);
            if (Number.isNaN(d.getTime())) return false;
            return monthKey(d) === selectedMonth;
          }),
    [selectedMonth, transactions]
  );

  const monthIncomeReceived = React.useMemo(
    () => monthTransactions.filter((t) => t.type === TransactionType.INCOME && t.status === 'PAID').reduce((acc, t) => acc + t.amount, 0),
    [monthTransactions]
  );
  const monthIncomePending = React.useMemo(
    () => monthTransactions.filter((t) => t.type === TransactionType.INCOME && t.status === 'PENDING').reduce((acc, t) => acc + t.amount, 0),
    [monthTransactions]
  );
  const monthExpensePaid = React.useMemo(
    () => monthTransactions.filter((t) => t.type === TransactionType.EXPENSE && t.status === 'PAID').reduce((acc, t) => acc + t.amount, 0),
    [monthTransactions]
  );
  const monthExpensePending = React.useMemo(
    () => monthTransactions.filter((t) => t.type === TransactionType.EXPENSE && t.status === 'PENDING').reduce((acc, t) => acc + t.amount, 0),
    [monthTransactions]
  );
  const projectedBalance = monthIncomeReceived + monthIncomePending - (monthExpensePaid + monthExpensePending);
  const realizedBalance = monthIncomeReceived - monthExpensePaid;
  const pendingTransactions = React.useMemo(
    () => monthTransactions.filter((t) => (t.status || 'PENDING') === 'PENDING'),
    [monthTransactions]
  );
  const nonCardTransactions = React.useMemo(() => monthTransactions.filter((t) => !t.cardId), [monthTransactions]);
  const paidNonCard = React.useMemo(
    () => nonCardTransactions.filter((t) => (t.status || 'PENDING') === 'PAID'),
    [nonCardTransactions]
  );
  const pendingNonCard = React.useMemo(
    () => nonCardTransactions.filter((t) => (t.status || 'PENDING') === 'PENDING'),
    [nonCardTransactions]
  );

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

      <div className="bg-white/90 backdrop-blur-sm p-5 rounded-3xl shadow-lg border border-slate-200 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase font-semibold text-slate-500">Painel detalhado</p>
            <h3 className="text-lg font-bold text-slate-900">{referenceLabel}</h3>
            <p className="text-sm text-slate-500">Receitas, despesas, pendencias e caixa do periodo selecionado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm shadow-sm min-w-[200px]"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {availableMonths.map((month) => {
                if (month === 'all') {
                  return (
                    <option key={month} value={month}>
                      Todos os meses
                    </option>
                  );
                }
                const d = parseMonthKey(month);
                return (
                  <option key={month} value={month}>
                    {d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </option>
                );
              })}
            </select>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700">
              {pendingTransactions.length} pendencias
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
            <p className="text-xs font-semibold text-emerald-700 uppercase">Receitas</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{formatCurrency(monthIncomeReceived)}</p>
            <p className="text-xs text-emerald-700/80">A receber: {formatCurrency(monthIncomePending)}</p>
            <div className="mt-3 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${percentage(monthIncomeReceived, monthIncomeReceived + monthIncomePending)}%` }}
              ></div>
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white shadow-sm">
            <p className="text-xs font-semibold text-rose-700 uppercase">Despesas</p>
            <p className="text-2xl font-bold text-rose-900 mt-1">{formatCurrency(monthExpensePaid)}</p>
            <p className="text-xs text-rose-700/80">Pendentes: {formatCurrency(monthExpensePending)}</p>
            <div className="mt-3 h-1.5 bg-rose-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500"
                style={{ width: `${percentage(monthExpensePaid, monthExpensePaid + monthExpensePending)}%` }}
              ></div>
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white shadow-sm">
            <p className="text-xs font-semibold text-amber-700 uppercase">Pendencias</p>
            <p className="text-2xl font-bold text-amber-900 mt-1">{formatCurrency(monthExpensePending)}</p>
            <p className="text-xs text-amber-700/80">{pendingTransactions.length} itens</p>
            <div className="mt-3 h-1.5 bg-amber-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${percentage(monthExpensePending, monthExpensePending + monthExpensePaid)}%` }}
              ></div>
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white shadow-sm">
            <p className="text-xs font-semibold text-indigo-700 uppercase">Caixa</p>
            <p className="text-2xl font-bold text-indigo-900 mt-1">{formatCurrency(projectedBalance)}</p>
            <p className="text-xs text-indigo-700/80">Realizado: {formatCurrency(realizedBalance)}</p>
            <div className="mt-3 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500"
                style={{ width: `${percentage(realizedBalance, projectedBalance === 0 ? 1 : projectedBalance)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase font-semibold text-slate-500">Pagos vs pendentes</p>
                <h4 className="text-sm font-bold text-slate-800">Transacoes (sem cartao)</h4>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {nonCardTransactions.length} itens
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white border border-emerald-100 rounded-xl p-3 shadow-sm">
                <p className="text-[11px] font-semibold text-emerald-700 uppercase">Pagos</p>
                {paidNonCard.slice(0, 4).map((t) => (
                  <div key={t.id} className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800 truncate">{t.description}</span>
                      <span className="text-xs text-emerald-700">{formatCurrency(t.amount)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {new Date(t.date).toLocaleDateString('pt-BR')} - {t.category}
                    </p>
                  </div>
                ))}
                {paidNonCard.length === 0 && <p className="text-xs text-slate-500 mt-2">Nenhum pago ainda.</p>}
              </div>
              <div className="bg-white border border-amber-100 rounded-xl p-3 shadow-sm">
                <p className="text-[11px] font-semibold text-amber-700 uppercase">Pendentes</p>
                {pendingNonCard.slice(0, 4).map((t) => (
                  <div key={t.id} className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800 truncate">{t.description}</span>
                      <span className="text-xs text-amber-700">{formatCurrency(t.amount)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {new Date(t.date).toLocaleDateString('pt-BR')} - {t.category}
                    </p>
                  </div>
                ))}
                {pendingNonCard.length === 0 && <p className="text-xs text-slate-500 mt-2">Sem pendencias manuais.</p>}
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase font-semibold text-slate-500">Resumo rapido</p>
                <h4 className="text-sm font-bold text-slate-800">Saldo e previsao</h4>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {monthTransactions.length} registros
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Saldo realizado</span>
                <span className="text-sm font-bold text-slate-800">{formatCurrency(realizedBalance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Saldo projetado</span>
                <span className="text-sm font-bold text-slate-800">{formatCurrency(projectedBalance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Pendencias</span>
                <span className="text-sm font-bold text-amber-700">
                  {formatCurrency(monthExpensePending + monthIncomePending)}
                </span>
              </div>
              <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500"
                  style={{ width: `${percentage(realizedBalance, projectedBalance === 0 ? 1 : projectedBalance)}%` }}
                ></div>
              </div>
            </div>
          </div>
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
