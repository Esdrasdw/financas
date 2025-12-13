export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export type RecurrenceType = 'NONE' | 'MONTHLY' | 'YEARLY';
export type PaymentMethod = 'PIX' | 'CASH' | 'CARD';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
  category: string;
  recurrence: RecurrenceType;
  isInstallment?: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;
  cardId?: string;
  paymentMethod: PaymentMethod;
  installmentsPaid?: number;
}

export interface CreditCard {
  id: string;
  name: string;
  limit: number;
  dueDay: number;
  closingDay: number;
  color: string;
}

export interface Investment {
  id: string;
  name: string;
  amount: number;
  type: 'CDB' | 'LCI' | 'LCA' | 'TESOURO' | 'ACOES' | 'FII';
  percentageOfCDI: number;
  startDate: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Goal {
  id: string;
  title: string;
  target: number;
  current: number;
  deadline?: string;
  category?: string;
}

export interface FinanceDataset {
  transactions: Transaction[];
  cards: CreditCard[];
  investments: Investment[];
  budgets: Budget[];
  goals: Goal[];
}

export interface FinancialSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  savingsRate: number;
  investmentTotal: number;
  netWorth: number; // Balance + Investments
  healthScore: number; // 0-100
}

export interface AIInsight {
  title: string;
  message: string;
  type: 'success' | 'warning' | 'info';
}

export interface AIPreferences {
  shareBalance: boolean;
  shareTransactions: boolean;
  shareInvestments: boolean;
}

export type ViewState = 'dashboard' | 'transactions' | 'ai-advisor' | 'goals' | 'investments' | 'cards' | 'calendar' | 'budgets' | 'tools' | 'reports';
