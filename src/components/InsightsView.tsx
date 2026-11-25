import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  Sliders,
  DollarSign,
  Calendar,
  PieChart as PieIcon,
  HelpCircle,
  Clock,
  ShieldCheck,
  Tag,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Target,
  LineChart as LineChartIcon,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  CalendarRange,
  Zap,
  Minus,
  ArrowLeftRight,
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend as RechartsLegend,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { Expense, BudgetSettings, MonthSummary, EndOfMonthProjection, CategoryProjection, ExpenseCategory } from '../types';
import {
  formatCurrency,
  formatMonthYear,
  formatDateLabel,
  predictEndOfMonthSpend,
  getDaysInMonth,
  getPreviousYearMonth,
  calculateCategoryBreakdown,
  CURRENCY_SYMBOLS,
} from '../utils/formatters';
import { CATEGORY_COLORS, CATEGORIES } from '../data/sampleExpenses';

interface FinancialInsight {
  overallHealth: {
    score: number;
    status: 'Healthy' | 'Moderate' | 'Needs Attention';
    headline: string;
    summary: string;
  };
  keyFindings: Array<{
    title: string;
    impact: 'positive' | 'warning' | 'neutral';
    category?: string;
    observation: string;
    metric?: string;
  }>;
  actionableTips: Array<{
    title: string;
    category: string;
    potentialSavings: string;
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    actionStep: string;
  }>;
  spendingPatterns: {
    weekdayVsWeekend?: string;
    peakSpendingDays?: string;
    recurringCommitmentsNote?: string;
    topCategoryTrend?: string;
  };
  budgetAdjustmentSuggestions: Array<{
    category: string;
    currentSpending: string;
    suggestedBudget: string;
    rationale: string;
  }>;
}

interface InsightsViewProps {
  expenses: Expense[];
  budgetSettings: BudgetSettings;
  selectedYearMonth: string;
  onSelectYearMonth: (ym: string) => void;
  onOpenBudgetModal: () => void;
  theme?: 'dark' | 'light';
}

// Accessible high-contrast color palette for common and custom labels
const LABEL_COLORS: Record<string, string> = {
  Personal: '#10b981', // emerald
  Work: '#3b82f6', // blue
  'Project X': '#8b5cf6', // purple
  Essential: '#f59e0b', // amber
  Home: '#6366f1', // indigo
  Commute: '#06b6d4', // cyan
  Wellness: '#14b8a6', // teal
  Travel: '#ec4899', // pink
  Entertainment: '#f43f5e', // rose
  Lunch: '#f97316', // orange
  Routine: '#eab308', // yellow
  Unlabeled: '#94a3b8', // slate
};

const FALLBACK_PALETTE = [
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#a855f7',
  '#0ea5e9',
  '#e11d48',
  '#d97706',
  '#059669',
];

function getLabelColor(label: string, index: number): string {
  if (LABEL_COLORS[label]) return LABEL_COLORS[label];
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  expenses,
  budgetSettings,
  selectedYearMonth,
  onSelectYearMonth,
  onOpenBudgetModal,
  theme = 'dark',
}) => {
  const [insights, setInsights] = useState<FinancialInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);

  // Donut chart state
  const [labelScope, setLabelScope] = useState<'month' | 'all'>('month');
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  // Multi-line 30-day comparison graph state
  const [trendMetric, setTrendMetric] = useState<'daily' | 'cumulative' | 'rolling'>('daily');

  // Selected-Month Daily Spending Trend chart state
  const [spendingTrendCategory, setSpendingTrendCategory] = useState<'all' | ExpenseCategory>('all');
  const [showTrendRollingAvg, setShowTrendRollingAvg] = useState<boolean>(true);
  const [showDailyTargetLine, setShowDailyTargetLine] = useState<boolean>(true);

  // Financial Forecast states
  const [forecastScenario, setForecastScenario] = useState<
    'blended' | 'velocity7' | 'conservative' | 'high'
  >('blended');
  const [showConfidenceBands, setShowConfidenceBands] = useState<boolean>(true);
  const [showIdealPace, setShowIdealPace] = useState<boolean>(true);
  const [showCategoryForecast, setShowCategoryForecast] = useState<boolean>(false);
  const [categoryLimitFilter, setCategoryLimitFilter] = useState<'all' | 'capped' | 'attention'>('all');

  // Calendar Heatmap state
  const [heatmapCategory, setHeatmapCategory] = useState<'all' | ExpenseCategory>('all');
  const [selectedHeatmapDate, setSelectedHeatmapDate] = useState<string | null>(null);

  const currency = budgetSettings.currency;

  const fetchInsights = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenses,
          budgetSettings,
          selectedMonth: selectedYearMonth,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned error: ${response.statusText}`);
      }

      const data: FinancialInsight = await response.json();
      setInsights(data);
      setLastAnalyzedAt(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    } catch (err: any) {
      console.error('Failed to analyze insights:', err);
      setError(err.message || 'Unable to analyze financial insights right now.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    setSpendingTrendCategory('all');
    setHeatmapCategory('all');
    setSelectedHeatmapDate(null);
  }, [selectedYearMonth]);

  // Available months from expense logs
  const availableMonths = Array.from(
    new Set(expenses.map((e) => e.date.slice(0, 7)))
  )
    .sort()
    .reverse();

  // --------------------------------------------------------------------------
  // Categorized Label / Tag Donut Chart Calculations
  // --------------------------------------------------------------------------
  const scopeExpenses = useMemo(() => {
    if (labelScope === 'month') {
      return expenses.filter((e) => e.date.startsWith(selectedYearMonth));
    }
    return expenses;
  }, [expenses, selectedYearMonth, labelScope]);

  const totalScopeSpent = useMemo(() => {
    return scopeExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [scopeExpenses]);

  const labelBreakdown = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();

    scopeExpenses.forEach((exp) => {
      const tags = exp.tags && exp.tags.length > 0 ? exp.tags : ['Unlabeled'];
      const splitAmount = exp.amount / tags.length;

      tags.forEach((tag) => {
        const cleanTag = tag.trim().replace(/^#/, '');
        const current = map.get(cleanTag) || { amount: 0, count: 0 };
        map.set(cleanTag, {
          amount: current.amount + splitAmount,
          count: current.count + 1,
        });
      });
    });

    const items = Array.from(map.entries()).map(([label, data], idx) => {
      const percentage = totalScopeSpent > 0 ? (data.amount / totalScopeSpent) * 100 : 0;
      return {
        name: label,
        value: Math.round(data.amount * 100) / 100,
        count: data.count,
        percentage,
        color: getLabelColor(label, idx),
      };
    });

    return items.sort((a, b) => b.value - a.value);
  }, [scopeExpenses, totalScopeSpent]);

  const activeLabelData = hoveredLabel
    ? labelBreakdown.find((d) => d.name === hoveredLabel)
    : null;

  // Top label highlight summary
  const topLabelSummary = useMemo(() => {
    if (labelBreakdown.length === 0) return 'No tagged expenses in this period.';
    const top = labelBreakdown[0];
    const second = labelBreakdown[1];

    if (second) {
      return (
        <span>
          Your top assigned label is{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">
            #{top.name}
          </strong>{' '}
          ({formatCurrency(top.value, currency)} · {top.percentage.toFixed(1)}%),
          followed by{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">
            #{second.name}
          </strong>{' '}
          ({formatCurrency(second.value, currency)} · {second.percentage.toFixed(1)}%).
        </span>
      );
    }

    return (
      <span>
        Your primary assigned label is{' '}
        <strong className="text-slate-900 dark:text-white font-semibold">
          #{top.name}
        </strong>{' '}
        accounting for {formatCurrency(top.value, currency)} ({top.percentage.toFixed(1)}% of expenses).
      </span>
    );
  }, [labelBreakdown, currency]);

  // --------------------------------------------------------------------------
  // Financial Forecast & End-of-Month Projection Calculations
  // --------------------------------------------------------------------------
  const forecast: EndOfMonthProjection = useMemo(() => {
    return predictEndOfMonthSpend(expenses, selectedYearMonth, budgetSettings);
  }, [expenses, selectedYearMonth, budgetSettings]);

  const scenarioForecastTotal = useMemo(() => {
    switch (forecastScenario) {
      case 'velocity7': {
        const vel7Total =
          forecast.currentSpend + forecast.recent7DayRunRate * forecast.daysRemaining;
        return Math.round(vel7Total * 100) / 100;
      }
      case 'conservative':
        return forecast.confidenceBand.conservative;
      case 'high':
        return forecast.confidenceBand.high;
      case 'blended':
      default:
        return forecast.predictedTotal;
    }
  }, [forecastScenario, forecast]);

  const scenarioVariance = scenarioForecastTotal - forecast.budget;
  const scenarioVariancePct =
    forecast.budget > 0 ? (scenarioVariance / forecast.budget) * 100 : 0;

  // Day-by-day cumulative timeline points for Recharts (Day 1 through daysInMonth)
  const forecastChartData = useMemo(() => {
    const [currY, currM] = selectedYearMonth.split('-').map(Number);
    const daysInMonth = forecast.daysInMonth;
    const daysElapsed = forecast.daysElapsed;
    const currentSpend = forecast.currentSpend;
    const budget = forecast.budget;
    const idealDailyRate = budget > 0 ? budget / daysInMonth : 0;

    // Daily spend map for the selected month
    const monthExpenses = expenses.filter((e) => e.date.startsWith(selectedYearMonth));
    const dailySpendMap = new Map<number, number>();
    monthExpenses.forEach((exp) => {
      const dayNum = parseInt(exp.date.split('-')[2], 10);
      dailySpendMap.set(dayNum, (dailySpendMap.get(dayNum) || 0) + exp.amount);
    });

    const points: Array<{
      day: number;
      dayLabel: string;
      dateStr: string;
      isElapsed: boolean;
      isBridge: boolean;
      dailyActual: number | null;
      actualCumulative: number | null;
      projectedCumulative: number | null;
      conservativeCumulative: number | null;
      highCumulative: number | null;
      velocity7Cumulative: number | null;
      idealPace: number;
      budgetCeiling: number;
    }> = [];

    let runningActual = 0;
    const conservativeDelta = forecast.confidenceBand.conservative - currentSpend;
    const highDelta = forecast.confidenceBand.high - currentSpend;
    const totalRemainingProjected = Math.max(0.01, forecast.remainingProjectedSpend);

    let accumulatedRemainingBase = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYearMonth}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(currY, currM - 1, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isElapsed = day <= daysElapsed;
      const isBridge = day === daysElapsed;
      const idealPace = Math.round(idealDailyRate * day * 100) / 100;

      if (isElapsed) {
        const spentThisDay = dailySpendMap.get(day) || 0;
        runningActual += spentThisDay;

        points.push({
          day,
          dayLabel: `Day ${day}`,
          dateStr,
          isElapsed: true,
          isBridge,
          dailyActual: Math.round(spentThisDay * 100) / 100,
          actualCumulative: Math.round(runningActual * 100) / 100,
          // Bridge point connects the actual line to the projected dashed lines seamlessly
          projectedCumulative: isBridge ? Math.round(runningActual * 100) / 100 : null,
          conservativeCumulative: isBridge ? Math.round(runningActual * 100) / 100 : null,
          highCumulative: isBridge ? Math.round(runningActual * 100) / 100 : null,
          velocity7Cumulative: isBridge ? Math.round(runningActual * 100) / 100 : null,
          idealPace,
          budgetCeiling: budget,
        });
      } else {
        // Future days: project accumulation
        const dayEstimatedSpend = isWeekend ? forecast.weekendRunRate : forecast.weekdayRunRate;
        accumulatedRemainingBase += dayEstimatedSpend;

        const progressRatio = Math.min(1, accumulatedRemainingBase / totalRemainingProjected);
        const projectedCum = currentSpend + accumulatedRemainingBase;
        const conservativeCum = currentSpend + (conservativeDelta * progressRatio);
        const highCum = currentSpend + (highDelta * progressRatio);
        const velocity7Cum = currentSpend + (forecast.recent7DayRunRate * (day - daysElapsed));

        points.push({
          day,
          dayLabel: `Day ${day}`,
          dateStr,
          isElapsed: false,
          isBridge: false,
          dailyActual: null,
          actualCumulative: null,
          projectedCumulative: Math.round(projectedCum * 100) / 100,
          conservativeCumulative: Math.round(conservativeCum * 100) / 100,
          highCumulative: Math.round(highCum * 100) / 100,
          velocity7Cumulative: Math.round(velocity7Cum * 100) / 100,
          idealPace,
          budgetCeiling: budget,
        });
      }
    }

    return points;
  }, [selectedYearMonth, forecast, expenses]);

  // --------------------------------------------------------------------------
  // 30-Day Multi-Line Graph Calculations (Last 30 Days vs Previous 30 Days)
  // --------------------------------------------------------------------------
  const comparisonData = useMemo(() => {
    // Determine anchor date: latest date among recorded expenses or fallback to '2026-10-29'
    let anchorDateStr = '2026-10-29';
    if (expenses.length > 0) {
      const maxDate = expenses.reduce((max, e) => (e.date > max ? e.date : max), expenses[0].date);
      if (maxDate > anchorDateStr) {
        anchorDateStr = maxDate;
      }
    }

    const [aY, aM, aD] = anchorDateStr.split('-').map(Number);
    const anchorDate = new Date(aY, aM - 1, aD);

    // Map daily spend and transaction counts for all expenses
    const dailyMap = new Map<string, number>();
    const countMap = new Map<string, number>();
    expenses.forEach((e) => {
      dailyMap.set(e.date, (dailyMap.get(e.date) || 0) + e.amount);
      countMap.set(e.date, (countMap.get(e.date) || 0) + 1);
    });

    const formatYMD = (d: Date) => {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${da}`;
    };

    // Build 30 points (i = 29 down to 0)
    // Current 30 days: (anchor - 29 days) to anchor
    // Previous 30 days: (anchor - 59 days) to (anchor - 30 days)
    const points: Array<{
      dayIndex: number;
      dayLabel: string;
      shortDateCurrent: string;
      shortDatePrevious: string;
      currentDate: string;
      previousDate: string;
      currentSpend: number;
      previousSpend: number;
      currentCount: number;
      previousCount: number;
      currentCumulative: number;
      previousCumulative: number;
      currentRolling: number;
      previousRolling: number;
    }> = [];

    let cumCurrent = 0;
    let cumPrevious = 0;

    for (let i = 29; i >= 0; i--) {
      const dayNum = 30 - i; // Day 1 to Day 30

      const cDate = new Date(anchorDate);
      cDate.setDate(anchorDate.getDate() - i);
      const cDateStr = formatYMD(cDate);

      const pDate = new Date(anchorDate);
      pDate.setDate(anchorDate.getDate() - i - 30);
      const pDateStr = formatYMD(pDate);

      const cSpend = dailyMap.get(cDateStr) || 0;
      const pSpend = dailyMap.get(pDateStr) || 0;

      cumCurrent += cSpend;
      cumPrevious += pSpend;

      points.push({
        dayIndex: dayNum,
        dayLabel: `Day ${dayNum}`,
        shortDateCurrent: cDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        shortDatePrevious: pDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        currentDate: cDateStr,
        previousDate: pDateStr,
        currentSpend: Math.round(cSpend * 100) / 100,
        previousSpend: Math.round(pSpend * 100) / 100,
        currentCount: countMap.get(cDateStr) || 0,
        previousCount: countMap.get(pDateStr) || 0,
        currentCumulative: Math.round(cumCurrent * 100) / 100,
        previousCumulative: Math.round(cumPrevious * 100) / 100,
        currentRolling: 0,
        previousRolling: 0,
      });
    }

    // Calculate 7-day rolling averages
    for (let i = 0; i < points.length; i++) {
      const windowStart = Math.max(0, i - 6);
      const windowSlice = points.slice(windowStart, i + 1);
      const cRollingSum = windowSlice.reduce((s, p) => s + p.currentSpend, 0);
      const pRollingSum = windowSlice.reduce((s, p) => s + p.previousSpend, 0);

      points[i].currentRolling = Math.round((cRollingSum / windowSlice.length) * 100) / 100;
      points[i].previousRolling = Math.round((pRollingSum / windowSlice.length) * 100) / 100;
    }

    const currentTotal = cumCurrent;
    const previousTotal = cumPrevious;
    const diff = currentTotal - previousTotal;
    const pctDiff = previousTotal > 0 ? (diff / previousTotal) * 100 : 0;
    const currentAvg = currentTotal / 30;
    const previousAvg = previousTotal / 30;

    const startDateCurrent = points[0]?.currentDate || '';
    const endDateCurrent = points[points.length - 1]?.currentDate || '';
    const startDatePrev = points[0]?.previousDate || '';
    const endDatePrev = points[points.length - 1]?.previousDate || '';

    // Peak spend days
    const peakCurrentPoint = [...points].sort((a, b) => b.currentSpend - a.currentSpend)[0];
    const peakPreviousPoint = [...points].sort((a, b) => b.previousSpend - a.previousSpend)[0];

    return {
      points,
      currentTotal,
      previousTotal,
      diff,
      pctDiff,
      currentAvg,
      previousAvg,
      startDateCurrent,
      endDateCurrent,
      startDatePrev,
      endDatePrev,
      peakCurrentPoint,
      peakPreviousPoint,
    };
  }, [expenses]);

  // --------------------------------------------------------------------------
  // Selected-Month Daily Spending Trend Calculations (Day 1..N of selectedYearMonth)
  // --------------------------------------------------------------------------
  const monthlyDailyTrend = useMemo(() => {
    const [yearNum, monthNum] = selectedYearMonth.split('-').map(Number);
    const daysInMonth = getDaysInMonth(selectedYearMonth);
    const monthExpenses = expenses.filter((e) => e.date.startsWith(selectedYearMonth));

    // Categories present in the selected month sorted by spend
    const catTotalsMap = new Map<ExpenseCategory, number>();
    monthExpenses.forEach((e) => {
      catTotalsMap.set(e.category, (catTotalsMap.get(e.category) || 0) + e.amount);
    });
    const availableCategories = Array.from(catTotalsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    const activeExpenses =
      spendingTrendCategory === 'all'
        ? monthExpenses
        : monthExpenses.filter((e) => e.category === spendingTrendCategory);

    const dayBuckets = new Map<
      number,
      { amount: number; count: number; catMap: Map<ExpenseCategory, number> }
    >();

    activeExpenses.forEach((exp) => {
      const day = parseInt(exp.date.split('-')[2], 10);
      const current = dayBuckets.get(day) || {
        amount: 0,
        count: 0,
        catMap: new Map<ExpenseCategory, number>(),
      };
      current.amount += exp.amount;
      current.count += 1;
      current.catMap.set(exp.category, (current.catMap.get(exp.category) || 0) + exp.amount);
      dayBuckets.set(day, current);
    });

    const dailyTarget = budgetSettings.dailyTarget || 0;
    const points: Array<{
      day: number;
      dayLabel: string;
      shortDate: string;
      dateStr: string;
      dailySpend: number;
      rollingAvg: number;
      txCount: number;
      topCategory: string | null;
      topCategoryAmount: number;
      isOverTarget: boolean;
      isHighSpend: boolean;
      isPeakDay: boolean;
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYearMonth}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(yearNum, monthNum - 1, d);
      const shortDate = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const bucket = dayBuckets.get(d);
      const dailySpend = bucket ? Math.round(bucket.amount * 100) / 100 : 0;

      let topCategory: string | null = null;
      let topCategoryAmount = 0;
      if (bucket && bucket.catMap.size > 0) {
        for (const [cat, amt] of bucket.catMap.entries()) {
          if (amt > topCategoryAmount) {
            topCategory = cat;
            topCategoryAmount = Math.round(amt * 100) / 100;
          }
        }
      }

      points.push({
        day: d,
        dayLabel: `${d}`,
        shortDate,
        dateStr,
        dailySpend,
        rollingAvg: 0,
        txCount: bucket?.count || 0,
        topCategory,
        topCategoryAmount,
        isOverTarget: dailyTarget > 0 && dailySpend > dailyTarget,
        isHighSpend: false,
        isPeakDay: false,
      });
    }

    // 7-day trailing moving average across the month
    for (let i = 0; i < points.length; i++) {
      const startIdx = Math.max(0, i - 6);
      const slice = points.slice(startIdx, i + 1);
      const avg = slice.reduce((sum, p) => sum + p.dailySpend, 0) / slice.length;
      points[i].rollingAvg = Math.round(avg * 100) / 100;
    }

    const totalSpend = Math.round(points.reduce((sum, p) => sum + p.dailySpend, 0) * 100) / 100;
    const activeDaysCount = points.filter((p) => p.dailySpend > 0).length;
    const elapsedDays = forecast.daysElapsed > 0 ? forecast.daysElapsed : daysInMonth;
    const avgDailySpend = elapsedDays > 0 ? totalSpend / elapsedDays : 0;
    const peakDay = [...points].sort((a, b) => b.dailySpend - a.dailySpend)[0] || null;
    const daysOverTarget =
      spendingTrendCategory === 'all' && dailyTarget > 0
        ? points.filter((p) => p.dailySpend > dailyTarget).length
        : 0;

    // Identify high-spend threshold (daily target when viewing all categories, else 1.5x daily average)
    const highSpendThreshold =
      spendingTrendCategory === 'all' && dailyTarget > 0
        ? dailyTarget
        : avgDailySpend > 0
        ? Math.round(avgDailySpend * 1.5 * 100) / 100
        : 0;

    points.forEach((p) => {
      p.isHighSpend = p.dailySpend > 0 && highSpendThreshold > 0 && p.dailySpend > highSpendThreshold;
      p.isPeakDay = Boolean(peakDay && peakDay.dailySpend > 0 && p.day === peakDay.day);
    });

    // Group contiguous high-spend days into high-spend periods/windows
    const highSpendPeriods: Array<{
      id: string;
      label: string;
      startDay: number;
      endDay: number;
      dayCount: number;
      totalSpend: number;
      peakSpend: number;
      topCategory: string | null;
    }> = [];

    let currentWindow: typeof points = [];
    const flushWindow = () => {
      if (currentWindow.length === 0) return;
      const first = currentWindow[0];
      const last = currentWindow[currentWindow.length - 1];
      const windowTotal = Math.round(currentWindow.reduce((s, d) => s + d.dailySpend, 0) * 100) / 100;
      const windowPeak = [...currentWindow].sort((a, b) => b.dailySpend - a.dailySpend)[0];
      highSpendPeriods.push({
        id: `${first.day}-${last.day}`,
        label: first.day === last.day ? first.shortDate : `${first.shortDate} – ${last.shortDate}`,
        startDay: first.day,
        endDay: last.day,
        dayCount: currentWindow.length,
        totalSpend: windowTotal,
        peakSpend: windowPeak.dailySpend,
        topCategory: windowPeak.topCategory,
      });
      currentWindow = [];
    };

    points.forEach((p) => {
      if (p.isHighSpend) {
        currentWindow.push(p);
      } else {
        flushWindow();
      }
    });
    flushWindow();

    highSpendPeriods.sort((a, b) => b.totalSpend - a.totalSpend);

    return {
      points,
      availableCategories,
      totalSpend,
      activeDaysCount,
      avgDailySpend,
      peakDay,
      daysOverTarget,
      daysInMonth,
      txTotal: activeExpenses.length,
      highSpendThreshold,
      highSpendPeriods,
      highSpendDaysCount: points.filter((p) => p.isHighSpend).length,
    };
  }, [expenses, selectedYearMonth, spendingTrendCategory, budgetSettings.dailyTarget, forecast.daysElapsed]);

  // --------------------------------------------------------------------------
  // Calendar-Based Expenditure Intensity Heatmap (Selected Month Sun–Sat Grid)
  // --------------------------------------------------------------------------
  const calendarHeatmap = useMemo(() => {
    const [yearNum, monthNum] = selectedYearMonth.split('-').map(Number);
    const daysInMonth = getDaysInMonth(selectedYearMonth);
    const firstWeekday = new Date(yearNum, monthNum - 1, 1).getDay(); // 0 = Sun..6 = Sat

    const monthExpenses = expenses.filter((e) => e.date.startsWith(selectedYearMonth));
    const catTotals = new Map<ExpenseCategory, number>();
    monthExpenses.forEach((e) => {
      catTotals.set(e.category, (catTotals.get(e.category) || 0) + e.amount);
    });
    const availableCategories = Array.from(catTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    const activeExpenses =
      heatmapCategory === 'all'
        ? monthExpenses
        : monthExpenses.filter((e) => e.category === heatmapCategory);

    const byDate = new Map<string, Expense[]>();
    activeExpenses.forEach((exp) => {
      const list = byDate.get(exp.date) || [];
      list.push(exp);
      byDate.set(exp.date, list);
    });

    const rawDays = Array.from({ length: daysInMonth }, (_, idx) => {
      const day = idx + 1;
      const dateStr = `${selectedYearMonth}-${String(day).padStart(2, '0')}`;
      const dayExps = [...(byDate.get(dateStr) || [])].sort((a, b) => b.amount - a.amount);
      const totalSpend = Math.round(dayExps.reduce((s, e) => s + e.amount, 0) * 100) / 100;
      return {
        day,
        dateStr,
        totalSpend,
        expenses: dayExps,
        txCount: dayExps.length,
        weekdayIndex: (firstWeekday + idx) % 7,
      };
    });

    const activeAmounts = rawDays
      .filter((d) => d.totalSpend > 0)
      .map((d) => d.totalSpend)
      .sort((a, b) => a - b);

    const totalMonthSpend = Math.round(
      rawDays.reduce((s, d) => s + d.totalSpend, 0) * 100
    ) / 100;
    const activeDaysCount = activeAmounts.length;
    const meanActiveSpend = activeDaysCount > 0 ? totalMonthSpend / activeDaysCount : 0;

    let medianActiveSpend = 0;
    if (activeDaysCount > 0) {
      const mid = Math.floor(activeDaysCount / 2);
      medianActiveSpend =
        activeDaysCount % 2 === 1
          ? activeAmounts[mid]
          : (activeAmounts[mid - 1] + activeAmounts[mid]) / 2;
    }

    let stdDevActive = 0;
    if (activeDaysCount >= 2) {
      const variance =
        activeAmounts.reduce((sum, val) => sum + Math.pow(val - meanActiveSpend, 2), 0) /
        activeDaysCount;
      stdDevActive = Math.sqrt(variance);
    }

    const dailyTarget = heatmapCategory === 'all' ? budgetSettings.dailyTarget || 0 : 0;
    const baselineRef =
      dailyTarget > 0
        ? dailyTarget
        : medianActiveSpend > 0
        ? medianActiveSpend
        : meanActiveSpend;

    const spikeThreshold =
      baselineRef > 0
        ? Math.round(
            Math.max(
              baselineRef * 1.65,
              activeDaysCount >= 3 && stdDevActive > 0 ? meanActiveSpend + stdDevActive : 0
            ) * 100
          ) / 100
        : 0;

    const maxSpend = activeAmounts.length > 0 ? activeAmounts[activeAmounts.length - 1] : 0;

    type IntensityTier = 0 | 1 | 2 | 3 | 4;
    const days = rawDays.map((d) => {
      let tier: IntensityTier = 0;
      let tierLabel = 'No Spend';

      if (d.totalSpend > 0) {
        if (baselineRef <= 0) {
          tier = 1;
          tierLabel = 'Low';
        } else {
          const ratio = d.totalSpend / baselineRef;
          if ((spikeThreshold > 0 && d.totalSpend >= spikeThreshold) || ratio >= 1.75) {
            tier = 4;
            tierLabel = 'Unusually High';
          } else if (ratio >= 1.0) {
            tier = 3;
            tierLabel = 'Elevated';
          } else if (ratio >= 0.45) {
            tier = 2;
            tierLabel = 'Moderate';
          } else {
            tier = 1;
            tierLabel = 'Low';
          }
        }
      }

      const intensityPct = maxSpend > 0 ? Math.min(100, (d.totalSpend / maxSpend) * 100) : 0;
      const fullDateLabel = new Date(yearNum, monthNum - 1, d.day).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      return {
        ...d,
        tier,
        tierLabel,
        intensityPct,
        fullDateLabel,
        isSpike: tier === 4,
      };
    });

    const trailingBlanks = (7 - ((firstWeekday + daysInMonth) % 7)) % 7;
    const spikeDays = days
      .filter((d) => d.isSpike)
      .sort((a, b) => b.totalSpend - a.totalSpend);
    const peakDay =
      [...days].filter((d) => d.totalSpend > 0).sort((a, b) => b.totalSpend - a.totalSpend)[0] ||
      null;

    // Weekday average spend distribution (Sun..Sat)
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdaySummary = weekdayNames.map((name, idx) => {
      const matching = days.filter((d) => d.weekdayIndex === idx);
      const total = matching.reduce((s, d) => s + d.totalSpend, 0);
      const avg = matching.length > 0 ? total / matching.length : 0;
      return { name, total, avg };
    });
    const heaviestWeekday = [...weekdaySummary].sort((a, b) => b.avg - a.avg)[0] || null;

    return {
      days,
      leadingBlanks: firstWeekday,
      trailingBlanks,
      availableCategories,
      totalMonthSpend,
      activeDaysCount,
      daysInMonth,
      baselineRef,
      spikeThreshold,
      maxSpend,
      spikeDays,
      peakDay,
      heaviestWeekday,
    };
  }, [expenses, selectedYearMonth, heatmapCategory, budgetSettings.dailyTarget]);

  // --------------------------------------------------------------------------
  // Month-over-Month (MoM) Spending Comparison (Selected vs. Previous Month)
  // --------------------------------------------------------------------------
  const monthOverMonth = useMemo(() => {
    const prevYearMonth = getPreviousYearMonth(selectedYearMonth);
    const currentLabel = formatMonthYear(selectedYearMonth);
    const prevLabel = formatMonthYear(prevYearMonth);

    const currentExpenses = expenses.filter((e) => e.date.startsWith(selectedYearMonth));
    const prevExpenses = expenses.filter((e) => e.date.startsWith(prevYearMonth));

    const currentTotal = Math.round(currentExpenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
    const prevTotal = Math.round(prevExpenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
    const absoluteDelta = Math.round((currentTotal - prevTotal) * 100) / 100;

    let percentChange: number | null = null;
    if (prevTotal > 0) {
      percentChange = Math.round(((currentTotal - prevTotal) / prevTotal) * 1000) / 10;
    }

    let direction: 'up' | 'down' | 'flat' | 'no-baseline' = 'flat';
    if (prevTotal === 0 && currentTotal > 0) {
      direction = 'no-baseline';
    } else if (prevTotal === 0 && currentTotal === 0) {
      direction = 'flat';
    } else if (absoluteDelta > 0.01) {
      direction = 'up';
    } else if (absoluteDelta < -0.01) {
      direction = 'down';
    }

    const currentTxCount = currentExpenses.length;
    const prevTxCount = prevExpenses.length;
    const currentAvgTx = currentTxCount > 0 ? currentTotal / currentTxCount : 0;
    const prevAvgTx = prevTxCount > 0 ? prevTotal / prevTxCount : 0;

    // Same-period pace (Day 1..daysElapsed) when selected month is still in progress
    const isPartialMonth = forecast.daysElapsed > 0 && forecast.daysElapsed < forecast.daysInMonth;
    const paceDays = isPartialMonth ? forecast.daysElapsed : Math.min(forecast.daysInMonth, getDaysInMonth(prevYearMonth));
    const mtdCurrent = isPartialMonth
      ? currentExpenses
          .filter((e) => parseInt(e.date.split('-')[2], 10) <= paceDays)
          .reduce((sum, e) => sum + e.amount, 0)
      : currentTotal;
    const mtdPrev = isPartialMonth
      ? prevExpenses
          .filter((e) => parseInt(e.date.split('-')[2], 10) <= paceDays)
          .reduce((sum, e) => sum + e.amount, 0)
      : prevTotal;
    const mtdDelta = Math.round((mtdCurrent - mtdPrev) * 100) / 100;
    const mtdPercentChange =
      mtdPrev > 0 ? Math.round(((mtdCurrent - mtdPrev) / mtdPrev) * 1000) / 10 : null;

    // Category-level comparison
    const currCatMap = new Map<ExpenseCategory, number>();
    calculateCategoryBreakdown(currentExpenses).forEach((c) => {
      currCatMap.set(c.category, c.amount);
    });
    const prevCatMap = new Map<ExpenseCategory, number>();
    calculateCategoryBreakdown(prevExpenses).forEach((c) => {
      prevCatMap.set(c.category, c.amount);
    });

    const allCats = new Set<ExpenseCategory>([
      ...currCatMap.keys(),
      ...prevCatMap.keys(),
    ]);

    const categoryDrivers = Array.from(allCats)
      .map((cat) => {
        const currAmt = Math.round((currCatMap.get(cat) || 0) * 100) / 100;
        const prevAmt = Math.round((prevCatMap.get(cat) || 0) * 100) / 100;
        const delta = Math.round((currAmt - prevAmt) * 100) / 100;
        const pct = prevAmt > 0 ? Math.round(((currAmt - prevAmt) / prevAmt) * 1000) / 10 : null;
        return {
          category: cat,
          shortName: cat.length > 13 ? `${cat.slice(0, 12)}…` : cat,
          currentAmount: currAmt,
          prevAmount: prevAmt,
          delta,
          pctChange: pct,
          color: CATEGORY_COLORS[cat]?.bar || '#10b981',
        };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const chartData = [...categoryDrivers]
      .sort(
        (a, b) =>
          Math.max(b.currentAmount, b.prevAmount) - Math.max(a.currentAmount, a.prevAmount)
      )
      .slice(0, 6);

    return {
      prevYearMonth,
      currentLabel,
      prevLabel,
      currentTotal,
      prevTotal,
      absoluteDelta,
      percentChange,
      direction,
      currentTxCount,
      prevTxCount,
      currentAvgTx,
      prevAvgTx,
      isPartialMonth,
      paceDays,
      mtdCurrent,
      mtdPrev,
      mtdDelta,
      mtdPercentChange,
      categoryDrivers,
      chartData,
    };
  }, [expenses, selectedYearMonth, forecast.daysElapsed, forecast.daysInMonth]);

  // --------------------------------------------------------------------------
  // Category Spending Limits & Progress (Selected Month vs Assigned Caps)
  // --------------------------------------------------------------------------
  const categoryLimitProgress = useMemo(() => {
    const monthExpenses = expenses.filter((e) => e.date.startsWith(selectedYearMonth));
    const spendMap = new Map<ExpenseCategory, { spent: number; count: number }>();

    monthExpenses.forEach((exp) => {
      const current = spendMap.get(exp.category) || { spent: 0, count: 0 };
      spendMap.set(exp.category, {
        spent: current.spent + exp.amount,
        count: current.count + 1,
      });
    });

    const items = CATEGORIES.map((category) => {
      const data = spendMap.get(category) || { spent: 0, count: 0 };
      const spent = Math.round(data.spent * 100) / 100;
      const rawLimit = budgetSettings.categoryBudgets?.[category];
      const hasLimit = typeof rawLimit === 'number' && !isNaN(rawLimit) && rawLimit >= 0;
      const limit = hasLimit ? rawLimit : null;

      let percentage: number | null = null;
      if (hasLimit && limit !== null) {
        if (limit > 0) {
          percentage = (spent / limit) * 100;
        } else {
          percentage = spent > 0 ? 100 : 0;
        }
      }

      const remaining = hasLimit && limit !== null ? Math.round((limit - spent) * 100) / 100 : null;
      const isOver = hasLimit && limit !== null && spent > limit + 0.005;
      const isNear = hasLimit && !isOver && percentage !== null && percentage >= 75;
      const status: 'over' | 'warning' | 'on-track' | 'unbudgeted' = !hasLimit
        ? 'unbudgeted'
        : isOver
        ? 'over'
        : isNear
        ? 'warning'
        : 'on-track';

      return {
        category,
        spent,
        txCount: data.count,
        limit,
        hasLimit,
        percentage,
        remaining,
        status,
        color: CATEGORY_COLORS[category]?.bar || '#10b981',
      };
    });

    const activeOrCapped = items
      .filter((item) => item.hasLimit || item.spent > 0)
      .sort((a, b) => {
        if (a.hasLimit !== b.hasLimit) return a.hasLimit ? -1 : 1;
        if (a.hasLimit && b.hasLimit) {
          return (b.percentage || 0) - (a.percentage || 0);
        }
        return b.spent - a.spent;
      });

    const cappedItems = items.filter((item) => item.hasLimit);
    const totalAssignedLimits = Math.round(
      cappedItems.reduce((sum, item) => sum + (item.limit || 0), 0) * 100
    ) / 100;
    const totalSpentInCapped = Math.round(
      cappedItems.reduce((sum, item) => sum + item.spent, 0) * 100
    ) / 100;
    const overallCappedPct =
      totalAssignedLimits > 0
        ? (totalSpentInCapped / totalAssignedLimits) * 100
        : totalSpentInCapped > 0
        ? 100
        : 0;

    const overLimitCount = cappedItems.filter((i) => i.status === 'over').length;
    const nearLimitCount = cappedItems.filter((i) => i.status === 'warning').length;
    const onTrackCount = cappedItems.filter((i) => i.status === 'on-track').length;
    const unbudgetedActiveCount = items.filter((i) => !i.hasLimit && i.spent > 0).length;

    return {
      items: activeOrCapped,
      cappedItems,
      totalAssignedLimits,
      totalSpentInCapped,
      overallCappedPct,
      overLimitCount,
      nearLimitCount,
      onTrackCount,
      unbudgetedActiveCount,
    };
  }, [expenses, selectedYearMonth, budgetSettings.categoryBudgets]);

  return (
    <div className="space-y-6">
      {/* Top Controls & Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              AI Financial Intelligence & Insights
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Comparative 30-day velocity, label allocation donut breakdown, and actionable savings strategies
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <select
            value={selectedYearMonth}
            onChange={(e) => onSelectYearMonth(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-500 transition-colors"
          >
            {availableMonths.map((ym) => (
              <option key={ym} value={ym}>
                {formatMonthYear(ym)}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchInsights}
            disabled={isLoading}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isLoading ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''
              }`}
            />
            <span>{isLoading ? 'Analyzing...' : 'Re-Analyze'}</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* DAILY SPENDING TREND OVER SELECTED MONTH (RECHARTS LINE CHART)         */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs transition-colors space-y-5">
        {/* Header & Overlay Toggles */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Daily Spending Trend — {formatMonthYear(selectedYearMonth)}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Day-by-day total spending across {formatMonthYear(selectedYearMonth)} ({monthlyDailyTrend.txTotal}{' '}
              {monthlyDailyTrend.txTotal === 1 ? 'transaction' : 'transactions'}) with high-spend spikes highlighted
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTrendRollingAvg((prev) => !prev)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                showTrendRollingAvg
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  showTrendRollingAvg ? 'bg-indigo-500' : 'bg-slate-400'
                }`}
              />
              <span>7-Day Moving Avg</span>
            </button>

            {spendingTrendCategory === 'all' && budgetSettings.dailyTarget > 0 && (
              <button
                type="button"
                onClick={() => setShowDailyTargetLine((prev) => !prev)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                  showDailyTargetLine
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    showDailyTargetLine ? 'bg-amber-500' : 'bg-slate-400'
                  }`}
                />
                <span>Daily Target ({formatCurrency(budgetSettings.dailyTarget, currency)})</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        {monthlyDailyTrend.availableCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSpendingTrendCategory('all')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                spendingTrendCategory === 'all'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-semibold shadow-2xs'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              All Categories
            </button>
            {monthlyDailyTrend.availableCategories.map((cat) => {
              const active = spendingTrendCategory === cat;
              const catColor = CATEGORY_COLORS[cat]?.bar || '#10b981';
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSpendingTrendCategory(active ? 'all' : cat)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors flex items-center gap-1.5 ${
                    active
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white font-semibold shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: catColor }}
                  />
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Quick Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
              {spendingTrendCategory === 'all' ? 'Month Total' : `${spendingTrendCategory} Total`}
            </span>
            <span className="text-lg font-bold font-mono tabular-nums text-slate-950 dark:text-white mt-0.5 block">
              {formatCurrency(monthlyDailyTrend.totalSpend, currency)}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
              Daily Average
            </span>
            <span className="text-lg font-bold font-mono tabular-nums text-slate-950 dark:text-white mt-0.5 block">
              {formatCurrency(monthlyDailyTrend.avgDailySpend, currency)}
              <span className="text-[11px] font-normal text-slate-500 font-sans">/day</span>
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
              Peak Spend Day
            </span>
            <span className="text-lg font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-0.5 block">
              {formatCurrency(monthlyDailyTrend.peakDay?.dailySpend || 0, currency)}
            </span>
            {monthlyDailyTrend.peakDay && monthlyDailyTrend.peakDay.dailySpend > 0 && (
              <span className="text-[10px] text-slate-500 font-mono">
                {monthlyDailyTrend.peakDay.shortDate}
                {monthlyDailyTrend.peakDay.topCategory
                  ? ` · ${monthlyDailyTrend.peakDay.topCategory}`
                  : ''}
              </span>
            )}
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
              {spendingTrendCategory === 'all' && budgetSettings.dailyTarget > 0
                ? 'High-Spend Days'
                : 'Elevated Spend Days'}
            </span>
            <span className="text-lg font-bold font-mono tabular-nums text-slate-950 dark:text-white mt-0.5 block">
              {monthlyDailyTrend.highSpendDaysCount}
              <span className="text-xs font-normal text-slate-500 font-mono ml-1">
                / {monthlyDailyTrend.daysInMonth}d
              </span>
            </span>
            {monthlyDailyTrend.highSpendThreshold > 0 && (
              <span className="text-[10px] text-slate-500 font-mono">
                Above {formatCurrency(monthlyDailyTrend.highSpendThreshold, currency)}/day
              </span>
            )}
          </div>
        </div>

        {/* Recharts LineChart */}
        {monthlyDailyTrend.txTotal > 0 ? (
          <div className="space-y-4">
            <div className="w-full h-72 sm:h-80 select-none pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyDailyTrend.points}
                  margin={{ top: 14, right: 18, left: 0, bottom: 6 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="shortDate"
                    stroke={theme === 'light' ? '#64748b' : '#94a3b8'}
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: theme === 'light' ? '#cbd5e1' : '#334155' }}
                    interval={4}
                  />
                  <YAxis
                    stroke={theme === 'light' ? '#64748b' : '#94a3b8'}
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: theme === 'light' ? '#cbd5e1' : '#334155' }}
                    tickFormatter={(val) => {
                      const sym = CURRENCY_SYMBOLS[currency] || '$';
                      return val >= 1000 ? `${sym}${(val / 1000).toFixed(1)}k` : `${sym}${val}`;
                    }}
                    width={58}
                  />
                  {showDailyTargetLine &&
                    spendingTrendCategory === 'all' &&
                    budgetSettings.dailyTarget > 0 && (
                      <ReferenceLine
                        y={budgetSettings.dailyTarget}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: `Target: ${formatCurrency(budgetSettings.dailyTarget, currency)}`,
                          fill: theme === 'light' ? '#b45309' : '#fbbf24',
                          fontSize: 10,
                          position: 'insideTopRight',
                        }}
                      />
                    )}
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const pt = payload[0]?.payload;
                        if (!pt) return null;
                        const lineColor =
                          spendingTrendCategory === 'all'
                            ? '#10b981'
                            : CATEGORY_COLORS[spendingTrendCategory]?.bar || '#10b981';

                        return (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-xl text-xs font-mono space-y-1.5 min-w-[220px]">
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {pt.shortDate}
                              </span>
                              <span className="text-[10px] text-slate-500 font-sans">
                                {pt.txCount} {pt.txCount === 1 ? 'transaction' : 'transactions'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-sans text-[11px]">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: pt.isHighSpend ? '#f43f5e' : lineColor }}
                                />
                                <span>Daily Spend:</span>
                              </span>
                              <span
                                className={`font-bold tabular-nums ${
                                  pt.isHighSpend
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-950 dark:text-white'
                                }`}
                              >
                                {formatCurrency(pt.dailySpend, currency)}
                              </span>
                            </div>

                            {pt.isHighSpend && (
                              <div className="text-[10px] font-sans font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>
                                  {pt.isPeakDay ? 'Monthly peak spend day' : 'High-spend spike day'}
                                </span>
                              </div>
                            )}

                            {showTrendRollingAvg && (
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-sans text-[11px]">
                                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                  <span>7-Day Avg:</span>
                                </span>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                  {formatCurrency(pt.rollingAvg, currency)}
                                </span>
                              </div>
                            )}

                            {pt.topCategory && spendingTrendCategory === 'all' && (
                              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-sans">
                                <span className="text-slate-500">Top category:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {pt.topCategory} ({formatCurrency(pt.topCategoryAmount, currency)})
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <RechartsLegend
                    content={() => {
                      const lineColor =
                        spendingTrendCategory === 'all'
                          ? '#10b981'
                          : CATEGORY_COLORS[spendingTrendCategory]?.bar || '#10b981';
                      return (
                        <div className="flex flex-wrap items-center justify-center gap-5 pt-3 text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-4 h-0.5 inline-block rounded-full"
                              style={{ backgroundColor: lineColor }}
                            />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {spendingTrendCategory === 'all'
                                ? 'Daily Spending'
                                : `${spendingTrendCategory} Daily Spend`}
                            </span>
                          </div>
                          {monthlyDailyTrend.highSpendDaysCount > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                              <span className="font-medium text-slate-600 dark:text-slate-400">
                                High-Spend Spike
                              </span>
                            </div>
                          )}
                          {showTrendRollingAvg && (
                            <div className="flex items-center gap-2">
                              <span
                                className="w-4 h-0.5 inline-block rounded-full"
                                style={{ borderTop: '2px dashed #6366f1' }}
                              />
                              <span className="font-medium text-slate-600 dark:text-slate-400">
                                7-Day Moving Avg
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="dailySpend"
                    name="Daily Spending"
                    stroke={
                      spendingTrendCategory === 'all'
                        ? '#10b981'
                        : CATEGORY_COLORS[spendingTrendCategory]?.bar || '#10b981'
                    }
                    strokeWidth={2.5}
                    dot={(dotProps: any) => {
                      const { cx, cy, payload } = dotProps;
                      if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) {
                        return <g key={`empty-${dotProps.index}`} />;
                      }
                      const baseColor =
                        spendingTrendCategory === 'all'
                          ? '#10b981'
                          : CATEGORY_COLORS[spendingTrendCategory]?.bar || '#10b981';
                      const isHigh = Boolean(payload.isHighSpend);
                      const isPeak = Boolean(payload.isPeakDay);
                      const r = isPeak ? 5.5 : isHigh ? 4.5 : 2.75;
                      const fill = isHigh ? '#f43f5e' : baseColor;

                      return (
                        <circle
                          key={`trend-dot-${payload.day}`}
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={fill}
                          stroke={theme === 'light' ? '#ffffff' : '#0f172a'}
                          strokeWidth={isHigh ? 2 : 1.5}
                        />
                      );
                    }}
                    activeDot={{
                      r: 6,
                      fill:
                        spendingTrendCategory === 'all'
                          ? '#10b981'
                          : CATEGORY_COLORS[spendingTrendCategory]?.bar || '#10b981',
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                  />
                  {showTrendRollingAvg && (
                    <Line
                      type="monotone"
                      dataKey="rollingAvg"
                      name="7-Day Moving Avg"
                      stroke="#6366f1"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{
                        r: 4,
                        fill: '#6366f1',
                        stroke: '#ffffff',
                        strokeWidth: 1.5,
                      }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Identified High-Spend Periods */}
            {monthlyDailyTrend.highSpendPeriods.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Identified High-Spend Periods</span>
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    Days exceeding {formatCurrency(monthlyDailyTrend.highSpendThreshold, currency)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {monthlyDailyTrend.highSpendPeriods.slice(0, 3).map((period) => (
                    <div
                      key={period.id}
                      className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {period.label}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {period.dayCount} {period.dayCount === 1 ? 'day' : 'consecutive days'}
                          {period.topCategory ? ` · ${period.topCategory}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <div className="font-bold text-rose-600 dark:text-rose-400">
                          {formatCurrency(period.totalSpend, currency)}
                        </div>
                        {period.dayCount > 1 && (
                          <div className="text-[10px] text-slate-500">
                            Peak {formatCurrency(period.peakSpend, currency)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
            <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No spending recorded for {formatMonthYear(selectedYearMonth)}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Log expenses in {formatMonthYear(selectedYearMonth)} or clear active filters to visualize the daily spending trend.
            </p>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* CALENDAR EXPENDITURE INTENSITY HEATMAP                                 */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs transition-colors space-y-5">
        {/* Header & Category Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Daily Expenditure Intensity Heatmap — {formatMonthYear(selectedYearMonth)}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Calendar intensity map highlighting unusually high-spending days against your{' '}
              {heatmapCategory === 'all' && budgetSettings.dailyTarget > 0
                ? `${formatCurrency(budgetSettings.dailyTarget, currency)}/day target`
                : 'monthly baseline'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={heatmapCategory}
              onChange={(e) => {
                setHeatmapCategory(e.target.value as 'all' | ExpenseCategory);
                setSelectedHeatmapDate(null);
              }}
              aria-label="Filter calendar heatmap by category"
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-emerald-500 transition-colors"
            >
              <option value="all">All Categories</option>
              {calendarHeatmap.availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Strip + Gradient Scale Legend */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl text-xs">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Active Days: </span>
              <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {calendarHeatmap.activeDaysCount}/{calendarHeatmap.daysInMonth}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Unusual Spike Days: </span>
              <span
                className={`font-bold font-mono tabular-nums ${
                  calendarHeatmap.spikeDays.length > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {calendarHeatmap.spikeDays.length}
              </span>
            </div>
            {calendarHeatmap.heaviestWeekday && calendarHeatmap.heaviestWeekday.avg > 0 && (
              <div>
                <span className="text-slate-500 dark:text-slate-400">Heaviest Weekday: </span>
                <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {calendarHeatmap.heaviestWeekday.name} (
                  {formatCurrency(calendarHeatmap.heaviestWeekday.avg, currency)} avg)
                </span>
              </div>
            )}
          </div>

          {/* 5-Step Intensity Gradient Legend */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            <span>$0</span>
            <div className="flex items-center gap-1" aria-label="Expenditure intensity scale">
              <span
                title="No spend"
                className="w-4 h-4 rounded-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
              <span
                title="Low intensity"
                className="w-4 h-4 rounded-xs bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800"
              />
              <span
                title="Moderate intensity"
                className="w-4 h-4 rounded-xs bg-emerald-300/80 dark:bg-emerald-700/70 border border-emerald-400 dark:border-emerald-600"
              />
              <span
                title="Elevated intensity"
                className="w-4 h-4 rounded-xs bg-amber-200 dark:bg-amber-800/70 border border-amber-400 dark:border-amber-600"
              />
              <span
                title="Unusually high spike"
                className="w-4 h-4 rounded-xs bg-rose-500/80 dark:bg-rose-600 border border-rose-600 dark:border-rose-400"
              />
            </div>
            <span className="font-medium text-rose-600 dark:text-rose-400">Spike</span>
          </div>
        </div>

        {/* Main Grid: 7-Column Calendar + Day Inspector */}
        {(() => {
          const activeInspectDate =
            selectedHeatmapDate || calendarHeatmap.peakDay?.dateStr || calendarHeatmap.days[0]?.dateStr;
          const inspectedDay =
            calendarHeatmap.days.find((d) => d.dateStr === activeInspectDate) ||
            calendarHeatmap.days[0];
          const sym = CURRENCY_SYMBOLS[currency] || '$';

          const tierStyles: Record<number, string> = {
            0: 'bg-slate-50 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700',
            1: 'bg-emerald-50 dark:bg-emerald-950/45 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200 hover:border-emerald-400',
            2: 'bg-emerald-200/75 dark:bg-emerald-800/55 border-emerald-300 dark:border-emerald-600/80 text-emerald-950 dark:text-emerald-100 hover:border-emerald-500',
            3: 'bg-amber-100 dark:bg-amber-900/45 border-amber-300 dark:border-amber-700/70 text-amber-950 dark:text-amber-100 hover:border-amber-500',
            4: 'bg-rose-500/20 dark:bg-rose-600/35 border-rose-400 dark:border-rose-500 text-rose-950 dark:text-rose-100 hover:border-rose-600',
          };

          return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Calendar Grid (7 columns Sun..Sat) */}
              <div className="lg:col-span-8 space-y-2">
                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 pb-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((wd) => (
                    <div key={wd}>{wd}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {/* Leading Blank Cells */}
                  {Array.from({ length: calendarHeatmap.leadingBlanks }).map((_, i) => (
                    <div
                      key={`lead-${i}`}
                      className="h-14 sm:h-16 rounded-lg bg-slate-100/40 dark:bg-slate-950/20 border border-dashed border-slate-200/60 dark:border-slate-800/40"
                    />
                  ))}

                  {/* Day Cells */}
                  {calendarHeatmap.days.map((dayObj) => {
                    const isSelected = inspectedDay?.dateStr === dayObj.dateStr;
                    const compactSpend =
                      dayObj.totalSpend === 0
                        ? '—'
                        : dayObj.totalSpend >= 1000
                        ? `${sym}${(dayObj.totalSpend / 1000).toFixed(1)}k`
                        : `${sym}${Math.round(dayObj.totalSpend)}`;

                    return (
                      <button
                        key={dayObj.dateStr}
                        type="button"
                        onClick={() => setSelectedHeatmapDate(dayObj.dateStr)}
                        title={`${dayObj.fullDateLabel}: ${formatCurrency(dayObj.totalSpend, currency)} (${dayObj.tierLabel}, ${dayObj.txCount} txs)`}
                        className={`relative h-14 sm:h-16 p-1.5 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          tierStyles[dayObj.tier]
                        } ${
                          isSelected
                            ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 z-10'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] font-mono tabular-nums font-semibold leading-none">
                            {dayObj.day}
                          </span>
                          {dayObj.isSpike && (
                            <AlertTriangle
                              className="w-3 h-3 text-rose-600 dark:text-rose-300 shrink-0"
                              aria-label="High spend spike"
                            />
                          )}
                        </div>

                        <div className="w-full">
                          <span
                            className={`block font-mono tabular-nums text-[10px] sm:text-[11px] font-bold truncate leading-tight ${
                              dayObj.totalSpend === 0 ? 'opacity-50 font-normal' : ''
                            }`}
                          >
                            {compactSpend}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Trailing Blank Cells */}
                  {Array.from({ length: calendarHeatmap.trailingBlanks }).map((_, i) => (
                    <div
                      key={`trail-${i}`}
                      className="h-14 sm:h-16 rounded-lg bg-slate-100/40 dark:bg-slate-950/20 border border-dashed border-slate-200/60 dark:border-slate-800/40"
                    />
                  ))}
                </div>
              </div>

              {/* Right Column: Day Intensity Inspector + Unusual High-Spending Days */}
              <div className="lg:col-span-4 space-y-3">
                {inspectedDay && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                          Selected Day
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {inspectedDay.fullDateLabel}
                        </h4>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                          inspectedDay.tier === 4
                            ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                            : inspectedDay.tier === 3
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                            : inspectedDay.tier >= 1
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {inspectedDay.tierLabel}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
                        {formatCurrency(inspectedDay.totalSpend, currency)}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        {inspectedDay.txCount} {inspectedDay.txCount === 1 ? 'tx' : 'txs'}
                      </span>
                    </div>

                    {calendarHeatmap.baselineRef > 0 && inspectedDay.totalSpend > 0 && (
                      <div className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {(() => {
                          const pctVsBase =
                            ((inspectedDay.totalSpend - calendarHeatmap.baselineRef) /
                              calendarHeatmap.baselineRef) *
                            100;
                          return (
                            <span>
                              {pctVsBase >= 0 ? '+' : ''}
                              {pctVsBase.toFixed(0)}% vs{' '}
                              {heatmapCategory === 'all' && budgetSettings.dailyTarget > 0
                                ? 'daily target'
                                : 'typical day'}
                            </span>
                          );
                        })()}
                      </div>
                    )}

                    {inspectedDay.expenses.length > 0 ? (
                      <div className="space-y-1.5 pt-1 max-h-44 overflow-y-auto pr-1">
                        {inspectedDay.expenses.map((exp) => (
                          <div
                            key={exp.id}
                            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: CATEGORY_COLORS[exp.category]?.bar || '#10b981',
                                }}
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900 dark:text-white truncate">
                                  {exp.merchant}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {exp.category}
                                </div>
                              </div>
                            </div>
                            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white shrink-0">
                              {formatCurrency(exp.amount, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-500 text-center">
                        No expenses logged on {inspectedDay.fullDateLabel}.
                      </div>
                    )}
                  </div>
                )}

                {/* Top Unusual Spike Days Quick-Jump */}
                {calendarHeatmap.spikeDays.length > 0 && (
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>Unusually High-Spending Days</span>
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {calendarHeatmap.spikeDays.slice(0, 4).map((spike) => (
                        <button
                          key={spike.dateStr}
                          type="button"
                          onClick={() => setSelectedHeatmapDate(spike.dateStr)}
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-left flex items-center justify-between gap-2 text-xs transition-colors ${
                            inspectedDay?.dateStr === spike.dateStr
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 dark:text-white block truncate">
                              {spike.fullDateLabel}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate block">
                              {spike.expenses[0]?.merchant || spike.expenses[0]?.category || `${spike.txCount} txs`}
                              {spike.txCount > 1 ? ` +${spike.txCount - 1} more` : ''}
                            </span>
                          </div>
                          <span className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 shrink-0">
                            {formatCurrency(spike.totalSpend, currency)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* MONTH-OVER-MONTH (MoM) SPENDING COMPARISON                             */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs transition-colors space-y-5">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Month-over-Month Comparison
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Total spending variance between{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {monthOverMonth.currentLabel}
              </span>{' '}
              and{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {monthOverMonth.prevLabel}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {availableMonths.includes(monthOverMonth.prevYearMonth) && (
              <button
                type="button"
                onClick={() => onSelectYearMonth(monthOverMonth.prevYearMonth)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                View {monthOverMonth.prevLabel} &rarr;
              </button>
            )}
          </div>
        </div>

        {/* 4-Column MoM Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Selected Month Total */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {monthOverMonth.currentLabel}
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
              {formatCurrency(monthOverMonth.currentTotal, currency)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {monthOverMonth.currentTxCount} {monthOverMonth.currentTxCount === 1 ? 'tx' : 'txs'} &middot;{' '}
              {formatCurrency(monthOverMonth.currentAvgTx, currency)} avg
            </div>
          </div>

          {/* Previous Month Total */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {monthOverMonth.prevLabel}
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
              {formatCurrency(monthOverMonth.prevTotal, currency)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {monthOverMonth.prevTxCount} {monthOverMonth.prevTxCount === 1 ? 'tx' : 'txs'} &middot;{' '}
              {formatCurrency(monthOverMonth.prevAvgTx, currency)} avg
            </div>
          </div>

          {/* Percentage Increase / Decrease */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Month-over-Month Change
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold font-mono tabular-nums inline-flex items-center gap-1 ${
                  monthOverMonth.direction === 'down'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : monthOverMonth.direction === 'up'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {monthOverMonth.direction === 'down' ? (
                  <TrendingDown className="w-5 h-5 shrink-0" />
                ) : monthOverMonth.direction === 'up' ? (
                  <TrendingUp className="w-5 h-5 shrink-0" />
                ) : (
                  <Minus className="w-5 h-5 shrink-0" />
                )}
                <span>
                  {monthOverMonth.percentChange !== null
                    ? `${monthOverMonth.percentChange > 0 ? '+' : ''}${monthOverMonth.percentChange.toFixed(1)}%`
                    : monthOverMonth.direction === 'no-baseline'
                    ? 'New'
                    : '0.0%'}
                </span>
              </span>
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
              {monthOverMonth.direction === 'no-baseline'
                ? `No spend in ${monthOverMonth.prevLabel}`
                : `${monthOverMonth.absoluteDelta > 0 ? '+' : monthOverMonth.absoluteDelta < 0 ? '-' : ''}${formatCurrency(Math.abs(monthOverMonth.absoluteDelta), currency)} (${
                    monthOverMonth.direction === 'down'
                      ? 'decrease'
                      : monthOverMonth.direction === 'up'
                      ? 'increase'
                      : 'unchanged'
                  })`}
            </div>
          </div>

          {/* Same-Day Pace or Daily Average Comparison */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {monthOverMonth.isPartialMonth
                ? `Same-Period Pace (Days 1–${monthOverMonth.paceDays})`
                : 'Daily Spend Average'}
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
              {monthOverMonth.isPartialMonth ? (
                monthOverMonth.mtdPercentChange !== null ? (
                  <span
                    className={
                      monthOverMonth.mtdPercentChange <= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    {monthOverMonth.mtdPercentChange > 0 ? '+' : ''}
                    {monthOverMonth.mtdPercentChange.toFixed(1)}%
                  </span>
                ) : (
                  <span>{formatCurrency(monthOverMonth.mtdCurrent, currency)}</span>
                )
              ) : (
                <span>
                  {formatCurrency(
                    monthOverMonth.currentTotal / Math.max(1, getDaysInMonth(selectedYearMonth)),
                    currency
                  )}
                  <span className="text-xs font-normal text-slate-500 font-sans">/day</span>
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {monthOverMonth.isPartialMonth
                ? `${formatCurrency(monthOverMonth.mtdCurrent, currency)} vs ${formatCurrency(monthOverMonth.mtdPrev, currency)}`
                : `Prev avg: ${formatCurrency(
                    monthOverMonth.prevTotal / Math.max(1, getDaysInMonth(monthOverMonth.prevYearMonth)),
                    currency
                  )}/day`}
            </div>
          </div>
        </div>

        {/* Category Comparison Chart & Top Movers */}
        {monthOverMonth.chartData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
            {/* Grouped Bar Chart: Top Categories (Previous vs Selected Month) */}
            <div className="lg:col-span-7 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Category Spend Comparison
                </span>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 dark:bg-slate-600 inline-block" />
                    <span>{monthOverMonth.prevLabel}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-medium">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                    <span>{monthOverMonth.currentLabel}</span>
                  </span>
                </div>
              </div>

              <div className="w-full h-60 select-none">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthOverMonth.chartData}
                    margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                    barGap={4}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="shortName"
                      stroke={theme === 'light' ? '#64748b' : '#94a3b8'}
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: theme === 'light' ? '#cbd5e1' : '#334155' }}
                    />
                    <YAxis
                      stroke={theme === 'light' ? '#64748b' : '#94a3b8'}
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: theme === 'light' ? '#cbd5e1' : '#334155' }}
                      tickFormatter={(val) => {
                        const sym = CURRENCY_SYMBOLS[currency] || '$';
                        return val >= 1000 ? `${sym}${(val / 1000).toFixed(1)}k` : `${sym}${val}`;
                      }}
                      width={52}
                    />
                    <RechartsTooltip
                      cursor={{ fill: theme === 'light' ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.08)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const row = payload[0]?.payload;
                          if (!row) return null;
                          return (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-xl text-xs font-mono space-y-1.5 min-w-[200px]">
                              <div className="font-sans font-bold text-slate-900 dark:text-white pb-1 border-b border-slate-100 dark:border-slate-800">
                                {row.category}
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-sans text-slate-500">{monthOverMonth.prevLabel}:</span>
                                <span className="tabular-nums text-slate-700 dark:text-slate-300">
                                  {formatCurrency(row.prevAmount, currency)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-sans text-slate-500">{monthOverMonth.currentLabel}:</span>
                                <span className="font-bold tabular-nums text-slate-950 dark:text-white">
                                  {formatCurrency(row.currentAmount, currency)}
                                </span>
                              </div>
                              <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                                <span className="font-sans text-slate-500">Change:</span>
                                <span
                                  className={`font-bold tabular-nums ${
                                    row.delta <= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {row.delta > 0 ? '+' : row.delta < 0 ? '-' : ''}
                                  {formatCurrency(Math.abs(row.delta), currency)}
                                  {row.pctChange !== null
                                    ? ` (${row.pctChange > 0 ? '+' : ''}${row.pctChange.toFixed(1)}%)`
                                    : ''}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="prevAmount"
                      name={monthOverMonth.prevLabel}
                      fill={theme === 'light' ? '#94a3b8' : '#475569'}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="currentAmount"
                      name={monthOverMonth.currentLabel}
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Category Movers Table */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Biggest Category Shifts
                </span>
                <span className="text-[11px] text-slate-500">
                  vs {monthOverMonth.prevLabel}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/60 dark:bg-slate-950/40 overflow-hidden">
                {monthOverMonth.categoryDrivers.slice(0, 5).map((item) => {
                  const isDown = item.delta < -0.01;
                  const isUp = item.delta > 0.01;
                  return (
                    <div
                      key={item.category}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs hover:bg-white dark:hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {item.category}
                        </div>
                        <div className="text-[10px] font-mono tabular-nums text-slate-500">
                          {formatCurrency(item.prevAmount, currency)} &rarr;{' '}
                          {formatCurrency(item.currentAmount, currency)}
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <div
                          className={`font-bold text-xs ${
                            isDown
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isUp
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {item.pctChange !== null
                            ? `${item.pctChange > 0 ? '+' : ''}${item.pctChange.toFixed(1)}%`
                            : item.currentAmount > 0
                            ? 'New'
                            : '0.0%'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {isUp ? '+' : isDown ? '-' : ''}
                          {formatCurrency(Math.abs(item.delta), currency)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            No expenses logged in {monthOverMonth.currentLabel} or {monthOverMonth.prevLabel} to compare yet.
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* CATEGORY SPENDING LIMITS & BUDGET PROGRESS                             */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs transition-colors space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Category Spending Limits &amp; Progress
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {formatMonthYear(selectedYearMonth)} category spend tracked against individual budget caps
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Filter */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCategoryLimitFilter('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  categoryLimitFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Active ({categoryLimitProgress.items.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryLimitFilter('capped')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  categoryLimitFilter === 'capped'
                    ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                With Limits ({categoryLimitProgress.cappedItems.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryLimitFilter('attention')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  categoryLimitFilter === 'attention'
                    ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Near / Over ({categoryLimitProgress.overLimitCount + categoryLimitProgress.nearLimitCount})
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenBudgetModal}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Edit Category Limits</span>
            </button>
          </div>
        </div>

        {/* 4-Column Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Capped Categories
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-slate-950 dark:text-white block">
              {categoryLimitProgress.cappedItems.length}
              <span className="text-xs font-normal text-slate-500 ml-1">/ {CATEGORIES.length}</span>
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {categoryLimitProgress.unbudgetedActiveCount} active without limit
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Capped Spend Utilization
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-slate-950 dark:text-white block">
              {categoryLimitProgress.cappedItems.length > 0
                ? `${categoryLimitProgress.overallCappedPct.toFixed(1)}%`
                : '—'}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 block">
              {formatCurrency(categoryLimitProgress.totalSpentInCapped, currency)} of{' '}
              {formatCurrency(categoryLimitProgress.totalAssignedLimits, currency)}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Within Limit (&lt;75%)
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 block">
              {categoryLimitProgress.onTrackCount}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Categories comfortably on track
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
              Needs Attention
            </span>
            <span
              className={`text-xl font-bold font-mono tabular-nums block ${
                categoryLimitProgress.overLimitCount > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : categoryLimitProgress.nearLimitCount > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-950 dark:text-white'
              }`}
            >
              {categoryLimitProgress.overLimitCount + categoryLimitProgress.nearLimitCount}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {categoryLimitProgress.overLimitCount} over limit &middot;{' '}
              {categoryLimitProgress.nearLimitCount} approaching
            </span>
          </div>
        </div>

        {/* Category Progress Cards */}
        {(() => {
          const filteredCategoryItems = categoryLimitProgress.items.filter((item) => {
            if (categoryLimitFilter === 'capped') return item.hasLimit;
            if (categoryLimitFilter === 'attention') {
              return item.status === 'over' || item.status === 'warning';
            }
            return true;
          });

          if (filteredCategoryItems.length === 0) {
            return (
              <div className="p-6 text-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                {categoryLimitFilter === 'attention' && categoryLimitProgress.cappedItems.length > 0 ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      All capped categories are under 75% of their limits
                    </p>
                    <p className="text-[11px] text-slate-500">
                      No categories are approaching or exceeding their assigned budget caps in{' '}
                      {formatMonthYear(selectedYearMonth)}.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {categoryLimitFilter === 'capped'
                        ? 'No category spending limits configured yet'
                        : `No category activity recorded for ${formatMonthYear(selectedYearMonth)}`}
                    </p>
                    <button
                      type="button"
                      onClick={onOpenBudgetModal}
                      className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors"
                    >
                      Configure Category Limits
                    </button>
                  </>
                )}
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredCategoryItems.map((item) => {
                const pct = item.percentage ?? 0;
                const barWidth = item.spent === 0 ? 0 : Math.min(100, Math.max(2, pct));
                const barColorClass =
                  item.status === 'over'
                    ? 'bg-rose-500'
                    : item.status === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';

                return (
                  <div
                    key={item.category}
                    className="p-4 bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {item.category}
                          </span>
                          <span className="text-[10px] font-mono tabular-nums text-slate-500 shrink-0">
                            &middot; {item.txCount} {item.txCount === 1 ? 'tx' : 'txs'}
                          </span>
                        </div>
                      </div>

                      {item.status === 'over' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Over Limit</span>
                        </span>
                      )}
                      {item.status === 'warning' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Approaching Limit</span>
                        </span>
                      )}
                      {item.status === 'on-track' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>On Track</span>
                        </span>
                      )}
                      {item.status === 'unbudgeted' && (
                        <button
                          type="button"
                          onClick={onOpenBudgetModal}
                          className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                        >
                          + Set Limit
                        </button>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between gap-2 text-xs font-mono tabular-nums">
                      <div>
                        <span className="font-bold text-slate-950 dark:text-white">
                          {formatCurrency(item.spent, currency)}
                        </span>
                        {item.hasLimit && item.limit !== null ? (
                          <span className="text-slate-500 dark:text-slate-400">
                            {' '}
                            / {formatCurrency(item.limit, currency)} limit
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 font-sans text-[11px]">
                            {' '}
                            spent &middot; no limit assigned
                          </span>
                        )}
                      </div>

                      {item.hasLimit && item.percentage !== null && (
                        <span
                          className={`font-bold ${
                            item.status === 'over'
                              ? 'text-rose-600 dark:text-rose-400'
                              : item.status === 'warning'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {item.percentage.toFixed(1)}%
                        </span>
                      )}
                    </div>

                    {item.hasLimit && item.limit !== null ? (
                      <div className="space-y-1">
                        <div
                          className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"
                          role="progressbar"
                          aria-label={`${item.category} spending progress`}
                          aria-valuenow={Math.round(pct)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                          <span className="text-slate-500 dark:text-slate-400 font-sans">
                            {item.status === 'over'
                              ? 'Exceeded monthly cap'
                              : item.status === 'warning'
                              ? 'High utilization'
                              : 'Budget headroom'}
                          </span>
                          <span
                            className={
                              item.status === 'over'
                                ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                : 'text-slate-600 dark:text-slate-300'
                            }
                          >
                            {item.remaining !== null && item.remaining >= 0
                              ? `${formatCurrency(item.remaining, currency)} remaining`
                              : `${formatCurrency(Math.abs(item.remaining || 0), currency)} over`}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-1.5 bg-slate-200/70 dark:bg-slate-800/70 rounded-full overflow-hidden" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* FINANCIAL FORECAST & END-OF-MONTH PROJECTION SECTION                   */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs transition-colors space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Financial Forecast & End-of-Month Projection
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Predictive run-rate projection modeled from historical spending velocity, weekday vs weekend patterns, and confidence intervals
            </p>
          </div>

          {/* Month Progression Meta */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-500 dark:text-slate-400">
              {formatMonthYear(selectedYearMonth)}:
            </span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">
              {forecast.daysRemaining > 0
                ? `Day ${forecast.daysElapsed} of ${forecast.daysInMonth} · ${forecast.daysRemaining} days left`
                : `Month Finalized · ${forecast.daysInMonth} days`}
            </span>
          </div>
        </div>

        {/* Executive Forecast Narrative Banner */}
        <div
          className={`p-4 rounded-xl border text-xs leading-relaxed flex items-start gap-3 transition-colors ${
            forecast.status === 'on-track'
              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
              : forecast.status === 'near-limit'
              ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200'
              : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="p-1 rounded-md bg-white dark:bg-slate-900 shrink-0 shadow-xs">
            <Zap
              className={`w-3.5 h-3.5 ${
                forecast.status === 'on-track'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : forecast.status === 'near-limit'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            />
          </div>
          <div className="flex-1">
            <span className="font-semibold mr-1.5 uppercase tracking-wide text-[11px]">
              {forecast.status === 'on-track'
                ? 'On Track:'
                : forecast.status === 'near-limit'
                ? 'Caution Near Ceiling:'
                : 'Pacing Warning:'}
            </span>
            <span>{forecast.insightMessage}</span>
          </div>
        </div>

        {/* 4-Stat Forecast KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Projected End-of-Month Spend */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Projected End-of-Month</span>
              <Activity className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
              {formatCurrency(scenarioForecastTotal, currency)}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono pt-0.5">
              <span
                className={`font-semibold flex items-center gap-0.5 ${
                  scenarioVariance <= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {scenarioVariance <= 0 ? (
                  <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {scenarioVariance <= 0 ? '-' : '+'}
                  {formatCurrency(Math.abs(scenarioVariance), currency)}
                </span>
              </span>
              <span className="text-slate-500 text-[11px]">
                ({Math.abs(scenarioVariancePct).toFixed(1)}%{' '}
                {scenarioVariance <= 0 ? 'cushion' : 'over'})
              </span>
            </div>
          </div>

          {/* Card 2: Current Spend to Date */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Current Spend to Date</span>
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
              {formatCurrency(forecast.currentSpend, currency)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              of {formatCurrency(forecast.budget, currency)} budget (
              {((forecast.currentSpend / Math.max(1, forecast.budget)) * 100).toFixed(1)}% used)
            </div>
          </div>

          {/* Card 3: Allowable Daily Target */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Daily Safe Run-Rate</span>
              <Target className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
              {formatCurrency(forecast.dailyAllowableToStayOnBudget, currency)}
              <span className="text-xs font-normal text-slate-500 font-sans">/day</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Hist. avg: {formatCurrency(forecast.historicalDailyAverage, currency)}/day
            </div>
          </div>

          {/* Card 4: Confidence Range Corridor */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Confidence Corridor</span>
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-950 dark:text-white truncate">
              {formatCurrency(forecast.confidenceBand.conservative, currency)} –{' '}
              {formatCurrency(forecast.confidenceBand.high, currency)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Conservative discipline vs surge risk
            </div>
          </div>
        </div>

        {/* Projection Controls & Scenarios */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2">
          {/* Scenario Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mr-1 hidden sm:inline">
              Model Scenario:
            </span>
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setForecastScenario('blended')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  forecastScenario === 'blended'
                    ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Blended Run-Rate
              </button>
              <button
                type="button"
                onClick={() => setForecastScenario('velocity7')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  forecastScenario === 'velocity7'
                    ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                7-Day Velocity Pace
              </button>
              <button
                type="button"
                onClick={() => setForecastScenario('conservative')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  forecastScenario === 'conservative'
                    ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Disciplined Saver (-12%)
              </button>
              <button
                type="button"
                onClick={() => setForecastScenario('high')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  forecastScenario === 'high'
                    ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Upper Surge Risk (+18%)
              </button>
            </div>
          </div>

          {/* Overlay Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConfidenceBands(!showConfidenceBands)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                showConfidenceBands
                  ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  showConfidenceBands ? 'bg-cyan-500' : 'bg-slate-400'
                }`}
              />
              <span>Confidence Corridor</span>
            </button>

            <button
              type="button"
              onClick={() => setShowIdealPace(!showIdealPace)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                showIdealPace
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  showIdealPace ? 'bg-slate-500' : 'bg-slate-400'
                }`}
              />
              <span>Ideal Linear Pace</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCategoryForecast(!showCategoryForecast)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                showCategoryForecast
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Category Projections</span>
              {showCategoryForecast ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Visual Forecast Chart (Recharts ComposedChart) */}
        <div className="relative pt-2">
          <div className="w-full h-80 sm:h-96 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={forecastChartData}
                margin={{ top: 16, right: 20, left: 0, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'}
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => `Day ${d}`}
                  stroke={theme === 'light' ? '#64748b' : '#94a3b8'}
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: theme === 'light' ? '#cbd5e1' : '#334155' }}
                  interval={4} // every 5th day label (Day 1, 6, 11, 16, 21, 26, 31)
                />
                <YAxis
                  stroke={theme === 'light' ? '#64748b' : '#94a3b8'}
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: theme === 'light' ? '#cbd5e1' : '#334155' }}
                  tickFormatter={(val) =>
                    val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val}`
                  }
                  width={60}
                />
                <ReferenceLine
                  y={forecast.budget}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Budget Ceiling: ${formatCurrency(forecast.budget, currency)}`,
                    fill: theme === 'light' ? '#e11d48' : '#fb7185',
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />

                {/* Ideal Linear Pace */}
                {showIdealPace && (
                  <Line
                    type="linear"
                    dataKey="idealPace"
                    name="Ideal Linear Pace"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="2 4"
                    dot={false}
                    activeDot={false}
                  />
                )}

                {/* Confidence Corridor Lines */}
                {showConfidenceBands && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="conservativeCumulative"
                      name="Conservative Bound (-12%)"
                      stroke="#06b6d4"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={false}
                      activeDot={{ r: 3, fill: '#06b6d4' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="highCumulative"
                      name="Upper Risk Bound (+18%)"
                      stroke="#f43f5e"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={false}
                      activeDot={{ r: 3, fill: '#f43f5e' }}
                    />
                  </>
                )}

                {/* 7-Day Velocity Pace Line (if scenario selected) */}
                {forecastScenario === 'velocity7' && (
                  <Line
                    type="monotone"
                    dataKey="velocity7Cumulative"
                    name="Recent 7-Day Velocity Pace"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#8b5cf6' }}
                  />
                )}

                {/* Projected Forecast (Dashed) */}
                <Line
                  type="monotone"
                  dataKey="projectedCumulative"
                  name="Forecasted Trajectory"
                  stroke={scenarioVariance > 0 ? '#f59e0b' : '#10b981'}
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: scenarioVariance > 0 ? '#f59e0b' : '#10b981',
                    stroke: '#ffffff',
                    strokeWidth: 2,
                  }}
                />

                {/* Actual Cumulative (Solid Emerald) */}
                <Line
                  type="monotone"
                  dataKey="actualCumulative"
                  name="Actual Spend"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{
                    r: 2.5,
                    fill: '#10b981',
                    stroke: theme === 'light' ? '#ffffff' : '#0f172a',
                    strokeWidth: 1.5,
                  }}
                  activeDot={{
                    r: 5,
                    fill: '#10b981',
                    stroke: '#ffffff',
                    strokeWidth: 2,
                  }}
                />

                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const point = payload[0]?.payload;
                      if (!point) return null;

                      const isFuture = !point.isElapsed;
                      const displayedVal =
                        point.actualCumulative !== null
                          ? point.actualCumulative
                          : forecastScenario === 'velocity7'
                          ? point.velocity7Cumulative
                          : forecastScenario === 'conservative'
                          ? point.conservativeCumulative
                          : forecastScenario === 'high'
                          ? point.highCumulative
                          : point.projectedCumulative;

                      const varianceVsCeiling =
                        displayedVal !== null ? displayedVal - forecast.budget : null;
                      const varianceVsIdeal =
                        displayedVal !== null ? displayedVal - point.idealPace : null;

                      return (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3.5 rounded-xl shadow-xl text-xs font-mono space-y-2.5 min-w-[250px]">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {point.dayLabel} ({formatDateLabel(point.dateStr)})
                            </span>
                            <span
                              className={`text-[10px] font-sans font-semibold uppercase tracking-wider ${
                                point.isElapsed
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {point.isBridge
                                ? 'Current Day'
                                : point.isElapsed
                                ? 'Recorded'
                                : 'Forecasted'}
                            </span>
                          </div>

                          {/* Primary Cumulative Reading */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600 dark:text-slate-400 font-sans font-medium text-[11px]">
                                {point.actualCumulative !== null
                                  ? 'Actual Cumulative Spend:'
                                  : 'Projected Cumulative Spend:'}
                              </span>
                              <span className="font-bold text-slate-950 dark:text-white text-sm tabular-nums">
                                {formatCurrency(displayedVal || 0, currency)}
                              </span>
                            </div>

                            {point.dailyActual !== null && (
                              <div className="flex items-center justify-between text-[11px] text-slate-500 font-sans">
                                <span>Day's Logged Spend:</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                                  {formatCurrency(point.dailyActual, currency)}
                                </span>
                              </div>
                            )}

                            {isFuture && (
                              <div className="flex items-center justify-between text-[11px] text-slate-500 font-sans">
                                <span>Scenario Model:</span>
                                <span className="capitalize text-slate-700 dark:text-slate-300 font-medium">
                                  {forecastScenario}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Variance Readout */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[11px]">
                            {varianceVsCeiling !== null && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-sans">Vs Budget Ceiling:</span>
                                <span
                                  className={`font-semibold tabular-nums ${
                                    varianceVsCeiling <= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {varianceVsCeiling <= 0 ? '-' : '+'}
                                  {formatCurrency(Math.abs(varianceVsCeiling), currency)}
                                  <span className="text-[10px] ml-1 font-sans font-normal">
                                    ({varianceVsCeiling <= 0 ? 'cushion' : 'over'})
                                  </span>
                                </span>
                              </div>
                            )}

                            {varianceVsIdeal !== null && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-sans">Vs Linear Pace:</span>
                                <span
                                  className={`font-semibold tabular-nums ${
                                    varianceVsIdeal <= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {varianceVsIdeal <= 0 ? '-' : '+'}
                                  {formatCurrency(Math.abs(varianceVsIdeal), currency)}
                                  <span className="text-[10px] ml-1 font-sans font-normal">
                                    ({varianceVsIdeal <= 0 ? 'ahead' : 'behind'})
                                  </span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <RechartsLegend
                  content={() => (
                    <div className="flex flex-wrap items-center justify-center gap-5 pt-3 text-xs">
                      {/* Legend: Actual Spend */}
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-1 bg-emerald-500 inline-block rounded-full" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Actual Spend
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          (Days 1–{forecast.daysElapsed})
                        </span>
                      </div>

                      {/* Legend: Projected Run-Rate */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3.5 h-1 inline-block rounded-full"
                          style={{
                            borderTop: `2px dashed ${scenarioVariance > 0 ? '#f59e0b' : '#10b981'}`,
                          }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Projected Run-Rate
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          (Target: {formatCurrency(scenarioForecastTotal, currency)})
                        </span>
                      </div>

                      {/* Legend: Ideal Linear Pace */}
                      {showIdealPace && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3.5 h-1 inline-block rounded-full"
                            style={{ borderTop: '2px dotted #94a3b8' }}
                          />
                          <span className="text-slate-600 dark:text-slate-400">
                            Ideal Linear Pace
                          </span>
                        </div>
                      )}

                      {/* Legend: Budget Limit */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3.5 h-1 inline-block rounded-full"
                          style={{ borderTop: '2px dashed #f43f5e' }}
                        />
                        <span className="text-rose-600 dark:text-rose-400 font-medium">
                          Budget Ceiling ({formatCurrency(forecast.budget, currency)})
                        </span>
                      </div>

                      {/* Legend: Confidence Bounds */}
                      {showConfidenceBands && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-3.5 h-1 inline-block rounded-full"
                            style={{ borderTop: '2px dashed #06b6d4' }}
                          />
                          <span className="text-cyan-600 dark:text-cyan-400 text-[11px]">
                            Confidence Bounds ({formatCurrency(forecast.confidenceBand.conservative, currency)} –{' '}
                            {formatCurrency(forecast.confidenceBand.high, currency)})
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Projections Breakdown Section (Collapsible / Toggleable) */}
        {showCategoryForecast && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Category End-of-Month Projections</span>
              </h4>
              <span className="text-xs text-slate-500 font-mono">
                {forecast.categoryProjections.filter((c) => c.isOverLimit).length} projected over
                limit
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {forecast.categoryProjections.map((catProj) => {
                const catColor = CATEGORY_COLORS[catProj.category] || {
                  bar: '#10b981',
                  bg: 'bg-slate-100',
                  text: 'text-slate-700',
                  border: 'border-slate-200',
                };
                const hasBudget = catProj.budgetLimit && catProj.budgetLimit > 0;
                const pctOfBudget = hasBudget
                  ? (catProj.projectedTotal / catProj.budgetLimit!) * 100
                  : null;

                return (
                  <div
                    key={catProj.category}
                    className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: catColor.bar }}
                        />
                        <span className="truncate">{catProj.category}</span>
                      </span>

                      {hasBudget && (
                        <span
                          className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                            catProj.isOverLimit
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                          }`}
                        >
                          {catProj.isOverLimit ? 'Over Limit' : 'Within Budget'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-slate-500">
                        Current:{' '}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {formatCurrency(catProj.currentSpent, currency)}
                        </strong>
                      </span>
                      <span className="text-slate-500">
                        Projected:{' '}
                        <strong className="text-slate-950 dark:text-white font-bold">
                          {formatCurrency(catProj.projectedTotal, currency)}
                        </strong>
                      </span>
                    </div>

                    {hasBudget && (
                      <div className="space-y-1 pt-1">
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              catProj.isOverLimit ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(2, pctOfBudget || 0))}%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>Limit: {formatCurrency(catProj.budgetLimit!, currency)}</span>
                          <span
                            className={
                              catProj.isOverLimit
                                ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                : ''
                            }
                          >
                            {pctOfBudget?.toFixed(0)}% limit
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 30-DAY MULTI-LINE GRAPH: LAST 30 DAYS VS PREVIOUS 30-DAY PERIOD        */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs transition-colors space-y-5">
        {/* Header & Metric Mode Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                <LineChartIcon className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                30-Day Expense Trajectory Comparison
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Multi-line comparison of daily spend over the last 30 days vs the preceding 30-day window
            </p>
          </div>

          {/* Metric View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setTrendMetric('daily')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                trendMetric === 'daily'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Daily Total
            </button>
            <button
              type="button"
              onClick={() => setTrendMetric('rolling')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                trendMetric === 'rolling'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              7-Day Rolling Avg
            </button>
            <button
              type="button"
              onClick={() => setTrendMetric('cumulative')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                trendMetric === 'cumulative'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cumulative Pace
            </button>
          </div>
        </div>

        {/* 4-Stat Comparison KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Last 30 Days */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Last 30 Days</span>
              </span>
              <span className="font-mono text-[11px] truncate max-w-[110px]">
                {comparisonData.startDateCurrent.slice(5)} → {comparisonData.endDateCurrent.slice(5)}
              </span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-950 dark:text-white mt-1.5">
              {formatCurrency(comparisonData.currentTotal, currency)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              Avg: {formatCurrency(comparisonData.currentAvg, currency)}/day
            </div>
          </div>

          {/* Card 2: Previous 30 Days */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                <span>Previous 30 Days</span>
              </span>
              <span className="font-mono text-[11px] truncate max-w-[110px]">
                {comparisonData.startDatePrev.slice(5)} → {comparisonData.endDatePrev.slice(5)}
              </span>
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-950 dark:text-white mt-1.5">
              {formatCurrency(comparisonData.previousTotal, currency)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              Avg: {formatCurrency(comparisonData.previousAvg, currency)}/day
            </div>
          </div>

          {/* Card 3: Period Variance */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Period Variance</span>
              <Activity className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div
              className={`text-xl font-bold font-mono tabular-nums mt-1.5 flex items-center gap-1 ${
                comparisonData.diff <= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {comparisonData.diff <= 0 ? (
                <TrendingDown className="w-4 h-4 shrink-0" />
              ) : (
                <TrendingUp className="w-4 h-4 shrink-0" />
              )}
              <span>
                {comparisonData.diff > 0 ? '+' : ''}
                {formatCurrency(comparisonData.diff, currency)}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              {comparisonData.pctDiff >= 0 ? '+' : ''}
              {comparisonData.pctDiff.toFixed(1)}% vs prior 30-day window
            </div>
          </div>

          {/* Card 4: Peak Daily Spend */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Peak Spend Comparison</span>
              <Target className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-slate-950 dark:text-white mt-1.5">
              {formatCurrency(comparisonData.peakCurrentPoint?.currentSpend || 0, currency)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              Prior peak:{' '}
              {formatCurrency(comparisonData.peakPreviousPoint?.previousSpend || 0, currency)}
            </div>
          </div>
        </div>

        {/* Recharts Multi-Line Graph */}
        <div className="relative pt-2">
          <div className="w-full h-72 sm:h-80 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={comparisonData.points}
                margin={{ top: 12, right: 16, left: 0, bottom: 6 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'}
                  vertical={false}
                />
                <XAxis
                  dataKey="dayLabel"
                  stroke={theme === 'light' ? '#64748b' : '#94a3b8'}
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: theme === 'light' ? '#cbd5e1' : '#334155' }}
                  interval={4} // every 5th day label (Day 1, 6, 11, 16, 21, 26, 30)
                />
                <YAxis
                  stroke={theme === 'light' ? '#64748b' : '#94a3b8'}
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: theme === 'light' ? '#cbd5e1' : '#334155' }}
                  tickFormatter={(val) =>
                    val >= 1000
                      ? `$${(val / 1000).toFixed(1)}k`
                      : `$${val}`
                  }
                  width={60}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const point = payload[0]?.payload;
                      if (!point) return null;

                      const cVal =
                        trendMetric === 'daily'
                          ? point.currentSpend
                          : trendMetric === 'cumulative'
                          ? point.currentCumulative
                          : point.currentRolling;

                      const pVal =
                        trendMetric === 'daily'
                          ? point.previousSpend
                          : trendMetric === 'cumulative'
                          ? point.previousCumulative
                          : point.previousRolling;

                      const delta = cVal - pVal;

                      return (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3.5 rounded-xl shadow-xl text-xs font-mono space-y-2.5 min-w-[240px]">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {point.dayLabel} (Timeline Point {point.dayIndex}/30)
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-sans font-medium">
                              {trendMetric === 'daily'
                                ? 'Daily'
                                : trendMetric === 'cumulative'
                                ? 'Pace'
                                : '7D Avg'}
                            </span>
                          </div>

                          {/* Last 30 Days Point */}
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="text-slate-700 dark:text-slate-300 font-sans text-[11px] font-medium">
                                  Last 30 Days:
                                </span>
                              </div>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {formatCurrency(cVal, currency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-sans pl-4">
                              <span>{point.currentDate}</span>
                              {point.currentCount > 0 && (
                                <span>{point.currentCount} {point.currentCount === 1 ? 'tx' : 'txs'}</span>
                              )}
                            </div>
                          </div>

                          {/* Previous 30 Days Point */}
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                                <span className="text-slate-700 dark:text-slate-300 font-sans text-[11px] font-medium">
                                  Previous 30 Days:
                                </span>
                              </div>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                {formatCurrency(pVal, currency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-sans pl-4">
                              <span>{point.previousDate}</span>
                              {point.previousCount > 0 && (
                                <span>{point.previousCount} {point.previousCount === 1 ? 'tx' : 'txs'}</span>
                              )}
                            </div>
                          </div>

                          {/* Variance */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-sans">Comparison Delta:</span>
                            <span
                              className={`font-semibold tabular-nums ${
                                delta > 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : delta < 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {delta > 0 ? '+' : ''}
                              {formatCurrency(delta, currency)}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <RechartsLegend
                  content={() => (
                    <div className="flex flex-wrap items-center justify-center gap-6 pt-3 text-xs">
                      {/* Legend 1: Last 30 Days */}
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-0.5 bg-emerald-500 inline-block rounded-full" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Last 30 Days
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          ({formatDateLabel(comparisonData.startDateCurrent)} –{' '}
                          {formatDateLabel(comparisonData.endDateCurrent)})
                        </span>
                      </div>

                      {/* Legend 2: Previous 30 Days */}
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-0.5 bg-indigo-500 inline-block rounded-full"
                          style={{ borderTop: '2px dashed #6366f1' }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Previous 30 Days
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          ({formatDateLabel(comparisonData.startDatePrev)} –{' '}
                          {formatDateLabel(comparisonData.endDatePrev)})
                        </span>
                      </div>
                    </div>
                  )}
                />

                {/* Line 1: Last 30 Days (Solid Emerald) */}
                <Line
                  type="monotone"
                  dataKey={
                    trendMetric === 'daily'
                      ? 'currentSpend'
                      : trendMetric === 'cumulative'
                      ? 'currentCumulative'
                      : 'currentRolling'
                  }
                  name="Last 30 Days"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{
                    r: 3,
                    fill: '#10b981',
                    stroke: theme === 'light' ? '#ffffff' : '#0f172a',
                    strokeWidth: 1.5,
                  }}
                  activeDot={{
                    r: 6,
                    fill: '#10b981',
                    stroke: '#ffffff',
                    strokeWidth: 2,
                  }}
                />

                {/* Line 2: Previous 30 Days (Dashed Indigo) */}
                <Line
                  type="monotone"
                  dataKey={
                    trendMetric === 'daily'
                      ? 'previousSpend'
                      : trendMetric === 'cumulative'
                      ? 'previousCumulative'
                      : 'previousRolling'
                  }
                  name="Previous 30 Days"
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{
                    r: 2.5,
                    fill: '#6366f1',
                    stroke: theme === 'light' ? '#ffffff' : '#0f172a',
                    strokeWidth: 1,
                  }}
                  activeDot={{
                    r: 5,
                    fill: '#6366f1',
                    stroke: '#ffffff',
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* DONUT CHART: EXPENSES CATEGORIZED BY ASSIGNED LABELS / TAGS             */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs transition-colors space-y-5">
        {/* Card Header & Scope Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                <Tag className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Budget Allocation by Assigned Labels
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Visualize total expenses grouped by custom labels (e.g. #Work, #Personal, #Project X)
            </p>
          </div>

          {/* Scope Toggle: This Month vs All Time */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setLabelScope('month')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                labelScope === 'month'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {formatMonthYear(selectedYearMonth)}
            </button>
            <button
              type="button"
              onClick={() => setLabelScope('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                labelScope === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All-Time
            </button>
          </div>
        </div>

        {labelBreakdown.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left Column: Recharts Donut Chart */}
            <div className="lg:col-span-5 relative flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-xl">
              <div className="w-full h-64 sm:h-72 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg shadow-xl text-xs font-mono">
                              <div className="text-slate-950 dark:text-white font-bold flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full inline-block"
                                  style={{ backgroundColor: data.color }}
                                />
                                <span>#{data.name}</span>
                              </div>
                              <div className="text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                                {formatCurrency(data.value, currency)} ({data.percentage.toFixed(1)}%)
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                                {data.count} {data.count === 1 ? 'transaction' : 'transactions'}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Pie
                      data={labelBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={98}
                      paddingAngle={2.5}
                      dataKey="value"
                      onMouseEnter={(_, index) =>
                        setHoveredLabel(labelBreakdown[index]?.name || null)
                      }
                      onMouseLeave={() => setHoveredLabel(null)}
                    >
                      {labelBreakdown.map((entry, index) => (
                        <Cell
                          key={`label-cell-${index}`}
                          fill={entry.color}
                          stroke={
                            hoveredLabel === entry.name
                              ? '#10b981'
                              : theme === 'light'
                              ? '#ffffff'
                              : '#0f172a'
                          }
                          strokeWidth={hoveredLabel === entry.name ? 2.5 : 1.5}
                          className="transition-all cursor-pointer"
                        />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>

                {/* Centered Readout inside Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[130px]">
                    {activeLabelData ? `#${activeLabelData.name}` : 'Total Spend'}
                  </span>
                  <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-950 dark:text-white truncate max-w-[140px]">
                    {activeLabelData
                      ? formatCurrency(activeLabelData.value, currency)
                      : formatCurrency(totalScopeSpent, currency)}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                    {activeLabelData
                      ? `${activeLabelData.percentage.toFixed(1)}% of total`
                      : `${labelBreakdown.length} active labels`}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono text-center pt-1">
                Hover or tap donut segments to inspect label allocations
              </div>
            </div>

            {/* Right Column: Ranked Labels List & Visual Progress Bars */}
            <div className="lg:col-span-7 space-y-3.5">
              {/* Highlight summary banner */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <PieIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{topLabelSummary}</div>
              </div>

              {/* Scrollable Label Cards */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {labelBreakdown.map((item) => {
                  const isHovered = hoveredLabel === item.name;

                  return (
                    <div
                      key={item.name}
                      onMouseEnter={() => setHoveredLabel(item.name)}
                      onMouseLeave={() => setHoveredLabel(null)}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                        isHovered
                          ? 'bg-slate-100 dark:bg-slate-800/80 border-emerald-500/50 shadow-xs'
                          : 'bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span
                            className={`font-semibold truncate ${
                              isHovered
                                ? 'text-slate-950 dark:text-white'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            #{item.name}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            · {item.count} {item.count === 1 ? 'transaction' : 'transactions'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 font-mono tabular-nums text-xs shrink-0">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatCurrency(item.value, currency)}
                          </span>
                          <span className="text-slate-500 text-[11px] w-12 text-right font-medium">
                            {item.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(1.5, item.percentage))}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800">
            <Tag className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No labeled expenses found
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Assign labels like #Work, #Personal, or #Project X to transactions in the Daily Tracker or Ledger to see where your budget is going.
            </p>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchInsights}
            className="underline hover:text-rose-900 dark:hover:text-rose-200 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !insights && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 animate-pulse h-36"
              ></div>
            ))}
          </div>
        </div>
      )}

      {/* Populated Insights Content */}
      {insights && (
        <>
          {/* Diagnostic Health Banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-7 relative overflow-hidden shadow-xs transition-colors">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2.5 text-xs">
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                      insights.overallHealth.status === 'Healthy'
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                        : insights.overallHealth.status === 'Moderate'
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                        : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                    }`}
                  >
                    {insights.overallHealth.status} Status
                  </span>
                  {lastAnalyzedAt && (
                    <span className="text-slate-500 text-[11px]">
                      Analyzed at {lastAnalyzedAt}
                    </span>
                  )}
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {insights.overallHealth.headline}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {insights.overallHealth.summary}
                </p>
              </div>

              {/* Health Score Dial */}
              <div className="flex items-center gap-5 p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl shrink-0">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {insights.overallHealth.score}
                    <span className="text-sm font-normal text-slate-500">/100</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                    Financial Health Score
                  </div>
                </div>

                <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full"
                    style={{ width: `${insights.overallHealth.score}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Key Findings Grid */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 tracking-wider uppercase">
              Observed Spending Patterns & Diagnostics
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.keyFindings.map((finding, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xs transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {finding.title}
                      </span>
                      {finding.impact === 'positive' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                      )}
                      {finding.impact === 'warning' && (
                        <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      )}
                      {finding.impact === 'neutral' && (
                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-normal">
                      {finding.observation}
                    </p>
                  </div>

                  {finding.metric && (
                    <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                      {finding.metric}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actionable Tips Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                Actionable Savings Strategies
              </h4>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Tailored for {formatMonthYear(selectedYearMonth)}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {insights.actionableTips.map((tip, idx) => {
                const isHigh = tip.priority === 'high';
                const isMed = tip.priority === 'medium';

                return (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-xs transition-colors"
                  >
                    <div>
                      {/* Priority and Savings Strip */}
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          {tip.category}
                        </span>
                        <span
                          className={`font-semibold text-[11px] ${
                            isHigh
                              ? 'text-rose-600 dark:text-rose-400'
                              : isMed
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-sky-600 dark:text-sky-400'
                          }`}
                        >
                          {tip.priority.toUpperCase()} PRIORITY
                        </span>
                      </div>

                      <h5 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                        {tip.title}
                      </h5>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {tip.recommendation}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Potential Savings:
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {tip.potentialSavings}
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-tight">
                          <strong className="text-slate-900 dark:text-slate-200">Action:</strong>{' '}
                          {tip.actionStep}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Two Column: Spending Patterns & Suggested Budget Adjustments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spending Patterns Box */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-3 shadow-xs transition-colors">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span>Behavioral Cadence & Timing</span>
              </h4>

              <div className="space-y-3 text-xs">
                {insights.spendingPatterns.weekdayVsWeekend && (
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold w-28 shrink-0">
                      Day Timing:
                    </span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {insights.spendingPatterns.weekdayVsWeekend}
                    </span>
                  </div>
                )}

                {insights.spendingPatterns.peakSpendingDays && (
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold w-28 shrink-0">
                      Peak Days:
                    </span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {insights.spendingPatterns.peakSpendingDays}
                    </span>
                  </div>
                )}

                {insights.spendingPatterns.recurringCommitmentsNote && (
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold w-28 shrink-0">
                      Fixed Base:
                    </span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {insights.spendingPatterns.recurringCommitmentsNote}
                    </span>
                  </div>
                )}

                {insights.spendingPatterns.topCategoryTrend && (
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold w-28 shrink-0">
                      Category Trend:
                    </span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {insights.spendingPatterns.topCategoryTrend}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Budget Adjustment Suggestions */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-3 shadow-xs transition-colors">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Budget Allocation Recommendations</span>
                </h4>
                <button
                  type="button"
                  onClick={onOpenBudgetModal}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
                >
                  Adjust in Settings
                </button>
              </div>

              <div className="space-y-3">
                {insights.budgetAdjustmentSuggestions.map((adj, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-slate-900 dark:text-white">{adj.category}</span>
                      <div className="flex items-center gap-2 font-mono tabular-nums">
                        <span className="text-slate-500 dark:text-slate-400">
                          {adj.currentSpending}
                        </span>
                        <ArrowRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {adj.suggestedBudget}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                      {adj.rationale}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
