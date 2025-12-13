import React, { useState, useEffect } from "react";
import {
  Transaction,
  TransactionType,
  FinancialSummary,
  ViewState,
  AIInsight,
  CreditCard as CreditCardType,
  Investment,
  AIPreferences,
  Budget,
  User,
  FinanceDataset,
} from "./types";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { TransactionManager } from "./components/TransactionManager";
import { SmartAdvisor } from "./components/SmartAdvisor";
import { Goals } from "./components/Goals";
import { Investments } from "./components/Investments";
import { CreditCards } from "./components/CreditCards";
import { CalendarView } from "./components/CalendarView";
import { Budgets } from "./components/Budgets";
import { FinancialTools } from "./components/FinancialTools";
import { Reports } from "./components/Reports";
import { Login } from "./components/Login";
import { analyzeFinances } from "./services/openaiService";
import { api } from "./services/api";
import { Menu, Lightbulb, X, Bell, LogOut } from "lucide-react";

const EMPTY_DATA: FinanceDataset = { transactions: [], cards: [], investments: [], budgets: [] };

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const [currentView, setCurrentView] = useState<ViewState>("dashboard");
  const [summary, setSummary] = useState<FinancialSummary>({
    totalBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    savingsRate: 0,
    investmentTotal: 0,
    netWorth: 0,
    healthScore: 0,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dailyInsight, setDailyInsight] = useState<AIInsight | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Default AI Preferences
  const [aiPreferences] = useState<AIPreferences>({
    shareBalance: true,
    shareTransactions: true,
    shareInvestments: true,
  });

  const buildId = () => Math.random().toString(36).slice(2, 11);

  const hydrateData = (data: FinanceDataset) => {
    setTransactions(data.transactions || []);
    setCards(data.cards || []);
    setInvestments(data.investments || []);
    setBudgets(data.budgets || []);
  };

  // Calculate Summary & Health Score
  useEffect(() => {
    const income = transactions.filter((t) => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter((t) => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
    const balance = income - expense;
    const rate = income > 0 ? ((income - expense) / income) * 100 : 0;
    const invTotal = investments.reduce((acc, i) => acc + i.amount, 0);

    let score = 0;
    if (balance > 0) score += 40;
    if (rate > 20) score += 30;
    else if (rate > 0) score += (rate / 20) * 30;
    if (invTotal > income * 0.1) score += 30;

    setSummary({
      totalBalance: balance,
      totalIncome: income,
      totalExpense: expense,
      savingsRate: rate,
      investmentTotal: invTotal,
      netWorth: balance + invTotal,
      healthScore: Math.min(100, Math.round(score)),
    });
  }, [transactions, investments]);

  // Restore session
  useEffect(() => {
    const bootstrap = async () => {
      const token = api.getToken();
      if (!token) {
        setCheckingSession(false);
        return;
      }
      try {
        const me = await api.me();
        const data = await api.fetchData();
        setUser(me.user);
        hydrateData(data);
        setIsAuthenticated(true);
      } catch (error: any) {
        api.clearToken();
        setGlobalError("Sessao expirada. Entre novamente.");
      } finally {
        setCheckingSession(false);
      }
    };
    bootstrap();
  }, []);

  // Fetch AI Insight
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchInsight = async () => {
      const insight = await analyzeFinances(transactions, investments, aiPreferences);
      setDailyInsight(insight);
    };
    fetchInsight();
  }, [transactions.length, investments.length, isAuthenticated]);

  const handleLogin = (session: { user: User; token: string; data: FinanceDataset }) => {
    api.setToken(session.token);
    setUser(session.user);
    hydrateData(session.data);
    setIsAuthenticated(true);
    setGlobalError(null);
  };

  const handleLogout = () => {
    api.clearToken();
    setIsAuthenticated(false);
    setUser(null);
    hydrateData(EMPTY_DATA);
    setDailyInsight(null);
  };

  const addTransactions = async (newTxs: Omit<Transaction, "id">[]) => {
    try {
      const response = await api.addTransactions(newTxs);
      setTransactions((prev) => [...response.transactions, ...prev]);
    } catch (error: any) {
      const fallback = newTxs.map((tx) => ({ ...tx, id: buildId() }));
      setTransactions((prev) => [...fallback, ...prev]);
      setGlobalError(error?.message || "Nao foi possivel salvar no servidor. Mantivemos localmente.");
    }
  };

  const deleteTransaction = async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTransaction(id);
    } catch (error: any) {
      setGlobalError(error?.message || "Erro ao remover a transacao no servidor.");
    }
  };

  const addCard = async (card: CreditCardType) => {
    try {
      const { card: saved } = await api.addCard(card);
      setCards((prev) => [...prev, saved]);
    } catch (error: any) {
      setCards((prev) => [...prev, card]);
      setGlobalError(error?.message || "Cartao salvo apenas localmente.");
    }
  };

  const deleteCard = async (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    try {
      await api.deleteCard(id);
    } catch (error: any) {
      setGlobalError(error?.message || "Erro ao remover cartao no servidor.");
    }
  };

  const addInvestment = async (inv: Investment) => {
    try {
      const { investment } = await api.addInvestment(inv);
      setInvestments((prev) => [...prev, investment]);
    } catch (error: any) {
      setInvestments((prev) => [...prev, inv]);
      setGlobalError(error?.message || "Investimento salvo apenas localmente.");
    }
  };

  const updateInvestment = async (inv: Investment) => {
    setInvestments((prev) => prev.map((i) => (i.id === inv.id ? inv : i)));
    try {
      const { investment } = await api.updateInvestment(inv);
      setInvestments((prev) => prev.map((i) => (i.id === inv.id ? investment : i)));
    } catch (error: any) {
      setGlobalError(error?.message || "Investimento atualizado apenas localmente.");
    }
  };

  const deleteInvestment = async (id: string) => {
    setInvestments((prev) => prev.filter((i) => i.id !== id));
    try {
      await api.deleteInvestment(id);
    } catch (error: any) {
      setGlobalError(error?.message || "Erro ao remover investimento.");
    }
  };

  const addBudget = async (b: Budget) => {
    try {
      const { budget } = await api.addBudget(b);
      setBudgets((prev) => [...prev, budget]);
    } catch (error: any) {
      setBudgets((prev) => [...prev, b]);
      setGlobalError(error?.message || "Orcamento salvo apenas localmente.");
    }
  };

  const deleteBudget = async (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    try {
      await api.deleteBudget(id);
    } catch (error: any) {
      setGlobalError(error?.message || "Erro ao remover orcamento.");
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case "dashboard":
        return <Dashboard transactions={transactions} investments={investments} summary={summary} />;
      case "transactions":
        return <TransactionManager transactions={transactions} cards={cards} onAdd={addTransactions} onDelete={deleteTransaction} />;
      case "calendar":
        return <CalendarView transactions={transactions} />;
      case "budgets":
        return <Budgets budgets={budgets} transactions={transactions} onAdd={addBudget} onDelete={deleteBudget} />;
      case "cards":
        return <CreditCards cards={cards} transactions={transactions} onAddCard={addCard} onDeleteCard={deleteCard} />;
      case "investments":
        return <Investments investments={investments} onAdd={addInvestment} onUpdate={updateInvestment} onDelete={deleteInvestment} />;
      case "ai-advisor":
        return <SmartAdvisor transactions={transactions} investments={investments} />;
      case "goals":
        return <Goals />;
      case "tools":
        return <FinancialTools />;
      case "reports":
        return <Reports transactions={transactions} />;
      default:
        return <Dashboard transactions={transactions} investments={investments} summary={summary} />;
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
        Carregando sessao...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const notifications = [
    { id: 1, text: "Fatura do Nubank vence em 5 dias", type: "warning" },
    { id: 2, text: 'Meta "Viagem" atingiu 50%', type: "success" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <Sidebar
        currentView={currentView}
        onChangeView={(v) => {
          setCurrentView(v);
          setMobileMenuOpen(false);
        }}
      />

      {/* Mobile Header & Nav */}
      <div
        className={`fixed inset-0 bg-slate-900 z-50 transform transition-transform duration-300 md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-8 text-white">
            <span className="font-bold text-xl">Menu</span>
            <button onClick={() => setMobileMenuOpen(false)}>
              <X />
            </button>
          </div>
          <nav className="space-y-4">
            <button onClick={() => { setCurrentView("dashboard"); setMobileMenuOpen(false); }} className="block text-white text-lg">
              Dashboard
            </button>
            <button onClick={() => { setCurrentView("transactions"); setMobileMenuOpen(false); }} className="block text-white text-lg">
              Transacoes
            </button>
            <button onClick={() => { setCurrentView("reports"); setMobileMenuOpen(false); }} className="block text-white text-lg">
              Relatorios
            </button>
            <button onClick={() => { setCurrentView("calendar"); setMobileMenuOpen(false); }} className="block text-white text-lg">
              Calendario
            </button>
            <button onClick={() => { setCurrentView("cards"); setMobileMenuOpen(false); }} className="block text-white text-lg">
              Cartoes
            </button>
            <button onClick={() => { setCurrentView("investments"); setMobileMenuOpen(false); }} className="block text-white text-lg">
              Investimentos
            </button>
            <button onClick={() => { setCurrentView("tools"); setMobileMenuOpen(false); }} className="block text-white text-lg">
              Ferramentas
            </button>
            <button onClick={() => { setCurrentView("ai-advisor"); setMobileMenuOpen(false); }} className="block text-white text-lg">
              AI Advisor
            </button>
            <button
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              className="block text-white text-lg opacity-80"
            >
              Sair
            </button>
          </nav>
        </div>
      </div>

      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-x-hidden">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="md:hidden">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <Menu size={24} />
            </button>
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-slate-800">
              {currentView === "dashboard" && "Visao Geral"}
              {currentView === "transactions" && "Transacoes"}
              {currentView === "reports" && "Relatorios e Analises"}
              {currentView === "calendar" && "Calendario Financeiro"}
              {currentView === "budgets" && "Orcamentos e Limites"}
              {currentView === "cards" && "Cartoes e Faturas"}
              {currentView === "investments" && "Investimentos"}
              {currentView === "ai-advisor" && "Consultor Inteligente"}
              {currentView === "goals" && "Minhas Metas"}
              {currentView === "tools" && "Ferramentas uteis"}
            </h1>
            <p className="text-sm text-slate-500">Gestao Financeira Completa</p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 relative">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-fade-in-up">
                  <div className="p-3 bg-slate-50 border-b border-slate-100 font-bold text-xs uppercase text-slate-500">Notificacoes</div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-3 border-b border-slate-50 hover:bg-slate-50 flex gap-3 items-start">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === "warning" ? "bg-amber-500" : "bg-emerald-500"}`}></div>
                        <p className="text-sm text-slate-700">{n.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-right">
                <p className="text-[11px] text-slate-500">Logado como</p>
                <p className="text-sm font-semibold text-slate-800 max-w-[160px] truncate">{user?.name || user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 flex items-center gap-2"
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          </div>
        </header>

        {globalError && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl">
            {globalError}
          </div>
        )}

        {/* AI Banner (Dashboard Only) */}
        {currentView === "dashboard" && dailyInsight && (
          <div
            className={`mb-8 p-4 rounded-xl border flex gap-4 items-start animate-fade-in ${
              dailyInsight.type === "success"
                ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                : dailyInsight.type === "warning"
                ? "bg-amber-50 border-amber-100 text-amber-800"
                : "bg-indigo-50 border-indigo-100 text-indigo-800"
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 bg-white/50`}>
              <Lightbulb size={20} />
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Dica do GPT: {dailyInsight.title}</h4>
              <p className="text-sm opacity-90">{dailyInsight.message}</p>
            </div>
          </div>
        )}

        {renderContent()}
      </main>
    </div>
  );
};

export default App;
