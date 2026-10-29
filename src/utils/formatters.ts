import { Expense, BudgetSettings, MonthSummary, DaySummary, CategorySummary, ExpenseCategory } from '../types';

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  INR: '₹',
  CAD: 'CA$',
  AUD: 'AU$',
};

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '$';
  const decimals = currency === 'JPY' ? 0 : 2;
  const formattedNumber = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${amount < 0 ? '-' : ''}${symbol}${formattedNumber}`;
}

export function formatDateLabel(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  const today = new Date(2026, 9, 29); // 2026-10-29
  const todayStr = '2026-10-29';
  const yesterdayStr = '2026-10-28';

  if (dateStr === todayStr) {
    return 'Today';
  }
  if (dateStr === yesterdayStr) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatFullDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonthYear(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function getDaysInMonth(yearMonth: string): number {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

export function getPreviousYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
  return `${prevYear}-${prevMonth}`;
}

export function getNextYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const nextDate = new Date(year, month, 1);
  const nextYear = nextDate.getFullYear();
  const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
}

export function calculateDailySummaries(
  expenses: Expense[],
  yearMonth: string,
  dailyTarget: number
): DaySummary[] {
  const daysCount = getDaysInMonth(yearMonth);
  const currentTodayDate = '2026-10-29';
  const summaries: DaySummary[] = [];

  for (let d = 1; d <= daysCount; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${yearMonth}-${dayStr}`;
    const dayExpenses = expenses.filter((e) => e.date === dateStr);
    const dayTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

    const isToday = dateStr === currentTodayDate;
    const isFuture = dateStr > currentTodayDate;
    const isPastOrToday = !isFuture;

    summaries.push({
      date: dateStr,
      dayOfMonth: d,
      total: dayTotal,
      count: dayExpenses.length,
      isToday,
      isPastOrToday,
      isFuture,
      isOverTarget: isPastOrToday && dayTotal > dailyTarget,
    });
  }

  return summaries;
}

export function calculateCategoryBreakdown(
  expenses: Expense[],
  categoryBudgets: Partial<Record<ExpenseCategory, number>> = {}
): CategorySummary[] {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const catMap: Record<string, { amount: number; count: number }> = {};

  for (const exp of expenses) {
    if (!catMap[exp.category]) {
      catMap[exp.category] = { amount: 0, count: 0 };
    }
    catMap[exp.category].amount += exp.amount;
    catMap[exp.category].count += 1;
  }

  const result: CategorySummary[] = Object.entries(catMap).map(([cat, data]) => {
    const category = cat as ExpenseCategory;
    return {
      category,
      amount: data.amount,
      count: data.count,
      percentage: total > 0 ? (data.amount / total) * 100 : 0,
      budgetLimit: categoryBudgets[category],
    };
  });

  return result.sort((a, b) => b.amount - a.amount);
}

export function calculateMonthSummary(
  expenses: Expense[],
  yearMonth: string,
  budgetSettings: BudgetSettings
): MonthSummary {
  const monthExpenses = expenses.filter((e) => e.date.startsWith(yearMonth));
  const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const daysInMonth = getDaysInMonth(yearMonth);

  // Determine days elapsed for pace calculation
  const currentTodayDate = '2026-10-29';
  let daysElapsed = daysInMonth;
  if (currentTodayDate.startsWith(yearMonth)) {
    daysElapsed = parseInt(currentTodayDate.split('-')[2], 10);
  } else if (yearMonth > currentTodayDate.slice(0, 7)) {
    daysElapsed = 0;
  }

  const effectiveDaysForAverage = Math.max(1, daysElapsed);
  const dailyAverage = totalSpent / effectiveDaysForAverage;
  const projectedTotal = daysElapsed < daysInMonth && daysElapsed > 0
    ? totalSpent + dailyAverage * (daysInMonth - daysElapsed)
    : totalSpent;

  const budget = budgetSettings.monthlyBudget;
  const percentUsed = budget > 0 ? (totalSpent / budget) * 100 : 0;
  const remaining = budget - totalSpent;

  // Previous month comparison
  const prevYearMonth = getPreviousYearMonth(yearMonth);
  const prevMonthExpenses = expenses.filter((e) => e.date.startsWith(prevYearMonth));
  const previousMonthSpend = prevMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  let changePercentVsPrevMonth: number | null = null;
  if (previousMonthSpend > 0) {
    changePercentVsPrevMonth = ((totalSpent - previousMonthSpend) / previousMonthSpend) * 100;
  }

  const categories = calculateCategoryBreakdown(monthExpenses, budgetSettings.categoryBudgets);
  const topCategory = categories.length > 0 ? categories[0] : null;

  return {
    yearMonth,
    label: formatMonthYear(yearMonth),
    totalSpent,
    budget,
    percentUsed,
    remaining,
    dailyAverage,
    projectedTotal,
    daysElapsed,
    daysInMonth,
    topCategory,
    previousMonthSpend,
    changePercentVsPrevMonth,
  };
}
