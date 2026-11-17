import { useEffect, useRef, useCallback } from 'react';
import { BudgetSettings, Expense } from '../types';
import { formatCurrency, formatMonthYear } from '../utils/formatters';

export const BUDGET_THRESHOLDS = [50, 75, 90] as const;
export type BudgetThreshold = (typeof BUDGET_THRESHOLDS)[number];

const ALERTS_STORAGE_KEY = 'ledgerpulse_budget_threshold_alerts_v1';
const BACKGROUND_CHECK_INTERVAL_MS = 15000;

export interface BudgetThresholdNotification {
  yearMonth: string;
  threshold: BudgetThreshold;
  spent: number;
  budget: number;
  percentage: number;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

interface UseBudgetThresholdMonitorOptions {
  expenses: Expense[];
  budgetSettings: BudgetSettings;
  selectedYearMonth: string;
  onThresholdHit: (notification: BudgetThresholdNotification) => void;
}

function loadNotifiedThresholds(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, number[]>;
    }
  } catch (err) {
    console.warn('Failed to load budget threshold alert history:', err);
  }
  return {};
}

function saveNotifiedThresholds(map: Record<string, number[]>): void {
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Failed to save budget threshold alert history:', err);
  }
}

export function clearBudgetThresholdAlerts(): void {
  try {
    localStorage.removeItem(ALERTS_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear budget threshold alert history:', err);
  }
}

/**
 * Background check system that continuously compares real-time monthly spending
 * against `budgetSettings.monthlyBudget` and triggers notifications when
 * 50%, 75%, and 90% thresholds are reached.
 */
export function useBudgetThresholdMonitor({
  expenses,
  budgetSettings,
  selectedYearMonth,
  onThresholdHit,
}: UseBudgetThresholdMonitorOptions) {
  const latestStateRef = useRef({
    expenses,
    budgetSettings,
    selectedYearMonth,
    onThresholdHit,
  });
  latestStateRef.current = {
    expenses,
    budgetSettings,
    selectedYearMonth,
    onThresholdHit,
  };

  // Track previous month spend & budget to detect real-time deltas across any month
  const prevMonthTotalsRef = useRef<Map<string, number>>(new Map());
  const prevBudgetRef = useRef<number>(budgetSettings.monthlyBudget);
  const initializedRef = useRef<boolean>(false);

  const runThresholdCheck = useCallback((forceCheckSelectedMonth: boolean = false) => {
    const {
      expenses: currentExpenses,
      budgetSettings: currentBudget,
      selectedYearMonth: activeYm,
      onThresholdHit: notify,
    } = latestStateRef.current;

    const monthlyBudget = currentBudget.monthlyBudget;
    if (!monthlyBudget || monthlyBudget <= 0) return;

    // Aggregate real-time spending per YYYY-MM
    const monthTotals = new Map<string, number>();
    for (const exp of currentExpenses) {
      if (!exp.date || exp.date.length < 7) continue;
      const ym = exp.date.slice(0, 7);
      monthTotals.set(ym, (monthTotals.get(ym) || 0) + exp.amount);
    }

    const budgetChanged = prevBudgetRef.current !== monthlyBudget;
    const monthsToEvaluate = new Set<string>();

    if (!initializedRef.current || forceCheckSelectedMonth || budgetChanged) {
      monthsToEvaluate.add(activeYm);
    }

    // Also evaluate any month whose total spending changed since the last check
    for (const [ym, total] of monthTotals.entries()) {
      const prevTotal = prevMonthTotalsRef.current.get(ym) ?? 0;
      if (initializedRef.current && Math.abs(total - prevTotal) > 0.001) {
        monthsToEvaluate.add(ym);
      }
    }

    // Re-arm checks for months where expenses were deleted back below a threshold
    for (const [ym, prevTotal] of prevMonthTotalsRef.current.entries()) {
      const newTotal = monthTotals.get(ym) ?? 0;
      if (initializedRef.current && Math.abs(newTotal - prevTotal) > 0.001) {
        monthsToEvaluate.add(ym);
      }
    }

    // Load persisted alert state
    const notifiedMap = loadNotifiedThresholds();
    let mapChanged = false;

    for (const ym of monthsToEvaluate) {
      const spent = Math.round((monthTotals.get(ym) || 0) * 100) / 100;
      const pct = (spent / monthlyBudget) * 100;

      const previouslyNotified = Array.isArray(notifiedMap[ym]) ? notifiedMap[ym] : [];
      // Re-arm any threshold that spending has dropped back below (e.g., deleted expense or raised budget)
      const stillValidNotified = previouslyNotified.filter((t) => pct >= t);
      if (stillValidNotified.length !== previouslyNotified.length) {
        notifiedMap[ym] = stillValidNotified;
        mapChanged = true;
      }

      const newlyCrossed = BUDGET_THRESHOLDS.filter(
        (t) => pct >= t && !stillValidNotified.includes(t)
      );

      if (newlyCrossed.length > 0) {
        // Record all crossed thresholds up to the newly reached tier
        const updatedThresholds = Array.from(
          new Set([...stillValidNotified, ...newlyCrossed])
        ).sort((a, b) => a - b);
        notifiedMap[ym] = updatedThresholds;
        mapChanged = true;

        // Trigger toast for the highest newly crossed threshold
        const hitThreshold = newlyCrossed[newlyCrossed.length - 1];
        const monthLabel = formatMonthYear(ym);
        const spentFormatted = formatCurrency(spent, currentBudget.currency);
        const budgetFormatted = formatCurrency(monthlyBudget, currentBudget.currency);
        const pctLabel = pct.toFixed(1);

        let severity: 'info' | 'warning' | 'error' = 'info';
        let prefix = `Budget Check (${hitThreshold}%)`;
        if (hitThreshold === 90) {
          severity = 'error';
          prefix = pct >= 100 ? 'Critical Budget Alert (90%+)' : 'Critical Budget Alert (90%)';
        } else if (hitThreshold === 75) {
          severity = 'warning';
          prefix = 'Budget Warning (75%)';
        }

        notify({
          yearMonth: ym,
          threshold: hitThreshold,
          spent,
          budget: monthlyBudget,
          percentage: pct,
          severity,
          message: `${prefix}: ${monthLabel} spending reached ${spentFormatted} of ${budgetFormatted} (${pctLabel}%).`,
        });
      }
    }

    if (mapChanged) {
      saveNotifiedThresholds(notifiedMap);
    }

    prevMonthTotalsRef.current = monthTotals;
    prevBudgetRef.current = monthlyBudget;
    initializedRef.current = true;
  }, []);

  // Immediate real-time check whenever expenses, budget, or selected month changes
  useEffect(() => {
    runThresholdCheck(true);
  }, [expenses, budgetSettings.monthlyBudget, budgetSettings.currency, selectedYearMonth, runThresholdCheck]);

  // Periodic background check loop + visibility / cross-tab storage listeners
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      runThresholdCheck(true);
    }, BACKGROUND_CHECK_INTERVAL_MS);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        runThresholdCheck(true);
      }
    };

    const handleStorageSync = (e: StorageEvent) => {
      if (e.key && e.key.includes('ledgerpulse')) {
        runThresholdCheck(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('storage', handleStorageSync);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorageSync);
    };
  }, [runThresholdCheck]);

  const resetThresholdAlerts = useCallback(() => {
    clearBudgetThresholdAlerts();
    prevMonthTotalsRef.current = new Map();
    initializedRef.current = false;
  }, []);

  return { runThresholdCheck, resetThresholdAlerts };
}
