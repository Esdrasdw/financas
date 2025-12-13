// Mocking current Brazil CDI rate (approx 11.25% annually as of late 2024/2025 context)
export const CURRENT_CDI_RATE = 11.25; 

export const calculateInvestmentReturn = (
  principal: number, 
  percentageOfCDI: number, 
  months: number
): number => {
  // Annual to Monthly rate conversion
  // Formula: (1 + annual_rate)^(1/12) - 1
  const annualRateDecimal = (CURRENT_CDI_RATE * (percentageOfCDI / 100)) / 100;
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
