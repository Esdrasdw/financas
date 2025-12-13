import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, CreditCard, RecurrenceType, PaymentMethod } from '../types';
import { Plus, Trash2, Search, ArrowUpCircle, ArrowDownCircle, CreditCard as CardIcon, CalendarClock, Repeat, Download, FileUp, Wand2 } from 'lucide-react';
import { getNextCardDueDate } from '../services/marketService';

interface TransactionManagerProps {
  transactions: Transaction[];
  cards: CreditCard[];
  onAdd: (transactions: Omit<Transaction, 'id'>[]) => void; // Modified to accept array
  onDelete: (id: string) => void;
  onImportFromFile: (payload: { file?: File | null; description?: string; instructions?: string }) => Promise<void>;
}

export const TransactionManager: React.FC<TransactionManagerProps> = ({ transactions, cards, onAdd, onDelete, onImportFromFile }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  
  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Geral');
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  
  // Advanced Features State
  const [recurrence, setRecurrence] = useState<RecurrenceType>('NONE');
  const [isInstallment, setIsInstallment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState(2);
  const [paidInstallments, setPaidInstallments] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importNotes, setImportNotes] = useState('');
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const paymentLabels: Record<PaymentMethod, string> = { PIX: 'PIX', CASH: 'Dinheiro', CARD: 'Cartão' };

  // Update date if card selected
  useEffect(() => {
    if (selectedCardId) {
      const card = cards.find(c => c.id === selectedCardId);
      if (card) {
        setDate(getNextCardDueDate(card.closingDay, card.dueDay));
      }
      setPaymentMethod('CARD');
    } else if (paymentMethod === 'CARD') {
      setPaymentMethod('PIX');
    }
  }, [selectedCardId, cards, paymentMethod]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const baseTransaction = {
      description,
      amount: Number(amount), // Assuming this is Total Amount for installments
      category,
      type,
      cardId: selectedCardId || undefined,
      recurrence: recurrence,
      paymentMethod: selectedCardId ? 'CARD' : paymentMethod,
    };

    const newTransactions: Omit<Transaction, 'id'>[] = [];

    if (isInstallment && type === TransactionType.EXPENSE) {
      const installmentAmount = baseTransaction.amount / totalInstallments;
      const remainingInstallments = totalInstallments - paidInstallments;

      for (let i = 1; i <= remainingInstallments; i++) {
        const currentNumber = paidInstallments + i;
        
        // Calculate Date
        const txDate = new Date(date);
        txDate.setMonth(txDate.getMonth() + (i - 1));
        
        newTransactions.push({
          ...baseTransaction,
          description: `${description} (${currentNumber}/${totalInstallments})`,
          amount: installmentAmount,
          date: txDate.toISOString().split('T')[0],
          isInstallment: true,
          installmentCurrent: currentNumber,
          installmentTotal: totalInstallments
        });
      }
    } else {
      newTransactions.push({
        ...baseTransaction,
        date: date
      });
    }

    onAdd(newTransactions);
    resetForm();
    setIsModalOpen(false);
  };

  const resetForm = () => {
    setDescription(''); setAmount(''); setCategory('Geral'); setType(TransactionType.EXPENSE);
    setRecurrence('NONE'); setIsInstallment(false); setTotalInstallments(2); setPaidInstallments(0);
    setSelectedCardId(''); setDate(new Date().toISOString().split('T')[0]); setPaymentMethod('PIX');
  };

  const exportCSV = () => {
    const headers = "ID,Description,Amount,Type,Date,Category,PaymentMethod,CardID\n";
    const rows = transactions.map(t => 
      `${t.id},"${t.description}",${t.amount},${t.type},${t.date},${t.category},${t.paymentMethod || ''},${t.cardId || ''}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredTransactions = transactions.filter(t => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      t.description.toLowerCase().includes(search) ||
      t.category.toLowerCase().includes(search) ||
      (t.paymentMethod || '').toLowerCase().includes(search);

    const txDate = new Date(t.date);
    const validDate = !Number.isNaN(txDate.getTime());
    const matchesYear = selectedYear === 'all' || (validDate && txDate.getFullYear().toString() === selectedYear);
    const matchesMonth = selectedMonth === 'all' || (validDate && String(txDate.getMonth() + 1) === selectedMonth);

    return matchesSearch && matchesYear && matchesMonth;
  });

  const availableYears = Array.from(
    new Set(
      transactions
        .map(t => {
          const d = new Date(t.date);
          return Number.isNaN(d.getTime()) ? null : d.getFullYear().toString();
        })
        .filter((val): val is string => Boolean(val))
    )
  ).sort((a, b) => Number(b) - Number(a));

  const availableMonths = Array.from(
    new Set(
      transactions
        .map(t => {
          const d = new Date(t.date);
          return Number.isNaN(d.getTime()) ? null : d.getMonth() + 1;
        })
        .filter((val): val is number => typeof val === 'number')
    )
  ).sort((a, b) => a - b);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleImport = async () => {
    if (!selectedFile && !importText.trim()) {
      setImportFeedback('Envie um arquivo ou cole um resumo para importar.');
      return;
    }
    setIsImporting(true);
    setImportFeedback(null);
    try {
      await onImportFromFile({ file: selectedFile, instructions: importNotes, description: importText });
      setImportFeedback('Transacoes criadas automaticamente com a IA.');
      setSelectedFile(null);
      setImportNotes('');
      setImportText('');
    } catch (error: any) {
      setImportFeedback(error?.message || 'Nao foi possivel importar agora.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Transações</h2>
        <div className="flex gap-2">
          <button 
            onClick={exportCSV}
            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
            title="Exportar para Excel/CSV"
          >
            <Download size={20} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-indigo-200"
          >
            <Plus size={20} />
            Nova Transação
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Wand2 size={18} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">Importar com IA (arquivo opcional)</p>
                <p className="text-xs text-slate-500">Envie um arquivo ou apenas cole uma descricao/resumo que a IA cria as transacoes.</p>
              </div>
              <span className="text-[11px] text-slate-500">Data padrao: hoje</span>
            </div>

            <div className="flex flex-col md:flex-row gap-2">
              <label className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-slate-50 cursor-pointer hover:border-indigo-500 transition-colors">
                <div className="flex items-center gap-2">
                  <FileUp size={16} />
                  <span className="truncate">{selectedFile ? selectedFile.name : 'Selecione um arquivo (PDF, CSV, TXT, OFX)'}</span>
                </div>
                <input type="file" accept=".pdf,.txt,.csv,.ofx" className="hidden" onChange={handleFileChange} />
              </label>
              <input 
                type="text" 
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="Instrucoes para a IA (ex: salario de dez/2024 ou fatura nubank)"
                value={importNotes}
                onChange={(e) => setImportNotes(e.target.value)}
              />
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {isImporting ? 'Enviando...' : 'Importar IA'}
              </button>
            </div>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
              placeholder="Opcional: cole aqui um resumo/descricao do extrato, fatura ou das transacoes"
              rows={3}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            {importFeedback && <p className="text-xs text-amber-700">{importFeedback}</p>}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
              <Search size={16} className="text-indigo-500" />
              Filtros rápidos
            </div>
            <button
              onClick={() => { setSelectedMonth('all'); setSelectedYear('all'); setSearchTerm(''); }}
              className="text-xs font-semibold text-indigo-700 hover:underline"
            >
              Limpar filtros
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Buscar transações..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 shadow-sm min-w-[140px]"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="all">Todos os anos</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-indigo-500 shadow-sm min-w-[150px]"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">Todos os meses</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month.toString()}>
                    {new Date(2024, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short' })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Descrição</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Detalhes</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Data</th>
              <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Valor</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTransactions.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${t.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {t.type === TransactionType.INCOME ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                    </div>
                    <div>
                      <span className="font-medium text-slate-800 block">{t.description}</span>
                      {t.recurrence === 'MONTHLY' && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Mensal</span>}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      {t.category}
                    </span>
                    <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                      {paymentLabels[t.paymentMethod as PaymentMethod] || t.paymentMethod || 'Pagamento'}
                    </span>
                    {t.cardId && (
                      <span className="flex items-center gap-1 text-xs text-indigo-600">
                        <CardIcon size={10} /> Cartão
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-4 px-6 text-sm text-slate-500">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                <td className={`py-4 px-6 text-right font-bold ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {t.type === TransactionType.EXPENSE ? '-' : '+'}
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                </td>
                <td className="py-4 px-6 text-right">
                  <button onClick={() => onDelete(t.id)} className="text-slate-400 hover:text-rose-500 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up my-8">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Nova Movimentação</h3>
              <button onClick={() => {setIsModalOpen(false); resetForm();}} className="text-white/80 hover:text-white">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Type Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                  type="button" 
                  onClick={() => setType(TransactionType.EXPENSE)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${type === TransactionType.EXPENSE ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Despesa
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setType(TransactionType.INCOME);
                    setIsInstallment(false);
                    setSelectedCardId('');
                    setPaymentMethod('PIX');
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${type === TransactionType.INCOME ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Receita
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <input required type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Compra Online, Salário..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total</label>
                  <input required type="number" step="0.01" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                </div>
                 <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input required type="date" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                  <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={category} onChange={e => setCategory(e.target.value)}>
                    <option>Geral</option>
                    <option>Alimentação</option>
                    <option>Moradia</option>
                    <option>Transporte</option>
                    <option>Lazer</option>
                    <option>Saúde</option>
                    <option>Salário</option>
                    <option>Investimentos</option>
                    <option>Educação</option>
                    <option>Compras</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Meio de pagamento</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    disabled={type === TransactionType.EXPENSE && Boolean(selectedCardId)}
                  >
                    <option value="PIX">PIX / Transferência</option>
                    <option value="CASH">Dinheiro</option>
                    <option value="CARD">Cartão</option>
                  </select>
                  {type === TransactionType.EXPENSE && selectedCardId && (
                    <p className="text-[10px] text-slate-500 mt-1">Cartão selecionado define o meio de pagamento.</p>
                  )}
                </div>
                {type === TransactionType.EXPENSE && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cartão de Crédito</label>
                    <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)}>
                      <option value="">Nenhum / Débito</option>
                      {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Advanced Options Toggle */}
              {type === TransactionType.EXPENSE && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex gap-4">
                     <label className={`flex-1 border rounded-xl p-3 cursor-pointer transition-colors ${recurrence === 'MONTHLY' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" 
                            checked={recurrence === 'MONTHLY'} onChange={() => {
                              setRecurrence(recurrence === 'MONTHLY' ? 'NONE' : 'MONTHLY');
                              setIsInstallment(false);
                            }} 
                          />
                          <Repeat size={16} className="text-slate-600" />
                          <span className="text-sm font-bold text-slate-700">Recorrente (Mensal)</span>
                        </div>
                        <p className="text-xs text-slate-500 pl-6">Repete todo mês (Ex: Netflix, Aluguel)</p>
                     </label>

                     <label className={`flex-1 border rounded-xl p-3 cursor-pointer transition-colors ${isInstallment ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded"
                             checked={isInstallment} onChange={() => {
                               setIsInstallment(!isInstallment);
                               setRecurrence('NONE');
                             }}
                          />
                          <CalendarClock size={16} className="text-slate-600" />
                          <span className="text-sm font-bold text-slate-700">Parcelado</span>
                        </div>
                        <p className="text-xs text-slate-500 pl-6">Divide o valor em meses futuros</p>
                     </label>
                  </div>

                  {isInstallment && (
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Qtd. Total Parcelas</label>
                        <input type="number" min="2" max="60" className="w-full px-3 py-2 border rounded-lg outline-none"
                          value={totalInstallments} onChange={e => setTotalInstallments(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Já pagas (Colar)</label>
                        <input type="number" min="0" max={totalInstallments - 1} className="w-full px-3 py-2 border rounded-lg outline-none"
                          value={paidInstallments} onChange={e => setPaidInstallments(Number(e.target.value))} />
                        <p className="text-[10px] text-slate-500 mt-1">Gera apenas as {totalInstallments - paidInstallments} restantes.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-indigo-200">
                Confirmar Transação
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
