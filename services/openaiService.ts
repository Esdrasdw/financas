import { Transaction, Investment, AIPreferences, AIInsight, TransactionType } from "../types";
import { apiRequest } from "./api";

type InsightResponse = AIInsight;
type AdvisorResponse = { answer: string };

const computeSummary = (transactions: Transaction[], investments: Investment[]) => {
  const income = transactions.filter((t) => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
  const expense = transactions.filter((t) => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
  const balance = income - expense;
  const investmentTotal = investments.reduce((acc, i) => acc + i.amount, 0);
  const netWorth = balance + investmentTotal;

  const dates = transactions.map((t) => t.date).filter(Boolean).sort();
  const periodStart = dates[0];
  const periodEnd = dates[dates.length - 1];

  return {
    periodStart,
    periodEnd,
    income,
    expense,
    balance,
    investmentTotal,
    netWorth,
  };
};

export const analyzeFinances = async (
  transactions: Transaction[],
  investments: Investment[],
  preferences: AIPreferences
): Promise<AIInsight> => {
  let context = "";

  if (preferences.shareBalance) {
    const summary = computeSummary(transactions, investments);
    context += `Resumo (se autorizado):\n${JSON.stringify(summary)}\n\n`;
  }

  if (preferences.shareTransactions) {
    const summary = transactions
      .slice(0, 30)
      .map((t) => `${t.date}: ${t.description} - R$${t.amount} (${t.type})`)
      .join("\n");
    context += `Transacoes Recentes:\n${summary}\n\n`;
  }

  if (preferences.shareInvestments) {
    const invSummary = investments.map((i) => `${i.name}: R$${i.amount} (${i.type})`).join("\n");
    context += `Investimentos:\n${invSummary}\n\n`;
  }

  if (!context) {
    return {
      title: "Dados Insuficientes",
      message: "Habilite o compartilhamento de dados nas configuracoes da IA para receber dicas.",
      type: "info",
    };
  }

  try {
    return await apiRequest<InsightResponse>("/ai/insight", {
      method: "POST",
      body: JSON.stringify({
        context,
      }),
    });
  } catch (error) {
    console.error("Erro ao analisar financas:", error);
    return {
      title: "Erro na Analise",
      message: "Nao foi possivel conectar ao assistente financeiro no momento.",
      type: "info",
    };
  }
};

export const askFinancialAdvisor = async (
  question: string,
  transactions: Transaction[],
  investments: Investment[],
  preferences: AIPreferences
) => {
  let dataContext = "";

  if (preferences.shareBalance) {
    const summary = computeSummary(transactions, investments);
    dataContext += `RESUMO_GERAL: ${JSON.stringify(summary)}\n`;
  }

  if (preferences.shareTransactions) {
    dataContext += `TRANSACOES RECENTES: ${JSON.stringify(transactions.slice(0, 50))}\n`;
  }

  if (preferences.shareInvestments) {
    dataContext += `INVESTIMENTOS: ${JSON.stringify(investments)}\n`;
  }

  dataContext +=
    "Observacoes: Valores em BRL (R$). TRANSACOES seguem {date, description, amount, type, category, recurrence, cardId?}. INVESTIMENTOS seguem {name, amount, type, percentageOfCDI, startDate}.\n";

  const response = await apiRequest<AdvisorResponse>("/ai/advisor", {
    method: "POST",
    body: JSON.stringify({
      question,
      dataContext,
    }),
  });

  return response.answer;
};
