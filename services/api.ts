import { FinanceDataset, Transaction, CreditCard, Investment, Budget, User } from "../types";

export const API_URL = import.meta.env.VITE_API_URL || "/api";

let authToken: string | null = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = (data as any)?.message || "Falha ao comunicar com o servidor";
    throw new Error(message);
  }

  return data as T;
}

function setToken(token: string | null) {
  authToken = token || null;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
}

export const api = {
  getToken: () => authToken,
  setToken,
  clearToken: () => setToken(null),

  async login(email: string, password: string) {
    const data = await apiRequest<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return data;
  },

  async register(name: string, email: string, password: string) {
    const data = await apiRequest<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setToken(data.token);
    return data;
  },

  async me() {
    return apiRequest<{ user: User }>("/auth/me");
  },

  async fetchData() {
    return apiRequest<FinanceDataset>("/data");
  },

  async addTransactions(transactions: Omit<Transaction, "id">[]) {
    return apiRequest<{ transactions: Transaction[] }>("/transactions/bulk", {
      method: "POST",
      body: JSON.stringify({ transactions }),
    });
  },

  async deleteTransaction(id: string) {
    await apiRequest<void>(`/transactions/${id}`, { method: "DELETE" });
  },

  async addCard(card: CreditCard) {
    return apiRequest<{ card: CreditCard }>("/cards", {
      method: "POST",
      body: JSON.stringify(card),
    });
  },

  async deleteCard(id: string) {
    await apiRequest<void>(`/cards/${id}`, { method: "DELETE" });
  },

  async addInvestment(investment: Investment) {
    return apiRequest<{ investment: Investment }>("/investments", {
      method: "POST",
      body: JSON.stringify(investment),
    });
  },

  async updateInvestment(investment: Investment) {
    return apiRequest<{ investment: Investment }>(`/investments/${investment.id}`, {
      method: "PUT",
      body: JSON.stringify(investment),
    });
  },

  async deleteInvestment(id: string) {
    await apiRequest<void>(`/investments/${id}`, { method: "DELETE" });
  },

  async addBudget(budget: Budget) {
    return apiRequest<{ budget: Budget }>("/budgets", {
      method: "POST",
      body: JSON.stringify(budget),
    });
  },

  async deleteBudget(id: string) {
    await apiRequest<void>(`/budgets/${id}`, { method: "DELETE" });
  },

  async getCdiRate() {
    return apiRequest<{ rate: number; updatedAt: string; source: string }>("/market/cdi");
  },
};
