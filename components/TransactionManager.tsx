
import React, { useState, useEffect, useMemo } from 'react';
import {
  Transaction,
  TransactionType,
  CreditCard,
  RecurrenceType,
  PaymentMethod,
  PaymentStatus,
} from '../types';
import {
  Plus,
  Trash2,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  CreditCard as CardIcon,
  CalendarClock,
  Repeat,
  Download,
  FileUp,
  Wand2,
  CheckCircle2,
  Clock3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

const toDate = (value?: string) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const parseMonthKey = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1);
};

const clampDay = (year: number, month: number, day: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
};

const addMonths = (date: Date, months: number) => {
  const base = new Date(date);
  const targetMonth = base.getMonth() + months;
  const targetYear = base.getFullYear();
  const normalized = clampDay(targetYear, targetMonth, base.getDate());
  return normalized;
};

const buildLocalId = () => Math.random().toString(36).slice(2, 11);

const calculateCardDueDate = (purchaseDate: Date, card: CreditCard) => {
  let closingYear = purchaseDate.getFullYear();
  let closingMonth = purchaseDate.getMonth();
  let closingDate = clampDay(closingYear, closingMonth, card.closingDay);

  if (purchaseDate > closingDate) {
    closingMonth += 1;
    if (closingMonth > 11) {
      closingMonth = 0;
      closingYear += 1;
    }
    closingDate = clampDay(closingYear, closingMonth, card.closingDay);
  }

  let dueMonth = closingMonth;
  let dueYear = closingYear;

  if (card.dueDay <= card.closingDay) {
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }

  const dueDate = clampDay(dueYear, dueMonth, card.dueDay);
  return { dueDate, closingDate };
};

interface CardInvoice {
  key: string;
  cardId: string;
  cardName: string;
  dueDate: Date;
  monthKey: string;
  total: number;
  status: PaymentStatus;
  items: Transaction[];
}
interface TransactionManagerProps {
  transactions: Transaction[];
  cards: CreditCard[];
  onAdd: (transactions: Omit<Transaction, 'id'>[]) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onImportFromFile: (payload: { file?: File | null; description?: string; instructions?: string }) => Promise<void>;
  onUpdateStatus?: (ids: string[], status: PaymentStatus, paidAt?: string) => void;
}

export const TransactionManager: React.FC<TransactionManagerProps> = ({
  transactions,
  cards,
  onAdd,
  onDelete,
  onDeleteMany,
  onImportFromFile,
  onUpdateStatus,
}) => {
  const today = new Date();
  const [referenceMonth, setReferenceMonth] = useState(monthKey(today));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Geral');
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [status, setStatus] = useState<PaymentStatus>('PAID');

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
  const [recurrenceMonths, setRecurrenceMonths] = useState(12);

  const paymentLabels: Record<PaymentMethod, string> = { PIX: 'PIX', CASH: 'Dinheiro', CARD: 'Cartao' };
  const statusLabels: Record<PaymentStatus, { label: string; color: string }> = {
    PENDING: { label: 'Pendente', color: 'bg-amber-100 text-amber-700 border border-amber-200' },
    PAID: { label: 'Pago', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  };
  useEffect(() => {
    if (selectedCardId) {
      setPaymentMethod('CARD');
      if (type === TransactionType.EXPENSE) {
        setStatus('PENDING');
      }
    }
  }, [selectedCardId, type]);

  useEffect(() => {
    if (!selectedCardId && paymentMethod === 'CARD') {
      setPaymentMethod('PIX');
    }
  }, [selectedCardId, paymentMethod]);

  useEffect(() => {
    if (type === TransactionType.EXPENSE && !selectedCardId && paymentMethod !== 'CARD') {
      setStatus('PAID');
    }
  }, [type, selectedCardId, paymentMethod]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const purchaseDate = toDate(date) || new Date();
    const card = selectedCardId ? cards.find((c) => c.id === selectedCardId) : null;
    const { dueDate } = card ? calculateCardDueDate(purchaseDate, card) : { dueDate: purchaseDate };

    const baseTransaction = {
      description,
      amount: Number(amount),
      category,
      type,
      cardId: selectedCardId || undefined,
      recurrence,
      paymentMethod: card ? 'CARD' : paymentMethod,
      status: card && type === TransactionType.EXPENSE ? 'PENDING' : status,
      purchaseDate: card ? purchaseDate.toISOString().split('T')[0] : undefined,
    };

    const newTransactions: Omit<Transaction, 'id'>[] = [];
    const isRecurringExpense = recurrence === 'MONTHLY' && type === TransactionType.EXPENSE && !isInstallment;

    if (isRecurringExpense) {
      const baseDate = card ? dueDate : purchaseDate;
      const recurringStatus = card ? 'PENDING' : 'PAID';
      const recurrenceId = buildLocalId();
      const monthsToGenerate = Math.max(1, recurrenceMonths || 12);

      for (let i = 0; i < monthsToGenerate; i += 1) {
        const currentDate = addMonths(baseDate, i);
        newTransactions.push({
          ...baseTransaction,
          status: recurringStatus,
          recurrenceId,
          date: currentDate.toISOString().split('T')[0],
        });
      }
    } else if (isInstallment && type === TransactionType.EXPENSE) {
      const installmentAmount = baseTransaction.amount / totalInstallments;
      const remainingInstallments = totalInstallments - paidInstallments;
      const startingDate = card ? dueDate : purchaseDate;

      for (let i = 0; i < remainingInstallments; i++) {
        const currentNumber = paidInstallments + i + 1;
        const txDate = addMonths(startingDate, i);

        newTransactions.push({
          ...baseTransaction,
          description: `${description} (${currentNumber}/${totalInstallments})`,
          amount: installmentAmount,
          date: txDate.toISOString().split('T')[0],
          isInstallment: true,
          installmentCurrent: currentNumber,
          installmentTotal: totalInstallments,
          status: card ? 'PENDING' : baseTransaction.status,
        });
      }
    } else {
      newTransactions.push({
        ...baseTransaction,
        recurrenceId: recurrence === 'MONTHLY' ? buildLocalId() : undefined,
        date: (card ? dueDate : purchaseDate).toISOString().split('T')[0],
      });
    }

    onAdd(newTransactions);
    resetForm();
    setIsModalOpen(false);
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('Geral');
    setType(TransactionType.EXPENSE);
    setRecurrence('NONE');
    setIsInstallment(false);
    setTotalInstallments(2);
    setPaidInstallments(0);
    setSelectedCardId('');
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('PIX');
    setStatus('PAID');
    setRecurrenceMonths(12);
  };

  const exportCSV = () => {
    const headers = 'ID,Description,Amount,Type,Date,Category,PaymentMethod,Status,CardID\n';
    const rows = transactions
      .map(
        (t) =>
          `${t.id},"${t.description}",${t.amount},${t.type},${t.date},${t.category},${t.paymentMethod || ''},${
            t.status || ''
          },${t.cardId || ''}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const referenceDate = useMemo(() => (referenceMonth === 'all' ? today : parseMonthKey(referenceMonth)), [referenceMonth, today]);
  const referenceLabel = useMemo(
    () => (referenceMonth === 'all' ? 'Todos os meses' : referenceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })),
    [referenceMonth, referenceDate]
  );

  const availableMonths = useMemo(() => {
    const keys = new Set<string>(['all', referenceMonth, monthKey(today)]);
    transactions.forEach((t) => {
      const d = toDate(t.date);
      if (d) keys.add(monthKey(d));
    });
    return Array.from(keys).sort((a, b) => {
      if (a === 'all') return -1;
      if (b === 'all') return 1;
      return b.localeCompare(a);
    });
  }, [transactions, referenceMonth, today]);

  const monthTransactions = useMemo(
    () =>
      referenceMonth === 'all'
        ? [...transactions]
        : transactions.filter((t) => {
            const d = toDate(t.date);
            if (!d) return false;
            return monthKey(d) === referenceMonth;
          }),
    [transactions, referenceMonth]
  );

  const stripInstallmentSuffix = (text = '') => text.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();

  const getInstallmentGroupKey = (tx: Transaction) => {
    const total = tx.installmentTotal || 0;
    if (!(tx.isInstallment || total > 1)) return null;
    const base = (tx.description || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim().toLowerCase();
    const cardMarker = tx.cardId || '';
    return `${base}__${total}__${cardMarker}`;
  };

  const aggregatedAllTransactions = useMemo(() => {
    const groups = new Map<
      string,
      Transaction & { aggregatedCount?: number }
    >();

    transactions.forEach((t) => {
      const isInstallmentGroup = t.isInstallment || (t.installmentTotal || 0) > 1;
      const key = isInstallmentGroup
        ? `installment:${getInstallmentGroupKey(t) || t.id}`
        : t.recurrenceId
        ? `recurrence:${t.recurrenceId}`
        : t.id;
      const existing = groups.get(key);
      const baseDescription = stripInstallmentSuffix(t.description) || t.description;

      if (!existing) {
        groups.set(key, {
          ...t,
          id: key,
          description: baseDescription,
          amount: t.amount,
          aggregatedCount: 1,
          status: t.status || 'PENDING',
          isInstallment: isInstallmentGroup || t.isInstallment,
          installmentCurrent: undefined,
        });
        return;
      }

      const earliestDate =
        !existing.date || new Date(existing.date) > new Date(t.date || existing.date) ? t.date || existing.date : existing.date;

      groups.set(key, {
        ...existing,
        description: baseDescription,
        amount: existing.amount + t.amount,
        status: existing.status === 'PENDING' || (t.status || 'PENDING') === 'PENDING' ? 'PENDING' : 'PAID',
        date: earliestDate,
        aggregatedCount: (existing.aggregatedCount || 1) + 1,
        isInstallment: isInstallmentGroup || existing.isInstallment,
        installmentTotal: t.installmentTotal || existing.installmentTotal,
        installmentCurrent: undefined,
      });
    });

    return Array.from(groups.values());
  }, [transactions]);

  const listForFilters = referenceMonth === 'all' ? aggregatedAllTransactions : monthTransactions;

  const filteredTransactions = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return listForFilters.filter((t) => {
      const matchesSearch =
        t.description.toLowerCase().includes(search) ||
        t.category.toLowerCase().includes(search) ||
        (t.paymentMethod || '').toLowerCase().includes(search);

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'pending'
          ? (t.status || 'PENDING') === 'PENDING'
          : (t.status || 'PENDING') === 'PAID';

      return matchesSearch && matchesStatus;
    });
  }, [listForFilters, searchTerm, statusFilter]);

  const pendingTransactions = useMemo(
    () => listForFilters.filter((t) => (t.status || 'PENDING') === 'PENDING'),
    [listForFilters]
  );

  const monthIncomeReceived = useMemo(
    () => listForFilters.filter((t) => t.type === TransactionType.INCOME && t.status === 'PAID').reduce((acc, t) => acc + t.amount, 0),
    [listForFilters]
  );

  const monthIncomePending = useMemo(
    () => listForFilters.filter((t) => t.type === TransactionType.INCOME && t.status === 'PENDING').reduce((acc, t) => acc + t.amount, 0),
    [listForFilters]
  );

  const monthExpensePaid = useMemo(
    () => listForFilters.filter((t) => t.type === TransactionType.EXPENSE && t.status === 'PAID').reduce((acc, t) => acc + t.amount, 0),
    [listForFilters]
  );

  const monthExpensePending = useMemo(
    () => listForFilters.filter((t) => t.type === TransactionType.EXPENSE && t.status === 'PENDING').reduce((acc, t) => acc + t.amount, 0),
    [listForFilters]
  );

  const projectedBalance = monthIncomeReceived + monthIncomePending - (monthExpensePaid + monthExpensePending);
  const realizedBalance = monthIncomeReceived - monthExpensePaid;

  const handleDeleteInstallments = (tx: Transaction) => {
    const key = getInstallmentGroupKey(tx);
    if (!key) {
      onDelete(tx.id);
      return;
    }
    const ids = transactions.filter((item) => getInstallmentGroupKey(item) === key).map((item) => item.id);
    const uniqueIds = Array.from(new Set(ids.length ? ids : [tx.id]));
    onDeleteMany(uniqueIds);
  };

  const handleCancelRecurrence = (tx: Transaction) => {
    if (!tx.recurrenceId) return;
    const ids = transactions.filter((item) => item.recurrenceId === tx.recurrenceId).map((item) => item.id);
    if (!ids.length) return;
    const uniqueIds = Array.from(new Set(ids));
    onDeleteMany(uniqueIds);
  };

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

  const updateStatus = (ids: string[], newStatus: PaymentStatus) => {
    if (!onUpdateStatus || !ids.length) return;
    onUpdateStatus(ids, newStatus, newStatus === 'PAID' ? new Date().toISOString() : undefined);
  };

  const shiftMonth = (delta: number) => {
    const next = addMonths(referenceDate, delta);
    setReferenceMonth(monthKey(next));
  };

  const selectedCard = selectedCardId ? cards.find((c) => c.id === selectedCardId) : null;
  const duePreview = selectedCard ? calculateCardDueDate(toDate(date) || new Date(), selectedCard).dueDate : null;
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const percentage = (part: number, total: number) => {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((part / total) * 100));
  };
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-indigo-900/30 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 text-white shadow-2xl">
        <div className="absolute inset-0 opacity-60">
          <div className="absolute -left-10 top-6 w-56 h-56 bg-emerald-500/25 blur-3xl rounded-full"></div>
          <div className="absolute right-0 -bottom-16 w-72 h-72 bg-indigo-400/30 blur-3xl rounded-full"></div>
        </div>
        <div className="relative p-6 md:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between gap-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">Aba de transacoes</p>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">Radar de movimentacoes</h2>
              <p className="text-sm md:text-base text-indigo-100 max-w-2xl">
                Interface limpa e interativa para navegar, adicionar e revisar tudo o que entra e sai da sua conta.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold">
                  {referenceLabel}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold">
                  Saldo realizado {formatCurrency(realizedBalance)}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold">
                  Projecao {formatCurrency(projectedBalance)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 w-full lg:w-auto">
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={exportCSV}
                  className="px-4 py-2 rounded-xl border border-white/30 bg-white/10 text-sm font-semibold hover:bg-white/20 backdrop-blur-sm transition-colors flex items-center gap-2"
                  title="Exportar para Excel/CSV"
                >
                  <Download size={18} /> Exportar CSV
                </button>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-white text-slate-900 text-sm font-bold shadow-lg shadow-black/20 flex items-center gap-2 hover:-translate-y-[1px] transition-all"
                >
                  <Plus size={18} /> Nova transacao
                </button>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => shiftMonth(-1)}
                  className="px-3 py-2 rounded-xl border border-white/25 bg-white/10 text-xs font-semibold flex items-center gap-2 hover:bg-white/20"
                >
                  <ChevronLeft size={14} /> Mes anterior
                </button>
                <div className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-semibold flex items-center gap-2">
                  <CalendarClock size={16} /> {referenceLabel}
                </div>
                <button
                  onClick={() => shiftMonth(1)}
                  className="px-3 py-2 rounded-xl border border-white/25 bg-white/10 text-xs font-semibold flex items-center gap-2 hover:bg-white/20"
                >
                  Proximo mes <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setShowMonthSelector((v) => !v)}
                  className="px-3 py-2 rounded-xl border border-white/25 bg-white/10 text-xs font-semibold flex items-center gap-2 hover:bg-white/20"
                >
                  <ChevronDown size={14} className={`${showMonthSelector ? 'rotate-180' : ''} transition-transform`} />
                  Selecionar mes
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase font-semibold text-indigo-100">Receitas</p>
                <span className="text-[11px] text-indigo-100/80">{formatCurrency(monthIncomePending)} a receber</span>
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(monthIncomeReceived)}</p>
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-300"
                  style={{ width: `${percentage(monthIncomeReceived, monthIncomeReceived + monthIncomePending)}%` }}
                ></div>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase font-semibold text-indigo-100">Despesas</p>
                <span className="text-[11px] text-indigo-100/80">{formatCurrency(monthExpensePending)} pendentes</span>
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(monthExpensePaid)}</p>
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-300"
                  style={{ width: `${percentage(monthExpensePaid, monthExpensePaid + monthExpensePending)}%` }}
                ></div>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase font-semibold text-indigo-100">Pendencias</p>
                <span className="text-[11px] text-indigo-100/80">{pendingTransactions.length} itens</span>
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(monthExpensePending)}</p>
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-300"
                  style={{ width: `${percentage(monthExpensePending, monthExpensePaid + monthExpensePending)}%` }}
                ></div>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase font-semibold text-indigo-100">Caixa projetado</p>
                <span className="text-[11px] text-indigo-100/80">Real: {formatCurrency(realizedBalance)}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(projectedBalance)}</p>
              <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-200"
                  style={{
                    width: `${percentage(realizedBalance, projectedBalance === 0 ? 1 : projectedBalance)}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {showMonthSelector && (
            <div className="bg-white/10 border border-white/20 rounded-2xl p-3 flex flex-wrap gap-2 backdrop-blur-sm">
              <select
                className="px-3 py-2 border border-white/30 rounded-xl bg-white/20 text-sm shadow-sm min-w-[200px] text-white"
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(e.target.value)}
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
              <p className="text-xs text-indigo-100">
                {referenceMonth === 'all'
                  ? 'Resumo consolidado de todos os meses, sem repetir parcelas.'
                  : 'Mostrando apenas transacoes e faturas deste mes.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowImport((v) => !v)}
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 bg-white shadow-sm hover:border-indigo-200"
        >
          <Wand2 size={14} className="text-indigo-600" />
          {showImport ? 'Ocultar importacao IA' : 'Importar com IA'}
        </button>
      </div>

      {showImport && (
      <div id="import-ai" className="bg-white/95 backdrop-blur-sm p-5 rounded-3xl shadow-lg border border-slate-200 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-slate-900 text-white">
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
      )}
      {/* Filters */}
      <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-lg p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Search size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Painel de filtros</p>
              <p className="text-xs text-slate-500">Use busca, status e o mes atual para refinar a lista.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-[11px] px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
              {referenceLabel}
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="text-xs font-semibold text-indigo-700 hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar transacoes..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'pending', label: 'Pendentes' },
              { key: 'paid', label: 'Pagas' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as 'all' | 'pending' | 'paid')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                  statusFilter === tab.key
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pending overview */}
      <div className="bg-gradient-to-br from-amber-50 via-white to-white p-4 rounded-3xl border border-amber-100 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase font-semibold text-amber-700">Valores pendentes</p>
            <h3 className="text-lg font-bold text-slate-800">Cartao e parcelas futuras do periodo</h3>
          </div>
          <span className="text-sm font-semibold text-amber-700 bg-white px-3 py-1 rounded-full border border-amber-200 shadow-sm">
            {pendingTransactions.length} itens
          </span>
        </div>

        {pendingTransactions.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma pendencia no momento.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingTransactions.slice(0, 6).map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-2xl border border-amber-100 bg-white/80 flex items-center justify-between shadow-sm"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800">{t.description}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(t.date).toLocaleDateString('pt-BR')} · {t.category} ·{' '}
                    {paymentLabels[t.paymentMethod as PaymentMethod] || t.paymentMethod}
                  </p>
                  {!t.cardId && (
                    <button
                      onClick={() => updateStatus([t.id], 'PAID')}
                      className="text-[11px] text-emerald-700 hover:underline"
                    >
                      Marcar como pago
                    </button>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-amber-700">
                    {t.type === TransactionType.EXPENSE ? '-' : '+'}
                    {formatCurrency(t.amount)}
                  </p>
                  {t.isInstallment && (
                    <p className="text-[11px] text-slate-500">
                      Parcela {t.installmentCurrent}/{t.installmentTotal}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 text-slate-100 border-b border-slate-200/50">
            <tr>
              <th className="text-left py-4 px-6 text-xs font-semibold uppercase tracking-wide">Descricao</th>
              <th className="text-left py-4 px-6 text-xs font-semibold uppercase tracking-wide">Detalhes</th>
              <th className="text-left py-4 px-6 text-xs font-semibold uppercase tracking-wide">Data</th>
              <th className="text-right py-4 px-6 text-xs font-semibold uppercase tracking-wide">Valor</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTransactions.map((t) => (
              <tr key={t.id} className="hover:bg-indigo-50/50 transition-colors">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        t.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                      }`}
                    >
                      {t.type === TransactionType.INCOME ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                    </div>
                    <div>
                      <span className="font-medium text-slate-800 block">{t.description}</span>
                      {t.recurrence === 'MONTHLY' && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Mensal</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-flex w-fit items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        statusLabels[(t.status || 'PENDING') as PaymentStatus]?.color || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {(t.status || 'PENDING') === 'PENDING' ? <Clock3 size={12} /> : <CheckCircle2 size={12} />}
                      {statusLabels[(t.status || 'PENDING') as PaymentStatus]?.label || 'Status'}
                    </span>
                    <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      {t.category}
                    </span>
                    <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                      {paymentLabels[t.paymentMethod as PaymentMethod] || t.paymentMethod || 'Pagamento'}
                    </span>
                    {t.cardId && (
                      <span className="flex items-center gap-1 text-xs text-indigo-600">
                        <CardIcon size={10} /> Cartao - vence {new Date(t.date).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {(t.isInstallment || (t.installmentTotal || 0) > 1) && (
                      <button
                        onClick={() => handleDeleteInstallments(t)}
                        className="text-[11px] text-rose-600 hover:underline w-fit"
                        title="Remover todas as parcelas desta compra"
                      >
                        Apagar parcelas
                      </button>
                    )}
                    {!t.cardId && (t.status || 'PENDING') === 'PENDING' && (
                      <button
                        onClick={() => updateStatus([t.id], 'PAID')}
                        className="text-[11px] text-emerald-700 hover:underline w-fit"
                      >
                        Marcar como pago
                      </button>
                    )}
                    {!t.cardId && (t.status || 'PENDING') === 'PAID' && (
                      <button
                        onClick={() => updateStatus([t.id], 'PENDING')}
                        className="text-[11px] text-amber-700 hover:underline w-fit"
                      >
                        Marcar como nao pago
                      </button>
                    )}
                    {t.recurrence === 'MONTHLY' && t.recurrenceId && (
                      <button
                        onClick={() => handleCancelRecurrence(t)}
                        className="text-[11px] text-rose-700 hover:underline w-fit"
                      >
                        Cancelar recorrencia
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-4 px-6 text-sm text-slate-500">
                  {new Date(t.date).toLocaleDateString('pt-BR')}
                  {t.purchaseDate && (
                    <span className="block text-[10px] text-slate-400">
                      Compra {new Date(t.purchaseDate).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </td>
                <td
                  className={`py-4 px-6 text-right font-bold ${
                    t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-800'
                  }`}
                >
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
              <h3 className="text-white font-bold text-lg">Nova Movimentacao</h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-white/80 hover:text-white">?</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Type Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setType(TransactionType.EXPENSE)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    type === TransactionType.EXPENSE ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'
                  }`}
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
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    type === TransactionType.INCOME ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Receita
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Compra Online, Salario..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {selectedCardId ? 'Data da compra' : 'Data'}
                  </label>
                  <input
                    required
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  {selectedCardId && duePreview && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Compra vai para a fatura que vence em {duePreview.toLocaleDateString('pt-BR')}.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option>Geral</option>
                    <option>Alimentacao</option>
                    <option>Moradia</option>
                    <option>Transporte</option>
                    <option>Lazer</option>
                    <option>Saude</option>
                    <option>Salario</option>
                    <option>Investimentos</option>
                    <option>Educacao</option>
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
                    <option value="PIX">PIX / Transferencia</option>
                    <option value="CASH">Dinheiro</option>
                    <option value="CARD">Cartao</option>
                  </select>
                  {type === TransactionType.EXPENSE && selectedCardId && (
                    <p className="text-[10px] text-slate-500 mt-1">Cartao selecionado define o meio de pagamento.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                    disabled={Boolean(selectedCardId && type === TransactionType.EXPENSE)}
                  >
                    <option value="PENDING">Pendente / A receber</option>
                    <option value="PAID">Pago / Recebido</option>
                  </select>
                </div>
                {type === TransactionType.EXPENSE && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cartao de Credito</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={selectedCardId}
                      onChange={(e) => setSelectedCardId(e.target.value)}
                    >
                      <option value="">Nenhum / Debito</option>
                      {cards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Advanced Options Toggle */}
              {type === TransactionType.EXPENSE && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex gap-4">
                    <label
                      className={`flex-1 border rounded-xl p-3 cursor-pointer transition-colors ${
                        recurrence === 'MONTHLY' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 rounded"
                          checked={recurrence === 'MONTHLY'}
                          onChange={() => {
                            const next = recurrence === 'MONTHLY' ? 'NONE' : 'MONTHLY';
                            setRecurrence(next);
                            if (next === 'MONTHLY' && !recurrenceMonths) {
                              setRecurrenceMonths(12);
                            }
                            setIsInstallment(false);
                          }}
                        />
                        <Repeat size={16} className="text-slate-600" />
                        <span className="text-sm font-bold text-slate-700">Recorrente (Mensal)</span>
                      </div>
                      <p className="text-xs text-slate-500 pl-6">Repete todo mes (Ex: Netflix, Aluguel)</p>
                      {recurrence === 'MONTHLY' && (
                        <div className="pl-6 pt-2">
                          <label className="text-[11px] text-slate-600 font-semibold block mb-1">Duraçao</label>
                          <select
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={recurrenceMonths}
                            onChange={(e) => setRecurrenceMonths(Number(e.target.value))}
                          >
                            <option value={6}>6 meses</option>
                            <option value={12}>1 ano (12 meses)</option>
                            <option value={24}>2 anos (24 meses)</option>
                            <option value={36}>3 anos (36 meses)</option>
                          </select>
                        </div>
                      )}
                    </label>

                    <label
                      className={`flex-1 border rounded-xl p-3 cursor-pointer transition-colors ${
                        isInstallment ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 rounded"
                          checked={isInstallment}
                          onChange={() => {
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
                        <input
                          type="number"
                          min="2"
                          max="60"
                          className="w-full px-3 py-2 border rounded-lg outline-none"
                          value={totalInstallments}
                          onChange={(e) => setTotalInstallments(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Ja pagas (colar)</label>
                        <input
                          type="number"
                          min="0"
                          max={totalInstallments - 1}
                          className="w-full px-3 py-2 border rounded-lg outline-none"
                          value={paidInstallments}
                          onChange={(e) => setPaidInstallments(Number(e.target.value))}
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Gera apenas as {totalInstallments - paidInstallments} restantes.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-indigo-200"
              >
                Confirmar Transacao
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
