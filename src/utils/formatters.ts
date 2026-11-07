import {
  Expense,
  BudgetSettings,
  MonthSummary,
  DaySummary,
  CategorySummary,
  ExpenseCategory,
  EndOfMonthProjection,
  CategoryProjection,
  SavingsGoal,
} from '../types';
import { CATEGORIES } from '../data/sampleExpenses';

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

/**
 * Predicts the end-of-month spend based on historical daily average run-rate,
 * blending current month progression, overall historical velocity, and weekday vs weekend behavior.
 */
export function predictEndOfMonthSpend(
  expenses: Expense[],
  yearMonth: string,
  budgetSettings: BudgetSettings
): EndOfMonthProjection {
  const currentTodayDate = '2026-10-29';
  const daysInMonth = getDaysInMonth(yearMonth);
  const monthExpenses = expenses.filter((e) => e.date.startsWith(yearMonth));
  const currentSpend = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Determine elapsed days in target month
  let daysElapsed = daysInMonth;
  if (currentTodayDate.startsWith(yearMonth)) {
    daysElapsed = parseInt(currentTodayDate.split('-')[2], 10);
  } else if (yearMonth > currentTodayDate.slice(0, 7)) {
    daysElapsed = 0;
  }
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  // 1. Current Month Elapsed Run-Rate
  const currentMonthDailyRunRate = daysElapsed > 0 ? currentSpend / daysElapsed : 0;

  // 2. Historical Daily Average across all prior transactions
  const priorExpenses = expenses.filter((e) => !e.date.startsWith(yearMonth) && e.date <= currentTodayDate);
  const priorDaysCount = Math.max(1, new Set(priorExpenses.map((e) => e.date)).size);
  const priorDailyAverage = priorExpenses.length > 0
    ? priorExpenses.reduce((sum, e) => sum + e.amount, 0) / priorDaysCount
    : (budgetSettings.dailyTarget || budgetSettings.monthlyBudget / 31);

  // Blended Historical Daily Run-rate:
  // As more days elapse in the current month, current month's actual velocity takes heavier weight
  const historicalDailyAverage = daysElapsed >= 15
    ? currentMonthDailyRunRate * 0.85 + priorDailyAverage * 0.15
    : daysElapsed >= 5
    ? currentMonthDailyRunRate * 0.65 + priorDailyAverage * 0.35
    : daysElapsed > 0
    ? currentMonthDailyRunRate * 0.40 + priorDailyAverage * 0.60
    : priorDailyAverage;

  // 3. Recent 7-Day Velocity Run-rate
  const [currY, currM] = yearMonth.split('-').map(Number);
  let recent7Spend = 0;
  let recent7DaysCount = 0;
  for (let offset = 0; offset < 7; offset++) {
    const targetDay = daysElapsed - offset;
    if (targetDay > 0) {
      const dayStr = `${yearMonth}-${String(targetDay).padStart(2, '0')}`;
      const dayTotal = monthExpenses
        .filter((e) => e.date === dayStr)
        .reduce((s, e) => s + e.amount, 0);
      recent7Spend += dayTotal;
      recent7DaysCount++;
    }
  }
  const recent7DayRunRate = recent7DaysCount > 0 ? recent7Spend / recent7DaysCount : historicalDailyAverage;

  // 4. Weekday vs Weekend Run-Rate Analysis across historical data
  let weekdaySpend = 0;
  let weekdayCount = 0;
  let weekendSpend = 0;
  let weekendCount = 0;

  const relevantExpenses = expenses.filter((e) => e.date <= currentTodayDate);
  const dayTotalsMap: Record<string, number> = {};
  for (const exp of relevantExpenses) {
    dayTotalsMap[exp.date] = (dayTotalsMap[exp.date] || 0) + exp.amount;
  }

  for (const [dateStr, total] of Object.entries(dayTotalsMap)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendSpend += total;
      weekendCount++;
    } else {
      weekdaySpend += total;
      weekdayCount++;
    }
  }

  const baselineWeekdayRate = weekdayCount > 0 ? weekdaySpend / weekdayCount : historicalDailyAverage * 0.92;
  const baselineWeekendRate = weekendCount > 0 ? weekendSpend / weekendCount : historicalDailyAverage * 1.25;

  // Adjust rates proportionally to match current blended historical run rate
  const blendedRatio = (baselineWeekdayRate * 5 + baselineWeekendRate * 2) / 7;
  const scale = blendedRatio > 0 ? historicalDailyAverage / blendedRatio : 1;
  const weekdayRunRate = baselineWeekdayRate * scale;
  const weekendRunRate = baselineWeekendRate * scale;

  // 5. Predict Remaining Days Spend by inspecting each remaining calendar day's day-of-week
  let remainingProjectedSpend = 0;
  if (daysRemaining > 0) {
    for (let d = daysElapsed + 1; d <= daysInMonth; d++) {
      const dayOfWeek = new Date(currY, currM - 1, d).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      remainingProjectedSpend += isWeekend ? weekendRunRate : weekdayRunRate;
    }
  }

  const predictedTotal = currentSpend + remainingProjectedSpend;
  const budget = budgetSettings.monthlyBudget;
  const varianceVsBudget = predictedTotal - budget;
  const variancePercent = budget > 0 ? (varianceVsBudget / budget) * 100 : 0;

  // Confidence Bands: Conservative (best case discipline) vs High (volatility/peak surge)
  const conservativeRemaining = remainingProjectedSpend * 0.88;
  const highRemaining = remainingProjectedSpend * 1.18;
  const confidenceBand = {
    conservative: currentSpend + conservativeRemaining,
    projected: predictedTotal,
    high: currentSpend + highRemaining,
  };

  // Status
  let status: 'on-track' | 'near-limit' | 'exceeding-limit' = 'on-track';
  if (predictedTotal > budget) {
    status = 'exceeding-limit';
  } else if (predictedTotal > budget * 0.92) {
    status = 'near-limit';
  }

  // Daily allowable to stay exactly within budget limit
  const remainingBudget = Math.max(0, budget - currentSpend);
  const dailyAllowableToStayOnBudget = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

  // 6. Category-level Projections
  const categoryProjections: CategoryProjection[] = CATEGORIES.map((cat) => {
    const catExpenses = monthExpenses.filter((e) => e.category === cat);
    const catSpent = catExpenses.reduce((s, e) => s + e.amount, 0);
    const catBudget = budgetSettings.categoryBudgets[cat];

    const catDaily = daysElapsed > 0 ? catSpent / daysElapsed : 0;
    const catProjected = daysRemaining > 0 ? catSpent + catDaily * daysRemaining : catSpent;
    const isOverLimit = catBudget !== undefined && catBudget > 0 ? catProjected > catBudget : false;
    const varianceVsLimit = catBudget !== undefined && catBudget > 0 ? catProjected - catBudget : 0;

    return {
      category: cat,
      currentSpent: catSpent,
      projectedTotal: Math.round(catProjected * 100) / 100,
      budgetLimit: catBudget,
      isOverLimit,
      varianceVsLimit: Math.round(varianceVsLimit * 100) / 100,
    };
  }).filter((cp) => cp.currentSpent > 0 || (cp.budgetLimit && cp.budgetLimit > 0))
    .sort((a, b) => b.projectedTotal - a.projectedTotal);

  // 7. Executive Insight Message
  let insightMessage = '';
  if (daysRemaining === 0) {
    insightMessage = `Month concluded at ${formatCurrency(currentSpend, budgetSettings.currency)} total spend (${Math.abs(varianceVsBudget) > 0 ? `${formatCurrency(Math.abs(varianceVsBudget), budgetSettings.currency)} ${varianceVsBudget <= 0 ? 'under budget' : 'over budget'}` : 'on exact target'}).`;
  } else if (varianceVsBudget <= 0) {
    insightMessage = `Based on your ${formatCurrency(historicalDailyAverage, budgetSettings.currency)}/day historical run-rate, you are projected to finish at ${formatCurrency(predictedTotal, budgetSettings.currency)}, preserving a ${formatCurrency(Math.abs(varianceVsBudget), budgetSettings.currency)} cushion below your ${formatCurrency(budget, budgetSettings.currency)} ceiling.`;
  } else {
    insightMessage = `Current run-rate trajectory projects an end-of-month spend of ${formatCurrency(predictedTotal, budgetSettings.currency)}, exceeding your budget by ${formatCurrency(varianceVsBudget, budgetSettings.currency)} (+${variancePercent.toFixed(1)}%). Limit spending to ${formatCurrency(dailyAllowableToStayOnBudget, budgetSettings.currency)}/day for the remaining ${daysRemaining} days to stay on target.`;
  }

  return {
    yearMonth,
    currentSpend: Math.round(currentSpend * 100) / 100,
    predictedTotal: Math.round(predictedTotal * 100) / 100,
    budget,
    daysElapsed,
    daysRemaining,
    daysInMonth,
    historicalDailyAverage: Math.round(historicalDailyAverage * 100) / 100,
    recent7DayRunRate: Math.round(recent7DayRunRate * 100) / 100,
    weekdayRunRate: Math.round(weekdayRunRate * 100) / 100,
    weekendRunRate: Math.round(weekendRunRate * 100) / 100,
    remainingProjectedSpend: Math.round(remainingProjectedSpend * 100) / 100,
    varianceVsBudget: Math.round(varianceVsBudget * 100) / 100,
    variancePercent,
    status,
    confidenceBand: {
      conservative: Math.round(confidenceBand.conservative * 100) / 100,
      projected: Math.round(confidenceBand.projected * 100) / 100,
      high: Math.round(confidenceBand.high * 100) / 100,
    },
    dailyAllowableToStayOnBudget: Math.round(dailyAllowableToStayOnBudget * 100) / 100,
    categoryProjections,
    insightMessage,
  };
}

/**
 * Normalizes a tag for flexible comparison (lowercased, alphanumeric without #, -, _, spaces)
 */
export function normalizeTag(tag: string): string {
  if (!tag) return '';
  return tag.trim().replace(/^#/, '').toLowerCase().replace(/[-_\s]+/g, '');
}

/**
 * Checks whether an expense's tags match a target goal's tag or goal name.
 */
export function matchExpenseToGoalTag(expense: Expense, goalTagOrName: string): boolean {
  if (!expense.tags || expense.tags.length === 0 || !goalTagOrName) return false;
  const targetNorm = normalizeTag(goalTagOrName);
  if (!targetNorm) return false;

  return expense.tags.some((t) => {
    const norm = normalizeTag(t);
    return norm === targetNorm || norm.includes(targetNorm) || targetNorm.includes(norm);
  });
}

/**
 * Calculates total savings for a goal identified through matching transaction tags,
 * plus any manual base/deposit amount.
 */
export function calculateGoalSavings(
  goal: SavingsGoal,
  expenses: Expense[] = []
): {
  baseAmount: number;
  taggedAmount: number;
  totalSaved: number;
  totalAmount: number;
  matchingCount: number;
  percentage: number;
  remainingAmount: number;
  isCompleted: boolean;
  matchingExpenses: Expense[];
} {
  const targetTag = goal.tag || goal.name;
  const matchingExpenses = expenses.filter((e) => matchExpenseToGoalTag(e, targetTag));
  const taggedAmount = matchingExpenses.reduce((sum, e) => sum + e.amount, 0);
  const baseAmount = Math.max(0, goal.currentAmount || 0);
  const totalSaved = baseAmount + taggedAmount;
  const targetAmount = Math.max(1, goal.targetAmount);
  const percentage = Math.min(100, Math.round((totalSaved / targetAmount) * 1000) / 10);
  const remainingAmount = Math.max(0, targetAmount - totalSaved);
  const isCompleted = totalSaved >= targetAmount;

  return {
    baseAmount,
    taggedAmount,
    totalSaved,
    totalAmount: totalSaved,
    matchingCount: matchingExpenses.length,
    percentage,
    remainingAmount,
    isCompleted,
    matchingExpenses,
  };
}
