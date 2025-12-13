import React, { useState, useMemo, useEffect } from 'react';
import { Investment } from '../types';
import { TrendingUp, Plus, BarChart3, Pencil, Trash2, X } from 'lucide-react';
import { calculateInvestmentReturn, DEFAULT_CDI_RATE, getCurrentCdiRate } from '../services/marketService';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface InvestmentsProps {
  investments: Investment[];
  onAdd: (inv: Investment) => void;
  onUpdate: (inv: Investment) => void;
  onDelete: (id: string) => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const Investments: React.FC<InvestmentsProps> = ({ investments, onAdd, onUpdate, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<Investment['type']>('CDB');
  const [percentageOfCDI, setPercentageOfCDI] = useState('100');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cdiRate, setCdiRate] = useState(DEFAULT_CDI_RATE);
  const [cdiMeta, setCdiMeta] = useState<{ updatedAt?: string | null; source?: string }>({});
  const [isLoadingCdi, setIsLoadingCdi] = useState(false);
  const [cdiError, setCdiError] = useState<string | null>(null);

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

  const totalInvested = investments.reduce((acc, inv) => acc + inv.amount, 0);

  const projectionData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 12; i++) {
      let totalValue = 0;
      investments.forEach(inv => {
        totalValue += calculateInvestmentReturn(inv.amount, inv.percentageOfCDI, i, cdiRate);
      });
      if (investments.length === 0 && i === 0) totalValue = 0; 
      
      data.push({
        month: i === 0 ? 'Hoje' : `Mes ${i}`,
        value: totalValue
      });
    }
    return data;
  }, [investments, cdiRate]);

  const estimatedMonthlyReturn = totalInvested
    ? calculateInvestmentReturn(totalInvested, 100, 1, cdiRate) - totalInvested
    : 0;

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setAmount('');
    setType('CDB');
    setPercentageOfCDI('100');
    setStartDate(new Date().toISOString().split('T')[0]);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (inv: Investment) => {
    setEditingId(inv.id);
    setName(inv.name);
    setAmount(String(inv.amount));
    setType(inv.type);
    setPercentageOfCDI(String(inv.percentageOfCDI));
    setStartDate(inv.startDate || new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Investment = {
      id: editingId || Math.random().toString(36).substr(2, 9),
      name: name.trim() || "Investimento",
      amount: Number(amount) || 0,
      type,
      percentageOfCDI: Number(percentageOfCDI) || 0,
      startDate: startDate || new Date().toISOString().split("T")[0]
    };

    if (editingId) {
      onUpdate(payload);
    } else {
      onAdd(payload);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    const confirmDelete = typeof window !== 'undefined' ? window.confirm('Remover este investimento?') : true;
    if (confirmDelete) {
      onDelete(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Investimentos</h2>
          <p className="text-slate-500 text-sm">
            CDI Atual:{" "}
            <span className="font-bold text-emerald-600">
              {cdiRate}% a.a. {isLoadingCdi && "(atualizando...)"}
            </span>
            {cdiMeta.updatedAt && (
              <span className="text-xs text-slate-400 ml-2">
                (ult. atualizacao {new Date(cdiMeta.updatedAt).toLocaleDateString("pt-BR")} via {cdiMeta.source})
              </span>
            )}
          </p>
          {cdiError && <p className="text-xs text-amber-600 mt-1">{cdiError}</p>}
        </div>
        <button 
          onClick={openCreateModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-200"
        >
          <Plus size={20} />
          Novo Aporte
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total Card */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-400 text-sm font-medium">Patrimonio Investido</p>
              <h3 className="text-3xl font-bold mt-1">
                {currency.format(totalInvested)}
              </h3>
            </div>
            <div className="p-3 bg-white/10 rounded-xl">
              <TrendingUp className="text-emerald-400" />
            </div>
          </div>
          <div className="text-sm text-slate-400">
            Rendimento estimado prox. mes: 
            <span className="text-emerald-400 font-bold ml-1">
               +{currency.format(estimatedMonthlyReturn)}
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-500"/>
            Projecao de Rendimento (1 Ano)
          </h3>
          <div className="h-48 w-full">
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} interval={2} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(val) => `R$${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => currency.format(value)}
                />
                <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={3} dot={false} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Ativo</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Tipo</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">% do CDI</th>
              <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Valor</th>
              <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {investments.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="py-4 px-6 font-medium text-slate-800">{inv.name}</td>
                <td className="py-4 px-6">
                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{inv.type}</span>
                </td>
                <td className="py-4 px-6 text-sm text-slate-600">{inv.percentageOfCDI}%</td>
                <td className="py-4 px-6 text-right font-bold text-slate-800">
                  {currency.format(inv.amount)}
                </td>
                <td className="py-4 px-6">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEditModal(inv)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-100"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(inv.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
             {investments.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">Nenhum investimento cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

       {/* Modal */}
       {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="bg-emerald-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">{editingId ? 'Editar Investimento' : 'Novo Investimento'}</h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-white/80 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Ativo</label>
                <input required type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
                  value={name} onChange={e => setName(e.target.value)} placeholder="Ex: CDB Nubank" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Valor (R$)</label>
                   <input required type="number" step="0.01" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
                    value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                   <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={type} onChange={e => setType(e.target.value as Investment['type'])}>
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
                  <input required type="number" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
                    value={percentageOfCDI} onChange={e => setPercentageOfCDI(e.target.value)} placeholder="100" />
                  <p className="text-xs text-slate-500 mt-1">Usamos o CDI mais recente para as projecoes.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Inicio do Investimento</label>
                  <input type="date" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg mt-4">
                {editingId ? 'Salvar alteracoes' : 'Salvar Investimento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
