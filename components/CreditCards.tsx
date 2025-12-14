import React, { useMemo, useState } from 'react';
import { CreditCard, Transaction, TransactionType, PaymentStatus } from '../types';
import { CreditCard as CardIcon, Plus, Calendar, Trash2 } from 'lucide-react';

interface CreditCardsProps {
  cards: CreditCard[];
  transactions: Transaction[];
  onAddCard: (card: CreditCard) => void;
  onDeleteCard: (id: string) => void;
}

export const CreditCards: React.FC<CreditCardsProps> = ({ cards, transactions, onAddCard, onDeleteCard }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [dueDay, setDueDay] = useState('10');
  const [closingDay, setClosingDay] = useState('3');
  const [color, setColor] = useState('bg-indigo-600');
  const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthKey = useMemo(() => monthKey(new Date()), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

  const availableMonths = useMemo(() => {
    const keys = new Set<string>(['all', currentMonthKey]);
    transactions
      .filter((t) => t.cardId && t.type === TransactionType.EXPENSE)
      .forEach((t) => {
        const d = new Date(t.date);
        if (!Number.isNaN(d.getTime())) keys.add(monthKey(d));
      });
    return Array.from(keys).sort((a, b) => {
      if (a === 'all') return -1;
      if (b === 'all') return 1;
      return b.localeCompare(a);
    });
  }, [transactions, currentMonthKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddCard({
      id: Math.random().toString(36).substr(2, 9),
      name,
      limit: Number(limit),
      dueDay: Number(dueDay),
      closingDay: Number(closingDay),
      color,
    });
    setIsModalOpen(false);
    setName('');
    setLimit('');
  };

  const getCardSpending = (cardId: string) =>
    transactions
      .filter((t) => t.cardId === cardId && t.type === TransactionType.EXPENSE)
      .filter((t) => {
        const d = new Date(t.date);
        return !Number.isNaN(d.getTime()) && monthKey(d) === currentMonthKey;
      })
      .reduce((acc, t) => acc + t.amount, 0);

  const getCardOpenBalance = (cardId: string) =>
    transactions
      .filter((t) => {
        if (!(t.cardId === cardId && t.type === TransactionType.EXPENSE && t.status !== 'PAID')) return false;
        const d = new Date(t.date);
        return !Number.isNaN(d.getTime()) && monthKey(d) === currentMonthKey;
      })
      .reduce((acc, t) => acc + t.amount, 0);

  const invoices = useMemo(() => {
    const map = new Map<
      string,
      { key: string; cardId: string; cardName: string; dueDate: Date; monthKey: string; total: number; status: PaymentStatus; count: number }
    >();

    transactions
      .filter((t) => t.cardId && t.type === TransactionType.EXPENSE)
      .forEach((t) => {
        const d = new Date(t.date);
        if (Number.isNaN(d.getTime())) return;
        const key = `${t.cardId}-${monthKey(d)}`;
        const card = cards.find((c) => c.id === t.cardId);

        if (!map.has(key)) {
          map.set(key, {
            key,
            cardId: t.cardId!,
            cardName: card?.name || 'Cartao',
            dueDate: d,
            monthKey: monthKey(d),
            total: 0,
            status: 'PAID',
            count: 0,
          });
        }

        const inv = map.get(key)!;
        inv.total += t.amount;
        inv.count += 1;
        if ((t.status || 'PENDING') === 'PENDING') inv.status = 'PENDING';
      });

    return Array.from(map.values()).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [transactions, cards]);

  const visibleInvoices = useMemo(
    () => (selectedMonth === 'all' ? invoices : invoices.filter((inv) => inv.monthKey === selectedMonth)),
    [invoices, selectedMonth]
  );

  const colors = [
    'bg-indigo-600',
    'bg-purple-600',
    'bg-rose-600',
    'bg-emerald-600',
    'bg-slate-800',
    'bg-orange-500',
    'bg-blue-600',
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Meus Cartoes</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-200"
        >
          <Plus size={20} />
          Adicionar Cartao
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const spent = getCardSpending(card.id);
          const openBalance = getCardOpenBalance(card.id);
          const available = Math.max(0, card.limit - openBalance);
          const progress = Math.min((openBalance / card.limit) * 100, 100);

          return (
            <div key={card.id} className={`${card.color} rounded-2xl p-6 text-white relative overflow-hidden shadow-lg group`}>
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full"></div>
              <div className="absolute bottom-10 -left-10 w-20 h-20 bg-white opacity-5 rounded-full"></div>

              <div className="flex justify-between items-start mb-8 relative z-10">
                <CardIcon size={32} className="opacity-80" />
                <span className="text-xs font-mono opacity-60">**** **** **** {Math.floor(Math.random() * 8999 + 1000)}</span>
              </div>

              <div className="mb-6 relative z-10">
                <p className="text-xs opacity-70 mb-1">Limite Disponivel</p>
                <h3 className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(available)}
                </h3>
              </div>

              <div className="space-y-2 relative z-10">
                <div className="flex justify-between text-xs opacity-90">
                  <span>Fatura do mes: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(spent)}</span>
                  <span>Lim: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.limit)}</span>
                </div>
                <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-white h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                </div>
              </div>

              <div className="mt-6 flex justify-between items-center text-xs relative z-10 border-t border-white/10 pt-4">
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  <span>Vence dia {card.dueDay}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Fecha dia {card.closingDay}</span>
                </div>
                <button onClick={() => onDeleteCard(card.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {cards.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
            Nenhum cartao cadastrado. Adicione um para gerenciar suas faturas.
          </div>
        )}
      </div>

      <div className="bg-white/95 backdrop-blur-sm p-5 rounded-3xl shadow-lg border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase font-semibold text-slate-500">Faturas por mes</p>
            <h3 className="text-lg font-bold text-slate-900">Resumo das compras no cartao</h3>
          </div>
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
              const d = new Date(month.split('-')[0], Number(month.split('-')[1]) - 1, 1);
              return (
                <option key={month} value={month}>
                  {d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </option>
              );
            })}
          </select>
        </div>

        {visibleInvoices.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma fatura para o periodo selecionado.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleInvoices.map((inv) => (
              <div key={inv.key} className="p-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{inv.cardName}</p>
                    <p className="text-xs text-slate-500">
                      Vence em {inv.dueDate.toLocaleDateString('pt-BR')} - {inv.count} compras
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                      inv.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {inv.status === 'PAID' ? 'Paga' : 'Em aberto'}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm text-slate-600">Total</span>
                  <span className="text-base font-bold text-slate-800">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Novo Cartao</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white">x</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Cartao</label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Nubank, Visa Infinite"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Limite Total</label>
                <input
                  required
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dia do Vencimento</label>
                  <input
                    required
                    type="number"
                    max="31"
                    min="1"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dia do Fechamento</label>
                  <input
                    required
                    type="number"
                    max="31"
                    min="1"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cor do Cartao</label>
                <div className="flex gap-2 flex-wrap">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full ${c} ${color === c ? 'ring-2 ring-offset-2 ring-slate-800' : ''}`}
                    />
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg mt-4">
                Salvar Cartao
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
