import { api } from "./api";

export const DEFAULT_CDI_RATE = 11.25; 

export const getCurrentCdiRate = async () => {
  try {
    const data = await api.getCdiRate();
    return { rate: data.rate, updatedAt: data.updatedAt, source: data.source };
  } catch (error) {
    console.error("Erro ao consultar CDI atual:", error);
    return { rate: DEFAULT_CDI_RATE, updatedAt: null, source: "fallback" };
  }
};

export const calculateInvestmentReturn = (
  principal: number, 
  percentageOfCDI: number, 
  months: number,
  baseCdiRate: number = DEFAULT_CDI_RATE
): number => {
  // Annual to Monthly rate conversion
  // Formula: (1 + annual_rate)^(1/12) - 1
  const annualRateDecimal = (baseCdiRate * (percentageOfCDI / 100)) / 100;
  const monthlyRate = Math.pow(1 + annualRateDecimal, 1 / 12) - 1;
  
  // Compound interest: P * (1 + r)^n
  return principal * Math.pow(1 + monthlyRate, months);
};

export const getNextCardDueDate = (closingDay: number, dueDay: number): string => {
  const today = new Date();
  let targetMonth = today.getMonth();
  let targetYear = today.getFullYear();

  // If today is past the closing day, the bill comes next month (or month after depending on due day logic)
  // Usually if I buy after closing, I pay in the subsequent due date.
  if (today.getDate() > closingDay) {
    targetMonth++;
  }

  // Handle year rollover
  if (targetMonth > 11) {
    targetMonth = 0;
    targetYear++;
  }

  // Construct date
  const date = new Date(targetYear, targetMonth, dueDay);
  return date.toISOString().split('T')[0];
};
