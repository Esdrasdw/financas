import React, { useState } from 'react';
import { Transaction, Budget, TransactionType } from '../types';
import { Plus, Trash2, PieChart, AlertTriangle } from 'lucide-react';

interface BudgetsProps {
  budgets: Budget[];
  transactions: Transaction[];
  onAdd: (budget: Budget) => void;
  onDelete: (id: string) => void;
}

export const Budgets: React.FC<BudgetsProps> = ({ budgets, transactions, onAdd, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState('Alimentação');
  const [limit, setLimit] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: Math.random().toString(36).substr(2, 9),
      category,
      limit: Number(limit)
    });
    setIsModalOpen(false);
    setLimit('');
  };

  const getSpentAmount = (category: string) => {
    const now = new Date();
    return transactions
      .filter(t => 
        t.category === category && 
        t.type === TransactionType.EXPENSE &&
        new Date(t.date).getMonth() === now.getMonth() &&
        new Date(t.date).getFullYear() === now.getFullYear()
      )
      .reduce((acc, t) => acc + t.amount, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Orçamentos Mensais</h2>
           <p className="text-slate-500 text-sm">Controle seus gastos por categoria neste mês</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-200"
        >
          <Plus size={20} />
          Definir Limite
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {budgets.map(budget => {
          const spent = getSpentAmount(budget.category);
          const percentage = Math.min((spent / budget.limit) * 100, 100);
          const remaining = budget.limit - spent;
          const isOver = spent > budget.limit;

          let colorClass = 'bg-emerald-500';
          if (percentage > 70) colorClass = 'bg-amber-500';
          if (percentage > 90) colorClass = 'bg-rose-500';

          return (
            <div key={budget.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${isOver ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                    {isOver ? <AlertTriangle size={24} /> : <PieChart size={24} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{budget.category}</h3>
                    <p className="text-xs text-slate-500">Limite: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(budget.limit)}</p>
                  </div>
                </div>
                <button onClick={() => onDelete(budget.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="mb-2 flex justify-between text-sm font-medium">
                <span className={isOver ? 'text-rose-600' : 'text-slate-700'}>
                  Gasto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(spent)}
                </span>
                <span className="text-slate-400">
                  Restante: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, remaining))}
                </span>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${colorClass}`} 
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              
              {isOver && (
                <p className="text-xs text-rose-500 mt-2 font-medium">Você excedeu o orçamento em {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(remaining))}</p>
              )}
            </div>
          );
        })}
        
        {budgets.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
            <PieChart size={48} className="mb-4 opacity-50" />
            <p>Nenhum orçamento definido.</p>
            <p className="text-sm">Crie limites para categorias como "Alimentação" ou "Lazer" para economizar mais.</p>
          </div>
        )}
      </div>

       {/* Modal */}
       {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Novo Orçamento</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={category} onChange={e => setCategory(e.target.value)}>
                    <option>Alimentação</option>
                    <option>Moradia</option>
                    <option>Transporte</option>
                    <option>Lazer</option>
                    <option>Saúde</option>
                    <option>Educação</option>
                    <option>Compras</option>
                    <option>Geral</option>
                  </select>
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Limite Mensal (R$)</label>
                 <input required type="number" step="0.01" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                  value={limit} onChange={e => setLimit(e.target.value)} />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg mt-4">Salvar Orçamento</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
