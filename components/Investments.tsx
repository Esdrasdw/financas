import React, { useState, useMemo, useEffect } from 'react';
import { Contribution, Investment } from '../types';
import { TrendingUp, Plus, BarChart3, Pencil, Trash2, X, CalendarClock, ArrowUpRight, PiggyBank, Sparkles } from 'lucide-react';
import {
  calculateInvestmentValue,
  DEFAULT_CDI_RATE,
  getCurrentCdiRate,
  buildProjectionSeries,
  getReturnSnapshots,
  sumPrincipal,
} from '../services/marketService';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface InvestmentsProps {
  investments: Investment[];
  onAdd: (inv: Investment) => void;
  onUpdate: (inv: Investment) => void;
  onDelete: (id: string) => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const todayIso = () => new Date().toISOString().split('T')[0];
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('pt-BR') : '-');

const contributionPrincipal = (inv: Investment, referenceDate: Date) => {
  const contributions = inv.contributions?.length
    ? inv.contributions
    : [{ id: `${inv.id}-c1`, amount: inv.amount, date: inv.startDate }];
  return contributions.reduce((sum, c) => {
    const date = c.date ? new Date(c.date) : new Date();
    if (date > referenceDate) return sum;
    return sum + (Number(c.amount) || 0);
  }, 0);
};

const sortContributions = (items: Contribution[]) =>
  [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

export const Investments: React.FC<InvestmentsProps> = ({ investments, onAdd, onUpdate, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<Investment['type']>('CDB');
  const [percentageOfCDI, setPercentageOfCDI] = useState('100');
  const [startDate, setStartDate] = useState(() => todayIso());
  const [editingId, setEditingId] = useState<string | null>(null);

  const [projectionYears, setProjectionYears] = useState(1);
  const [cdiRate, setCdiRate] = useState(DEFAULT_CDI_RATE);
  const [cdiMeta, setCdiMeta] = useState<{ updatedAt?: string | null; source?: string }>({});
  const [isLoadingCdi, setIsLoadingCdi] = useState(false);
  const [cdiError, setCdiError] = useState<string | null>(null);

  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionDate, setContributionDate] = useState(todayIso());
  const [contributionNote, setContributionNote] = useState('');
  const [contributionTarget, setContributionTarget] = useState<Investment | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoadingCdi(true);
    getCurrentCdiRate()
      .then((data) => {
        if (!active) return;
        const parsedRate = Number(data.rate);
        setCdiRate(Number.isFinite(parsedRate) ? parsedRate : DEFAULT_CDI_RATE);
        setCdiMeta({ updatedAt: data.updatedAt, source: data.source });
        setCdiError(null);
      })
      .catch(() => {
        if (!active) return;
        setCdiRate(DEFAULT_CDI_RATE);
        setCdiError('Nao foi possivel atualizar o CDI agora.');
      })
      .finally(() => active && setIsLoadingCdi(false));

    return () => {
      active = false;
    };
  }, []);

  const today = useMemo(() => new Date(), []);

  const investmentSnapshots = useMemo(() => {
    return investments.map((inv) => {
      const contributions = inv.contributions?.length
        ? sortContributions(inv.contributions)
        : [{ id: `${inv.id}-c1`, amount: inv.amount, date: inv.startDate }];
      const principal = contributionPrincipal(inv, today);
      const currentValue = calculateInvestmentValue(inv, cdiRate, today);
      const lastContribution = contributions[contributions.length - 1];

      return { ...inv, principal, currentValue, lastContribution };
    });
  }, [investments, cdiRate, today]);

  const totals = useMemo(() => {
    const principal = sumPrincipal(investments, today);
    const currentValue = investmentSnapshots.reduce((acc, inv) => acc + inv.currentValue, 0);
    return { principal, currentValue, gain: currentValue - principal };
  }, [investmentSnapshots, investments, today]);

  const futureGain = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    const value = investments.reduce((acc, inv) => acc + calculateInvestmentValue(inv, cdiRate, target), 0);
    return value - investmentSnapshots.reduce((acc, inv) => acc + inv.currentValue, 0);
  };

  const projectionData = useMemo(
    () => buildProjectionSeries(investments, projectionYears * 12, cdiRate),
    [investments, projectionYears, cdiRate]
  );

  const snapshots = useMemo(() => getReturnSnapshots(investments, cdiRate), [investments, cdiRate]);
  const estimatedMonthlyReturn = useMemo(() => futureGain(30), [investments, cdiRate, investmentSnapshots]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setAmount('');
    setType('CDB');
    setPercentageOfCDI('100');
    setStartDate(todayIso());
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (inv: Investment) => {
    const principal = contributionPrincipal(inv, today);
    setEditingId(inv.id);
    setName(inv.name);
    setAmount(String(principal));
    setType(inv.type);
    setPercentageOfCDI(String(inv.percentageOfCDI));
    setStartDate(inv.startDate || todayIso());
    setIsModalOpen(true);
  };

  const openContributionModal = (inv: Investment) => {
    setContributionTarget(inv);
    setContributionAmount('');
    setContributionDate(todayIso());
    setContributionNote('');
    setIsContributionModalOpen(true);
  };

  const buildPayload = (base: Partial<Investment>, existing?: Investment): Investment => {
    const baseContributions =
      existing?.contributions?.length && existing.contributions.length > 0
        ? sortContributions(existing.contributions)
        : base.amount
        ? [
            {
              id: `${existing?.id || base.id}-c1`,
              amount: Number(base.amount) || 0,
              date: base.startDate || todayIso(),
            },
          ]
        : [];

    const contributions = sortContributions(baseContributions);
    const totalAmount = contributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const firstDate = contributions[0]?.date || base.startDate || todayIso();

    return {
      id: existing?.id || base.id || Math.random().toString(36).substr(2, 9),
      name: base.name || existing?.name || 'Investimento',
      type: base.type || existing?.type || 'CDB',
      percentageOfCDI: Number(base.percentageOfCDI ?? existing?.percentageOfCDI ?? 100),
      startDate: firstDate,
      amount: totalAmount,
      contributions,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload(
      {
        id: editingId || undefined,
        name: name.trim() || 'Investimento',
        type,
        percentageOfCDI,
        startDate: startDate || todayIso(),
        amount: Number(amount) || 0,
      },
      editingId ? investments.find((i) => i.id === editingId) || undefined : undefined
    );

    if (editingId) {
      onUpdate(payload);
    } else {
      onAdd(payload);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleContributionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributionTarget) return;

    const value = Number(contributionAmount) || 0;
    if (value <= 0) return;

    const existing = contributionTarget.contributions?.length ? contributionTarget.contributions : [];
    const newContribution: Contribution = {
      id: `${contributionTarget.id}-c${Date.now()}`,
      amount: value,
      date: contributionDate || todayIso(),
      note: contributionNote.trim() || undefined,
    };

    const contributions = sortContributions([...existing, newContribution]);
    const totalAmount = contributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const updated: Investment = {
      ...contributionTarget,
      contributions,
      amount: totalAmount,
      startDate: contributions[0]?.date || contributionTarget.startDate || todayIso(),
    };

    onUpdate(updated);
    setIsContributionModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const confirmDelete = typeof window !== 'undefined' ? window.confirm('Remover este investimento?') : true;
    if (confirmDelete) {
      onDelete(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <Sparkles size={14} /> Rendendo diariamente
          </p>
          <h2 className="text-2xl font-bold text-slate-800 mt-2">Investimentos</h2>
          <p className="text-slate-500 text-sm">
            CDI Atual:{' '}
            <span className="font-bold text-emerald-600">
              {cdiRate}% a.a. {isLoadingCdi && '(atualizando...)'}
            </span>
            {cdiMeta.updatedAt && (
              <span className="text-xs text-slate-400 ml-2">
                (ult. atualizacao {new Date(cdiMeta.updatedAt).toLocaleDateString('pt-BR')} via {cdiMeta.source})
              </span>
            )}
          </p>
          {cdiError && <p className="text-xs text-amber-600 mt-1">{cdiError}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={openCreateModal}
            className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-slate-300"
          >
            <Plus size={18} />
            Novo investimento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Total aportado</span>
            <PiggyBank size={18} className="text-emerald-300" />
          </div>
          <p className="text-3xl font-bold mt-2">{currency.format(totals.principal)}</p>
          <p className="text-xs text-slate-400 mt-1">Somando todos os aportes confirmados</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-lg border border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Valor atualizado</span>
            <TrendingUp size={18} className="text-emerald-600" />
          </div>
          <p className="text-3xl font-bold mt-2 text-slate-900">{currency.format(totals.currentValue)}</p>
          <p className="text-xs text-emerald-600 mt-1">Atualizado com CDI diariamente</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-5 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm">Ganho acumulado</span>
            <ArrowUpRight size={18} />
          </div>
          <p className="text-3xl font-bold mt-2">{currency.format(totals.gain)}</p>
          <p className="text-xs text-emerald-50 mt-1">Comparado ao total aportado</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Ganho diario</span>
            <CalendarClock size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{currency.format(snapshots.dailyGain)}</p>
          <p className="text-xs text-slate-500">Estimado nas proximas 24h</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Ganho semanal</span>
            <CalendarClock size={16} className="text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{currency.format(snapshots.weeklyGain)}</p>
          <p className="text-xs text-slate-500">Proxima semana completa</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Ganho anual</span>
            <CalendarClock size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{currency.format(snapshots.yearlyGain)}</p>
          <p className="text-xs text-slate-500">Projecao para 12 meses</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <BarChart3 size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Projecao de rendimento</h3>
              <p className="text-sm text-slate-500">Selecione um horizonte ate 15 anos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-600 font-medium whitespace-nowrap">Horizonte</label>
            <input
              type="range"
              min={1}
              max={15}
              value={projectionYears}
              onChange={(e) => setProjectionYears(Number(e.target.value))}
              className="w-40 accent-emerald-600"
            />
            <span className="text-sm font-semibold text-slate-700">
              {projectionYears} {projectionYears === 1 ? 'ano' : 'anos'}
            </span>
          </div>
        </div>
        <div className="h-64 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projectionData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                formatter={(value: number, _name, props) => [
                  currency.format(value),
                  `Meta ${props?.payload?.targetDate ? formatDate(props.payload.targetDate) : ''}`,
                ]}
              />
              <Area type="monotone" dataKey="value" stroke="#10B981" fill="#10B98133" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center gap-3 text-sm text-slate-600 flex-wrap">
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
            Rendimento prox. 30 dias: {currency.format(estimatedMonthlyReturn)}
          </span>
          <span className="px-3 py-1 rounded-full bg-slate-50 text-slate-700">
            Baseado em CDI diario e aportes datados
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Ativo</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Tipo</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">% do CDI</th>
              <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Aportado</th>
              <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Atual</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Ult. aporte</th>
              <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {investmentSnapshots.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6 font-medium text-slate-800">{inv.name}</td>
                <td className="py-4 px-6">
                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{inv.type}</span>
                </td>
                <td className="py-4 px-6 text-sm text-slate-600">{inv.percentageOfCDI}%</td>
                <td className="py-4 px-6 text-right font-semibold text-slate-700">
                  {currency.format(inv.principal)}
                </td>
                <td className="py-4 px-6 text-right font-bold text-emerald-700">
                  {currency.format(inv.currentValue)}
                </td>
                <td className="py-4 px-6 text-sm text-slate-600">
                  {inv.lastContribution
                    ? `${formatDate(inv.lastContribution.date)} • ${currency.format(inv.lastContribution.amount)}`
                    : '-'}
                </td>
                <td className="py-4 px-6">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openContributionModal(inv)}
                      className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-100 text-sm font-semibold"
                    >
                      Aportar
                    </button>
                    <button
                      onClick={() => openEditModal(inv)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-100"
                      title="Editar investimento"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(inv.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-100"
                      title="Excluir investimento"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {investmentSnapshots.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Nenhum investimento cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-fade-in-up">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">{editingId ? 'Editar investimento' : 'Novo investimento'}</h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-white/80 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do ativo</label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: CDB Nubank"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Aporte inicial (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={Boolean(editingId)}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {editingId ? 'Use "Aportar" para novos valores.' : 'Informe o valor do primeiro aporte.'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                    value={type}
                    onChange={(e) => setType(e.target.value as Investment['type'])}
                  >
                    <option value="CDB">CDB</option>
                    <option value="LCI">LCI</option>
                    <option value="LCA">LCA</option>
                    <option value="TESOURO">Tesouro</option>
                    <option value="FII">FII</option>
                    <option value="ACOES">Acoes</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rentabilidade (% do CDI)</label>
                  <input
                    required
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                    value={percentageOfCDI}
                    onChange={(e) => setPercentageOfCDI(e.target.value)}
                    placeholder="100"
                  />
                  <p className="text-xs text-slate-500 mt-1">Usamos o CDI diario mais recente.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data do aporte</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={Boolean(editingId)}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-lg mt-2"
              >
                {editingId ? 'Salvar alteracoes' : 'Salvar investimento'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isContributionModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-emerald-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Registrar aporte</h3>
              <button
                onClick={() => setIsContributionModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleContributionSubmit} className="p-6 space-y-4">
              <div className="text-sm text-slate-600">
                <p className="font-semibold">{contributionTarget?.name}</p>
                <p className="text-slate-500">Adicione um novo aporte com data e valor.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor do aporte (R$)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={contributionDate}
                    onChange={(e) => setContributionDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nota (opcional)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={contributionNote}
                    onChange={(e) => setContributionNote(e.target.value)}
                    placeholder="Ex: Aporte extra"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg mt-2"
              >
                Salvar aporte
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
