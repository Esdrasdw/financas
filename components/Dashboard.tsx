import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { Transaction, TransactionType, FinancialSummary, Investment } from '../types';
import { TrendingUp, DollarSign, Wallet, PieChart as PieChartIcon, Activity, CalendarRange, Clock3 } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  investments: Investment[];
  summary: FinancialSummary;
}

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#6366F1', '#8B5CF6', '#EC4899'];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const Dashboard: React.FC<DashboardProps> = ({ transactions, investments, summary }) => {
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (!Number.isNaN(d.getTime())) set.add(monthKey(d));
    });
    const list = Array.from(set);
    list.sort((a, b) => b.localeCompare(a));
    return list.length ? list : [monthKey(new Date())];
  }, [transactions]);

  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]);
  const selectedMonthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  const monthTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const d = new Date(t.date);
        if (Number.isNaN(d.getTime())) return false;
        return monthKey(d) === selectedMonth;
      }),
    [transactions, selectedMonth]
  );

  const monthSummary = useMemo(() => {
    const income = monthTransactions.filter((t) => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const expense = monthTransactions.filter((t) => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
    const balance = income - expense;
    const savedRate = income > 0 ? ((income - expense) / income) * 100 : 0;
    return { income, expense, balance, savedRate };
  }, [monthTransactions]);

  const trendData = useMemo(() => {
    const data: Record<string, { name: string; income: number; expense: number; key: string }> = {};
    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) return;
      const key = monthKey(d);
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      if (!data[key]) data[key] = { name: label, income: 0, expense: 0, key };
      if (t.type === TransactionType.INCOME) data[key].income += t.amount;
      else data[key].expense += t.amount;
    });
    return Object.values(data)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12);
  }, [transactions]);

  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    monthTransactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .forEach((t) => {
        data[t.category] = (data[t.category] || 0) + t.amount;
      });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [monthTransactions]);

  const StatCard = ({ title, value, icon: Icon, color, subtext, highlight }: any) => (
    <div
      className={`p-6 rounded-2xl shadow-sm border flex items-start justify-between ${
        highlight ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'
      }`}
    >
      <div>
        <p className={`text-sm font-medium mb-1 ${highlight ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
        <h3 className={`text-2xl font-bold ${highlight ? 'text-white' : 'text-slate-800'}`}>
          {typeof value === 'number' && title !== 'Score de Saúde' ? formatCurrency(value) : value}
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
      {/* Heading */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase font-semibold text-slate-500">Foco do mês</p>
          <h2 className="text-2xl font-bold text-slate-800">{selectedMonthLabel}</h2>
          <p className="text-sm text-slate-500">Organize o mês e enxergue o próximo ano com clareza.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm shadow-sm"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {monthOptions.map((opt) => {
              const [y, m] = opt.split('-').map(Number);
              return (
                <option key={opt} value={opt}>
                  {new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </option>
              );
            })}
          </select>
          <span className="px-3 py-2 text-xs rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
            12 meses no gráfico
          </span>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Score de Saúde"
          value={summary.healthScore}
          icon={Activity}
          color={summary.healthScore > 70 ? 'text-emerald-400' : summary.healthScore > 40 ? 'text-amber-400' : 'text-rose-400'}
          highlight={true}
          subtext={summary.healthScore > 70 ? 'Excelente' : 'Requer atenção'}
        />
        <StatCard
          title="Saldo do Mês"
          value={monthSummary.balance}
          icon={Wallet}
          color="text-indigo-600"
          subtext={`Entrada: ${formatCurrency(monthSummary.income)}`}
        />
        <StatCard
          title="Giro do Mês"
          value={monthSummary.income - monthSummary.expense}
          icon={DollarSign}
          color="text-amber-600"
          subtext={`Economia: ${monthSummary.savedRate.toFixed(0)}%`}
        />
        <StatCard
          title="Investimentos"
          value={summary.investmentTotal}
          icon={TrendingUp}
          color="text-purple-600"
          subtext={`${investments.length} ativos custodiados`}
        />
      </div>

      {/* Key sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly detail */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CalendarRange size={18} /> Mês selecionado
            </h3>
            <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {monthTransactions.length} lançamentos
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
              <p className="text-xs font-semibold text-indigo-700 uppercase">Receitas</p>
              <h4 className="text-2xl font-bold text-indigo-900 mt-1">{formatCurrency(monthSummary.income)}</h4>
              <p className="text-xs text-indigo-700/70 mt-1">Entradas previstas e recebidas neste mês.</p>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
              <p className="text-xs font-semibold text-rose-700 uppercase">Despesas</p>
              <h4 className="text-2xl font-bold text-rose-900 mt-1">{formatCurrency(monthSummary.expense)}</h4>
              <p className="text-xs text-rose-700/70 mt-1">Saídas e parcelas lançadas para este mês.</p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-700">Categorias do mês</h4>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <PieChartIcon size={14} /> Distribuição de despesas
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                {[...categoryData].sort((a, b) => b.value - a.value).map((cat, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 px-3 py-2 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      <span className="text-slate-700 truncate max-w-[140px]">{cat.name}</span>
                    </div>
                    <span className="font-bold text-slate-800">{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Long-term view */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock3 size={18} /> Próximos 12 meses
            </h3>
            <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Visão anual
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" name="Receitas" />
                <Area type="monotone" dataKey="expense" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" name="Despesas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-sm font-bold text-slate-700 mb-3">Top 3 Investimentos</h4>
            {investments.length === 0 ? (
              <p className="text-xs text-slate-500">Cadastre um investimento para acompanhar aqui.</p>
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={investments.slice(0, 3)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis hide />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="amount" fill="#6366F1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
