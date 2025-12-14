
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
  const [showFutureInvoices, setShowFutureInvoices] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});

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
      const monthsToGenerate = 12;

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

  const monthCardMap = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);
  const invoices = useMemo<CardInvoice[]>(() => {
    const map = new Map<string, CardInvoice>();
    transactions
      .filter((t) => t.cardId && t.type === TransactionType.EXPENSE)
      .forEach((t) => {
        const due = toDate(t.date);
        if (!due) return;
        const key = `${t.cardId}-${monthKey(due)}`;
        const card = t.cardId ? monthCardMap[t.cardId] : null;

        if (!map.has(key)) {
          map.set(key, {
            key,
            cardId: t.cardId!,
            cardName: card?.name || 'Cartao',
            dueDate: due,
            monthKey: monthKey(due),
            total: 0,
            status: 'PAID',
            items: [],
          });
        }

        const invoice = map.get(key)!;
        invoice.items.push(t);
        invoice.total += t.amount;
        if ((t.status || 'PENDING') === 'PENDING') {
          invoice.status = 'PENDING';
        }
      });

    return Array.from(map.values()).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [transactions, monthCardMap]);

  const monthInvoices = useMemo(
    () => (referenceMonth === 'all' ? invoices : invoices.filter((inv) => inv.monthKey === referenceMonth)),
    [invoices, referenceMonth]
  );
  const futureInvoices = useMemo(
    () => (referenceMonth === 'all' ? [] : invoices.filter((inv) => inv.monthKey > referenceMonth)),
    [invoices, referenceMonth]
  );

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

  const nonCardTransactions = useMemo(() => listForFilters.filter((t) => !t.cardId), [listForFilters]);
  const pendingNonCard = useMemo(
    () => nonCardTransactions.filter((t) => (t.status || 'PENDING') === 'PENDING'),
    [nonCardTransactions]
  );
  const paidNonCard = useMemo(
    () => nonCardTransactions.filter((t) => (t.status || 'PENDING') === 'PAID'),
    [nonCardTransactions]
  );

  const openInvoiceValue = useMemo(
    () => monthInvoices.filter((inv) => inv.status === 'PENDING').reduce((sum, inv) => sum + inv.total, 0),
    [monthInvoices]
  );

  const projectedBalance = monthIncomeReceived + monthIncomePending - (monthExpensePaid + monthExpensePending);
  const realizedBalance = monthIncomeReceived - monthExpensePaid;

  const getInstallmentGroupKey = (tx: Transaction) => {
    const total = tx.installmentTotal || 0;
    if (!(tx.isInstallment || total > 1)) return null;
    const base = (tx.description || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim().toLowerCase();
    const cardMarker = tx.cardId || '';
    return `${base}__${total}__${cardMarker}`;
  };

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

  const toggleInvoice = (key: string) => {
    setExpandedInvoices((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedCard = selectedCardId ? cards.find((c) => c.id === selectedCardId) : null;
  const duePreview = selectedCard ? calculateCardDueDate(toDate(date) || new Date(), selectedCard).dueDate : null;
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Transacoes</h2>
        <div className="flex gap-2 flex-wrap">
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
            Nova Transacao
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase font-semibold text-slate-500">Visao mensal</p>
            <h3 className="text-xl font-bold text-slate-800">{referenceLabel}</h3>
            <p className="text-xs text-slate-500">
              {referenceMonth === 'all' ? 'Resumo consolidado de todos os meses, sem repetir parcelas.' : 'Mostrando apenas transacoes e faturas deste mes.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => shiftMonth(-1)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm flex items-center gap-2 hover:border-indigo-200"
            >
              <ChevronLeft size={16} /> Mes anterior
            </button>
            <button
              onClick={() => shiftMonth(1)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm flex items-center gap-2 hover:border-indigo-200"
            >
              Proximo mes <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setShowMonthSelector((v) => !v)}
              className="px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-sm text-indigo-700 flex items-center gap-2"
            >
              <ChevronDown size={14} className={`${showMonthSelector ? 'rotate-180' : ''} transition-transform`} /> Ver outro mes
            </button>
          </div>
        </div>
        {showMonthSelector && (
          <div className="flex flex-wrap gap-2">
            <select
              className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm shadow-sm min-w-[180px]"
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
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Resumo do mes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Recebidos</p>
            <h4 className="text-2xl font-bold text-emerald-700">
              {monthIncomeReceived.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h4>
            <p className="text-xs text-slate-500 mt-1">A receber: {monthIncomePending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
          <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Gastos</p>
            <h4 className="text-2xl font-bold text-rose-700">
              {monthExpensePaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h4>
            <p className="text-xs text-slate-500 mt-1">Pendentes: {monthExpensePending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
          <div className="p-4 rounded-xl border border-slate-100 bg-indigo-50">
            <p className="text-xs font-semibold text-indigo-700 uppercase">Saldo realizado</p>
            <h4 className="text-2xl font-bold text-indigo-900">
              {realizedBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h4>
            <p className="text-xs text-indigo-700/80 mt-1">Com pendencias: {projectedBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
          <div className="p-4 rounded-xl border border-slate-100 bg-amber-50">
            <p className="text-xs font-semibold text-amber-700 uppercase">Faturas do mes</p>
            <h4 className="text-2xl font-bold text-amber-700">
              {monthInvoices.reduce((sum, inv) => sum + inv.total, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h4>
            <p className="text-xs text-amber-700/80 mt-1">Em aberto: {openInvoiceValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <div className="p-4 rounded-xl border border-slate-100 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase font-semibold text-slate-500">Pagos vs pendentes</p>
                <h4 className="text-sm font-bold text-slate-800">Transacoes do mes (sem cartao)</h4>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {nonCardTransactions.length} itens
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <p className="text-[11px] font-semibold text-emerald-700 uppercase">Pagos</p>
                {paidNonCard.slice(0, 4).map((t) => (
                  <div key={t.id} className="mt-2 p-2 rounded-lg bg-white border border-emerald-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800 truncate">{t.description}</span>
                      <span className="text-xs text-emerald-700">
                        {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{new Date(t.date).toLocaleDateString('pt-BR')} - {t.category}</p>
                  </div>
                ))}
                {paidNonCard.length === 0 && <p className="text-xs text-slate-500 mt-2">Nenhum pago ainda.</p>}
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-[11px] font-semibold text-amber-700 uppercase">Pendentes</p>
                {pendingNonCard.slice(0, 4).map((t) => (
                  <div key={t.id} className="mt-2 p-2 rounded-lg bg-white border border-amber-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800 truncate">{t.description}</span>
                      <span className="text-xs text-amber-700">
                        {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {new Date(t.date).toLocaleDateString('pt-BR')} - {t.category}
                    </p>
                    <button
                      onClick={() => updateStatus([t.id], 'PAID')}
                      className="text-[11px] text-emerald-700 hover:underline mt-1"
                    >
                      Marcar como pago
                    </button>
                  </div>
                ))}
                {pendingNonCard.length === 0 && <p className="text-xs text-slate-500 mt-2">Sem pendencias manuais.</p>}
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-slate-100 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase font-semibold text-slate-500">Faturas do mes</p>
                <h4 className="text-sm font-bold text-slate-800">Cartao, vencimento e status</h4>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {monthInvoices.length} faturas
              </span>
            </div>
            {monthInvoices.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma fatura com vencimento neste mes.</p>
            ) : (
              <div className="space-y-3">
                {monthInvoices.map((inv) => (
                  <div key={inv.key} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{inv.cardName}</p>
                        <p className="text-xs text-slate-500">
                          Vence em {inv.dueDate.toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-xs text-slate-500">{inv.items.length} compras</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-slate-800">
                          {inv.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {inv.status === 'PAID' ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
                          {inv.status === 'PAID' ? 'Paga' : 'Em aberto'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {inv.status === 'PENDING' && (
                        <button
                          onClick={() => updateStatus(inv.items.map((i) => i.id), 'PAID')}
                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                        >
                          Marcar fatura como paga
                        </button>
                      )}
                      <button
                        onClick={() => toggleInvoice(inv.key)}
                        className="text-xs text-indigo-700 flex items-center gap-1"
                      >
                        <ChevronDown
                          size={12}
                          className={`${expandedInvoices[inv.key] ? 'rotate-180' : ''} transition-transform`}
                        />
                        {expandedInvoices[inv.key] ? 'Fechar compras' : 'Ver compras'}
                      </button>
                    </div>
                    {expandedInvoices[inv.key] && (
                      <div className="mt-2 space-y-1">
                        {inv.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2">
                              <CardIcon size={12} className="text-indigo-500" />
                              <span className="font-semibold text-slate-800">{item.description}</span>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-slate-800">
                                {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {new Date(item.date).toLocaleDateString('pt-BR')}
                                {item.purchaseDate ? ` - compra ${new Date(item.purchaseDate).toLocaleDateString('pt-BR')}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowFutureInvoices((v) => !v)}
                className="text-xs text-indigo-700 flex items-center gap-2"
              >
                <ChevronDown
                  size={12}
                  className={`${showFutureInvoices ? 'rotate-180' : ''} transition-transform`}
                />
                Mostrar proximas faturas
              </button>
              {showFutureInvoices && (
                <div className="mt-3 space-y-2">
                  {futureInvoices.length === 0 && <p className="text-xs text-slate-500">Nenhuma fatura futura cadastrada.</p>}
                  {futureInvoices.map((inv) => (
                    <div key={inv.key} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{inv.cardName}</p>
                        <p className="text-[11px] text-slate-500">
                          {inv.dueDate.toLocaleDateString('pt-BR')} - {inv.items.length} compras
                        </p>
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        {inv.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
              Filtros rapidos
            </div>
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

          <div className="flex flex-col md:flex-row gap-3">
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
          </div>

          <div className="flex flex-wrap gap-2">
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
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
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
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase font-semibold text-slate-500">Valores pendentes</p>
            <h3 className="text-lg font-bold text-slate-800">Compras no cartao e parcelas futuras do mes</h3>
          </div>
          <span className="text-sm font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
            {pendingTransactions.length} itens
          </span>
        </div>

        {pendingTransactions.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma pendencia no momento.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingTransactions.slice(0, 6).map((t) => (
              <div key={t.id} className="p-3 rounded-xl border border-slate-100 bg-gradient-to-r from-amber-50 to-white flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{t.description}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(t.date).toLocaleDateString('pt-BR')} - {t.category} - {paymentLabels[t.paymentMethod as PaymentMethod] || t.paymentMethod}
                  </p>
                  {!t.cardId && (
                    <button
                      onClick={() => updateStatus([t.id], 'PAID')}
                      className="text-[11px] text-emerald-700 hover:underline mt-1"
                    >
                      Marcar como pago
                    </button>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-amber-700">
                    {t.type === TransactionType.EXPENSE ? '-' : '+'}
                    {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  {t.isInstallment && <p className="text-[11px] text-slate-500">Parcela {t.installmentCurrent}/{t.installmentTotal}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Descricao</th>
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
                            setRecurrence(recurrence === 'MONTHLY' ? 'NONE' : 'MONTHLY');
                            setIsInstallment(false);
                          }}
                        />
                        <Repeat size={16} className="text-slate-600" />
                        <span className="text-sm font-bold text-slate-700">Recorrente (Mensal)</span>
                      </div>
                      <p className="text-xs text-slate-500 pl-6">Repete todo mes (Ex: Netflix, Aluguel)</p>
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
