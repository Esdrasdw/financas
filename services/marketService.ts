import { api } from "./api";
import { Contribution, Investment } from "../types";

export const DEFAULT_CDI_RATE = 11.25;
const DAY_MS = 1000 * 60 * 60 * 24;
const DAYS_IN_YEAR = 365;

const toDate = (value?: string) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

const daysBetween = (from: Date, to: Date) => Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));

const fallbackContributions = (investment: Investment): Contribution[] => [
  {
    id: `${investment.id}-c1`,
    amount: investment.amount || 0,
    date: investment.startDate || new Date().toISOString().split("T")[0],
  },
];

export const getCurrentCdiRate = async () => {
  try {
    const data = await api.getCdiRate();
    return { rate: data.rate, updatedAt: data.updatedAt, source: data.source };
  } catch (error) {
    console.error("Erro ao consultar CDI atual:", error);
    return { rate: DEFAULT_CDI_RATE, updatedAt: null, source: "fallback" };
  }
};

export const getDailyCdiRate = (percentageOfCDI: number, baseCdiRate: number = DEFAULT_CDI_RATE) => {
  const annualRateDecimal = (baseCdiRate * (percentageOfCDI / 100)) / 100;
  return Math.pow(1 + annualRateDecimal, 1 / DAYS_IN_YEAR) - 1;
};

export const projectContributionValue = (
  amount: number,
  contributionDate: string,
  percentageOfCDI: number,
  baseCdiRate: number = DEFAULT_CDI_RATE,
  targetDate: Date = new Date()
) => {
  const date = toDate(contributionDate) || new Date();
  if (date > targetDate) return 0;
  const days = daysBetween(date, targetDate);
  const dailyRate = getDailyCdiRate(percentageOfCDI, baseCdiRate);
  return amount * Math.pow(1 + dailyRate, days);
};

export const calculateInvestmentValue = (
  investment: Investment,
  baseCdiRate: number = DEFAULT_CDI_RATE,
  targetDate: Date = new Date()
) => {
  const contributions = investment.contributions?.length
    ? investment.contributions
    : fallbackContributions(investment);

  return contributions.reduce(
    (total, contrib) =>
      total +
      projectContributionValue(
        Number(contrib.amount) || 0,
        contrib.date,
        investment.percentageOfCDI,
        baseCdiRate,
        targetDate
      ),
    0
  );
};

export const sumPrincipal = (investments: Investment[], referenceDate: Date = new Date()) =>
  investments.reduce((acc, inv) => {
    const contributions = inv.contributions?.length ? inv.contributions : fallbackContributions(inv);
    return (
      acc +
      contributions.reduce((s, c) => {
        const date = toDate(c.date) || new Date();
        if (date > referenceDate) return s;
        return s + (Number(c.amount) || 0);
      }, 0)
    );
  }, 0);

export const buildProjectionSeries = (
  investments: Investment[],
  months: number,
  baseCdiRate: number = DEFAULT_CDI_RATE
) => {
  const points = [];
  const today = new Date();

  for (let i = 0; i <= months; i++) {
    const target = new Date(today);
    target.setMonth(today.getMonth() + i);
    const totalValue = investments.reduce(
      (acc, inv) => acc + calculateInvestmentValue(inv, baseCdiRate, target),
      0
    );
    points.push({
      month: i === 0 ? "Hoje" : `${i}m`,
      label: target.toLocaleDateString("pt-BR"),
      value: totalValue,
      targetDate: target.toISOString().split("T")[0],
    });
  }

  return points;
};

export const getReturnSnapshots = (investments: Investment[], baseCdiRate: number = DEFAULT_CDI_RATE) => {
  const today = new Date();
  const currentValue = investments.reduce(
    (acc, inv) => acc + calculateInvestmentValue(inv, baseCdiRate, today),
    0
  );

  const addDays = (d: number) => {
    const target = new Date(today);
    target.setDate(today.getDate() + d);
    return investments.reduce(
      (acc, inv) => acc + calculateInvestmentValue(inv, baseCdiRate, target),
      0
    );
  };

  const dailyValue = addDays(1);
  const weeklyValue = addDays(7);
  const yearlyValue = addDays(365);

  return {
    currentValue,
    dailyGain: dailyValue - currentValue,
    weeklyGain: weeklyValue - currentValue,
    yearlyGain: yearlyValue - currentValue,
  };
};

export const getNextCardDueDate = (closingDay: number, dueDay: number): string => {
  const today = new Date();
  let targetMonth = today.getMonth();
  let targetYear = today.getFullYear();

  if (today.getDate() > closingDay) {
    targetMonth++;
  }

  if (targetMonth > 11) {
    targetMonth = 0;
    targetYear++;
  }

  const date = new Date(targetYear, targetMonth, dueDay);
  return date.toISOString().split("T")[0];
};
