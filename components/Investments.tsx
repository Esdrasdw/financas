import React, { useState, useMemo } from 'react';
import { Investment } from '../types';
import { TrendingUp, Plus, DollarSign, BarChart3 } from 'lucide-react';
import { calculateInvestmentReturn, CURRENT_CDI_RATE } from '../services/marketService';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface InvestmentsProps {
  investments: Investment[];
  onAdd: (inv: Investment) => void;
  onDelete: (id: string) => void;
}

export const Investments: React.FC<InvestmentsProps> = ({ investments, onAdd, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<Investment['type']>('CDB');
  const [percentageOfCDI, setPercentageOfCDI] = useState('100');

  const totalInvested = investments.reduce((acc, inv) => acc + inv.amount, 0);

  // Projection Data for Chart (Next 12 Months)
  const projectionData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 12; i++) {
      let totalValue = 0;
      investments.forEach(inv => {
        totalValue += calculateInvestmentReturn(inv.amount, inv.percentageOfCDI, i);
      });
      // If no investments, simulate with a hypothetical 10k at 100% CDI for visualization
      if (investments.length === 0 && i === 0) totalValue = 0; 
      
      data.push({
        month: i === 0 ? 'Hoje' : `Mês ${i}`,
        value: totalValue
      });
    }
    return data;
  }, [investments]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: Math.random().toString(36).substr(2, 9),
      name,
      amount: Number(amount),
      type,
      percentageOfCDI: Number(percentageOfCDI),
      startDate: new Date().toISOString()
    });
    setIsModalOpen(false);
    setName('');
    setAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Investimentos</h2>
          <p className="text-slate-500 text-sm">CDI Atual: <span className="font-bold text-emerald-600">{CURRENT_CDI_RATE}% a.a.</span></p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
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
              <p className="text-slate-400 text-sm font-medium">Patrimônio Investido</p>
              <h3 className="text-3xl font-bold mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInvested)}
              </h3>
            </div>
            <div className="p-3 bg-white/10 rounded-xl">
              <TrendingUp className="text-emerald-400" />
            </div>
          </div>
          <div className="text-sm text-slate-400">
            Rendimento estimado próx. mês: 
            <span className="text-emerald-400 font-bold ml-1">
               +{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                 calculateInvestmentReturn(totalInvested, 100, 1) - totalInvested
               )}
            </span>
          </div>
        </div>

        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-500"/>
            Projeção de Rendimento (1 Ano)
          </h3>
          <div className="h-48 w-full">
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} interval={2} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(val) => `R$${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
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
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Rentabilidade</th>
              <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {investments.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="py-4 px-6 font-medium text-slate-800">{inv.name}</td>
                <td className="py-4 px-6">
                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{inv.type}</span>
                </td>
                <td className="py-4 px-6 text-sm text-slate-600">{inv.percentageOfCDI}% do CDI</td>
                <td className="py-4 px-6 text-right font-bold text-slate-800">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.amount)}
                </td>
              </tr>
            ))}
             {investments.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">Nenhum investimento cadastrado.</td>
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
              <h3 className="text-white font-bold text-lg">Novo Investimento</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white">✕</button>
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
                    value={type} onChange={e => setType(e.target.value as any)}>
                      <option value="CDB">CDB</option>
                      <option value="LCI">LCI/LCA</option>
                      <option value="TESOURO">Tesouro</option>
                      <option value="FII">FII</option>
                   </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rentabilidade (% do CDI)</label>
                <input required type="number" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
                  value={percentageOfCDI} onChange={e => setPercentageOfCDI(e.target.value)} placeholder="100" />
                <p className="text-xs text-slate-500 mt-1">Isso será usado para estimar ganhos futuros.</p>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg mt-4">Salvar Investimento</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
