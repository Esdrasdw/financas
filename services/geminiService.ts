import { Transaction, Investment, AIPreferences, AIInsight } from "../types";
import { apiRequest } from "./api";

type InsightResponse = AIInsight;
type AdvisorResponse = { answer: string };

export const analyzeFinances = async (
  transactions: Transaction[],
  investments: Investment[],
  preferences: AIPreferences
): Promise<AIInsight> => {
  let context = "";

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

  if (preferences.shareTransactions) {
    dataContext += `TRANSACOES RECENTES: ${JSON.stringify(transactions.slice(0, 50))}\n`;
  }

  if (preferences.shareInvestments) {
    dataContext += `INVESTIMENTOS: ${JSON.stringify(investments)}\n`;
  }

  if (preferences.shareBalance) {
    dataContext += "O usuario permitiu analise de saldo geral.\n";
  }

  const response = await apiRequest<AdvisorResponse>("/ai/advisor", {
    method: "POST",
    body: JSON.stringify({
      question,
      dataContext,
    }),
  });

  return response.answer;
};
