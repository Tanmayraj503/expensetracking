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
  Target,
  LineChart as LineChartIcon,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  CalendarRange,
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend as RechartsLegend,
} from 'recharts';
import { Expense, BudgetSettings, MonthSummary } from '../types';
import { formatCurrency, formatMonthYear, formatDateLabel } from '../utils/formatters';

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
