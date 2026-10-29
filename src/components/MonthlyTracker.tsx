import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  PieChart as LucidePieChart,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Expense, BudgetSettings, MonthSummary } from '../types';
import {
  formatCurrency,
  formatMonthYear,
  getPreviousYearMonth,
  getNextYearMonth,
  calculateMonthSummary,
  calculateCategoryBreakdown,
  getDaysInMonth,
} from '../utils/formatters';
import { CATEGORY_COLORS } from '../data/sampleExpenses';

interface MonthlyTrackerProps {
  expenses: Expense[];
  selectedYearMonth: string;
  onSelectYearMonth: (ym: string) => void;
  budgetSettings: BudgetSettings;
  onOpenBudgetModal: () => void;
  theme?: 'dark' | 'light';
}

export const MonthlyTracker: React.FC<MonthlyTrackerProps> = ({
  expenses,
  selectedYearMonth,
  onSelectYearMonth,
  budgetSettings,
  onOpenBudgetModal,
  theme = 'dark',
}) => {
  const [hoveredDayPoint, setHoveredDayPoint] = useState<{
    day: number;
    actual: number | null;
    planned: number;
    prev: number | null;
  } | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const currency = budgetSettings.currency;
  const monthSummary = calculateMonthSummary(expenses, selectedYearMonth, budgetSettings);

  const prevYearMonth = getPreviousYearMonth(selectedYearMonth);
  const nextYearMonth = getNextYearMonth(selectedYearMonth);

  const monthExpenses = expenses.filter((e) => e.date.startsWith(selectedYearMonth));
  const categoryBreakdown = calculateCategoryBreakdown(
    monthExpenses,
    budgetSettings.categoryBudgets
  );

  const doughnutData = categoryBreakdown.map((item) => ({
    name: item.category,
    value: item.amount,
    color: CATEGORY_COLORS[item.category]?.bar || '#64748b',
    percentage: item.percentage,
    count: item.count,
  }));

  const activeCategoryData = hoveredCategory
    ? doughnutData.find((d) => d.name === hoveredCategory)
    : null;

  // Top Merchants in this month
  const merchantMap: Record<string, { total: number; count: number; category: string }> = {};
  for (const exp of monthExpenses) {
    if (!merchantMap[exp.merchant]) {
      merchantMap[exp.merchant] = { total: 0, count: 0, category: exp.category };
    }
    merchantMap[exp.merchant].total += exp.amount;
    merchantMap[exp.merchant].count += 1;
  }
  const topMerchants = Object.entries(merchantMap)
    .map(([merchant, data]) => ({ merchant, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Payment method breakdown
  const paymentMethodMap: Record<string, number> = {};
  for (const exp of monthExpenses) {
    paymentMethodMap[exp.paymentMethod] = (paymentMethodMap[exp.paymentMethod] || 0) + exp.amount;
  }
  const paymentMethodsList = Object.entries(paymentMethodMap)
    .map(([method, amount]) => ({
      method,
      amount,
      percentage: monthSummary.totalSpent > 0 ? (amount / monthSummary.totalSpent) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Build Cumulative Pacing Curves
  const daysInMonth = monthSummary.daysInMonth;
  const budget = monthSummary.budget;
  const dailyPlannedRate = budget / daysInMonth;

  // Actual cumulative spend by day
  const dailySpendMap: Record<number, number> = {};
  for (const exp of monthExpenses) {
    const day = parseInt(exp.date.split('-')[2], 10);
    dailySpendMap[day] = (dailySpendMap[day] || 0) + exp.amount;
  }

  // Previous month cumulative spend by day
  const prevMonthExpenses = expenses.filter((e) => e.date.startsWith(prevYearMonth));
  const prevDailySpendMap: Record<number, number> = {};
  for (const exp of prevMonthExpenses) {
    const day = parseInt(exp.date.split('-')[2], 10);
    prevDailySpendMap[day] = (prevDailySpendMap[day] || 0) + exp.amount;
  }

  const pacingData: Array<{
    day: number;
    planned: number;
    actual: number | null;
    prev: number | null;
  }> = [];

  let cumActual = 0;
  let cumPrev = 0;
  const maxElapsedDay = monthSummary.daysElapsed;

  for (let d = 1; d <= daysInMonth; d++) {
    const planned = dailyPlannedRate * d;
    cumPrev += prevDailySpendMap[d] || 0;
    const prevVal = prevMonthExpenses.length > 0 ? cumPrev : null;

    let actualVal: number | null = null;
    if (d <= maxElapsedDay) {
      cumActual += dailySpendMap[d] || 0;
      actualVal = cumActual;
    }

    pacingData.push({
      day: d,
      planned,
      actual: actualVal,
      prev: prevVal,
    });
  }

  // SVG Chart Dimensions
  const svgWidth = 700;
  const svgHeight = 220;
  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 35;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const maxChartValue = Math.max(
    budget * 1.15,
    monthSummary.projectedTotal * 1.1,
    cumActual * 1.1,
    cumPrev * 1.1,
    100
  );

  const getX = (day: number) => paddingLeft + ((day - 1) / (daysInMonth - 1)) * chartWidth;
  const getY = (val: number) => paddingTop + chartHeight - (val / maxChartValue) * chartHeight;

  // Build planned polyline points
  const plannedPoints = pacingData
    .map((p) => `${getX(p.day)},${getY(p.planned)}`)
    .join(' ');

  // Build prev month polyline points
  const prevPoints = pacingData
    .filter((p) => p.prev !== null)
    .map((p) => `${getX(p.day)},${getY(p.prev!)}`)
    .join(' ');

  // Build actual polyline points
  const actualPointsData = pacingData.filter((p) => p.actual !== null);
  const actualPoints = actualPointsData
    .map((p) => `${getX(p.day)},${getY(p.actual!)}`)
    .join(' ');

  // Area under actual curve
  let actualAreaPath = '';
  if (actualPointsData.length > 0) {
    const first = actualPointsData[0];
    const last = actualPointsData[actualPointsData.length - 1];
    actualAreaPath = `M ${getX(first.day)},${getY(first.actual!)} ` +
      actualPointsData.map((p) => `L ${getX(p.day)},${getY(p.actual!)}`).join(' ') +
      ` L ${getX(last.day)},${paddingTop + chartHeight} L ${getX(first.day)},${paddingTop + chartHeight} Z`;
  }

  return (
    <div className="space-y-6">
      {/* Month Navigation Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => onSelectYearMonth(prevYearMonth)}
              className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors flex items-center gap-1"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{formatMonthYear(prevYearMonth)}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectYearMonth(nextYearMonth)}
              className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors flex items-center gap-1"
              title="Next Month"
            >
              <span className="hidden sm:inline">{formatMonthYear(nextYearMonth)}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {formatMonthYear(selectedYearMonth)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {monthExpenses.length} transactions recorded across {daysInMonth} days
            </p>
          </div>
        </div>

        {/* Quick Month Shortcuts */}
        <div className="flex items-center gap-2">
          {selectedYearMonth !== '2026-10' && (
            <button
              type="button"
              onClick={() => onSelectYearMonth('2026-10')}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg transition-colors whitespace-nowrap"
            >
              Jump to Current Month (Oct 2026)
            </button>
          )}

          <button
            type="button"
            onClick={onOpenBudgetModal}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            Adjust Budget Cap
          </button>
        </div>
      </div>

      {/* 4 Monthly KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Spend vs Budget */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Total Spent</span>
            <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
              {monthSummary.percentUsed.toFixed(1)}% of budget
            </span>
          </div>

          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
              {formatCurrency(monthSummary.totalSpent, currency)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span>Budget:</span>
              <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">
                {formatCurrency(monthSummary.budget, currency)}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  monthSummary.percentUsed > 100
                    ? 'bg-rose-500'
                    : monthSummary.percentUsed > 85
                    ? 'bg-amber-400'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, monthSummary.percentUsed)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1.5 font-mono tabular-nums">
              <span>{formatCurrency(0, currency)}</span>
              <span>{formatCurrency(monthSummary.budget, currency)}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Budget Remaining / Cushion */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Budget Remaining</span>
            {monthSummary.remaining >= 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            )}
          </div>

          <div className="my-3">
            <div
              className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
                monthSummary.remaining >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatCurrency(monthSummary.remaining, currency)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {monthSummary.remaining >= 0
                ? 'Under limit cushion available'
                : 'Deficit exceeding monthly cap'}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {monthSummary.daysElapsed < daysInMonth ? (
              <span>
                {(monthSummary.remaining / Math.max(1, daysInMonth - monthSummary.daysElapsed)).toFixed(2)}/day
                allowable for remaining {daysInMonth - monthSummary.daysElapsed} days
              </span>
            ) : (
              <span>Month fully concluded</span>
            )}
          </div>
        </div>

        {/* KPI 3: Projected EOM Spend */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Projected Month Total</span>
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">Run-Rate</span>
          </div>

          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
              {formatCurrency(monthSummary.projectedTotal, currency)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              At current {formatCurrency(monthSummary.dailyAverage, currency)}/day pace
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs font-mono tabular-nums">
            {monthSummary.projectedTotal <= monthSummary.budget ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Under budget by{' '}
                {formatCurrency(monthSummary.budget - monthSummary.projectedTotal, currency)}
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Projected to exceed by{' '}
                {formatCurrency(monthSummary.projectedTotal - monthSummary.budget, currency)}
              </span>
            )}
          </div>
        </div>

        {/* KPI 4: Month-over-Month Delta */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">vs Previous Month</span>
            <span className="font-mono tabular-nums text-slate-500">
              {formatMonthYear(prevYearMonth).slice(0, 3)}
            </span>
          </div>

          <div className="my-3">
            {monthSummary.changePercentVsPrevMonth !== null ? (
              <>
                <div
                  className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums flex items-center gap-1 ${
                    monthSummary.changePercentVsPrevMonth <= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {monthSummary.changePercentVsPrevMonth <= 0 ? (
                    <TrendingDown className="w-6 h-6 stroke-[2.5]" />
                  ) : (
                    <TrendingUp className="w-6 h-6 stroke-[2.5]" />
                  )}
                  <span>
                    {Math.abs(monthSummary.changePercentVsPrevMonth).toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {monthSummary.changePercentVsPrevMonth <= 0
                    ? 'Lower spending than last month'
                    : 'Higher spending than last month'}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-400">
                  —
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  No prior month baseline
                </div>
              </>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Prev month total: {formatCurrency(monthSummary.previousMonthSpend, currency)}
          </div>
        </div>
      </div>

      {/* Cumulative Budget Pacing Curve Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Cumulative Spend Pacing vs Budget Line
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compare your actual trajectory against the planned linear budget pace
            </p>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <span className="w-4 h-0.5 bg-emerald-500"></span>
              <span>Actual Spend</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="w-4 h-0.5 border-t border-dashed border-slate-400 dark:border-slate-500"></span>
              <span>Planned Pace</span>
            </div>
            {monthSummary.previousMonthSpend > 0 && (
              <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <span className="w-4 h-0.5 border-t border-dotted border-indigo-500"></span>
                <span>Last Month</span>
              </div>
            )}
          </div>
        </div>

        {/* Hover Readout Box */}
        <div className="h-6 mt-2 flex items-center text-xs font-mono tabular-nums">
          {hoveredDayPoint ? (
            <div className="text-slate-700 dark:text-slate-300 flex items-center gap-3">
              <span className="text-slate-900 dark:text-white font-semibold">Day {hoveredDayPoint.day}:</span>
              {hoveredDayPoint.actual !== null && (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  Actual: {formatCurrency(hoveredDayPoint.actual, currency)}
                </span>
              )}
              <span className="text-slate-500 dark:text-slate-400">
                Planned: {formatCurrency(hoveredDayPoint.planned, currency)}
              </span>
              {hoveredDayPoint.prev !== null && (
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                  Last Mo: {formatCurrency(hoveredDayPoint.prev, currency)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-500 text-xs">
              Hover along curve to compare cumulative pacing day by day
            </span>
          )}
        </div>

        {/* SVG Curve Display */}
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full min-w-[600px] h-auto select-none overflow-visible"
          >
            {/* Grid Lines & Y-Axis Labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const val = maxChartValue * pct;
              const y = getY(val);
              return (
                <g key={`grid-${pct}`}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke={theme === 'light' ? '#e2e8f0' : '#1e293b'}
                    strokeWidth="1"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    fill={theme === 'light' ? '#64748b' : '#64748b'}
                    fontSize="10"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {formatCurrency(val, currency)}
                  </text>
                </g>
              );
            })}

            {/* Area Under Actual Spend */}
            {actualAreaPath && (
              <path
                d={actualAreaPath}
                fill="url(#actualGradient)"
                opacity={theme === 'light' ? '0.2' : '0.3'}
              />
            )}

            <defs>
              <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Planned Straight Pace Line (Dashed) */}
            <polyline
              points={plannedPoints}
              fill="none"
              stroke={theme === 'light' ? '#94a3b8' : '#64748b'}
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* Previous Month Curve (Dotted Indigo) */}
            {prevPoints && (
              <polyline
                points={prevPoints}
                fill="none"
                stroke="#6366f1"
                strokeWidth="1.5"
                strokeDasharray="2 3"
                opacity="0.8"
              />
            )}

            {/* Actual Spend Polyline (Bold Emerald) */}
            {actualPoints && (
              <polyline
                points={actualPoints}
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Interactive Points on actual curve */}
            {pacingData.map((p) => {
              const isHovered = hoveredDayPoint?.day === p.day;
              return (
                <g key={`point-${p.day}`}>
                  <rect
                    x={getX(p.day) - (chartWidth / daysInMonth) / 2}
                    y={paddingTop}
                    width={chartWidth / daysInMonth}
                    height={chartHeight}
                    fill="transparent"
                    onMouseEnter={() => setHoveredDayPoint(p)}
                    onMouseLeave={() => setHoveredDayPoint(null)}
                    className="cursor-pointer"
                  />

                  {p.actual !== null && (
                    <circle
                      cx={getX(p.day)}
                      cy={getY(p.actual)}
                      r={isHovered ? 5 : 2.5}
                      fill={isHovered ? '#10b981' : '#10b981'}
                      stroke={theme === 'light' ? '#ffffff' : '#0f172a'}
                      strokeWidth="2"
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}

            {/* X-Axis Tick Labels */}
            {[1, 5, 10, 15, 20, 25, daysInMonth].map((d) => (
              <text
                key={`lbl-x-${d}`}
                x={getX(d)}
                y={paddingTop + chartHeight + 20}
                fill="#64748b"
                fontSize="10"
                textAnchor="middle"
                fontFamily="monospace"
              >
                Day {d}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* Two Column Section: Category Distribution & Top Merchants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Spending Breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Category Distribution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Spending allocation and category budget caps
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenBudgetModal}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold"
            >
              Set Category Caps
            </button>
          </div>

          {categoryBreakdown.length > 0 ? (
            <div className="mt-4 space-y-6">
              {/* Recharts Doughnut Chart Visualizer */}
              <div className="relative flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-xl">
                <div className="w-full h-56 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg shadow-xl text-xs font-mono">
                                <div className="text-slate-950 dark:text-white font-bold">{data.name}</div>
                                <div className="text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
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
                        data={doughnutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={88}
                        paddingAngle={3}
                        dataKey="value"
                        onMouseEnter={(_, index) =>
                          setHoveredCategory(doughnutData[index]?.name || null)
                        }
                        onMouseLeave={() => setHoveredCategory(null)}
                      >
                        {doughnutData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke={hoveredCategory === entry.name ? '#10b981' : theme === 'light' ? '#ffffff' : '#0f172a'}
                            strokeWidth={hoveredCategory === entry.name ? 2 : 1}
                            className="transition-all cursor-pointer"
                          />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>

                  {/* Centered Readout inside Doughnut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[120px]">
                      {activeCategoryData ? activeCategoryData.name : 'Total Month'}
                    </span>
                    <span className="text-base font-bold font-mono tabular-nums text-slate-950 dark:text-white truncate max-w-[130px]">
                      {activeCategoryData
                        ? formatCurrency(activeCategoryData.value, currency)
                        : formatCurrency(monthSummary.totalSpent, currency)}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                      {activeCategoryData
                        ? `${activeCategoryData.percentage.toFixed(1)}% of spend`
                        : `${categoryBreakdown.length} categories`}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-mono text-center pb-1">
                  Hover or tap segments to inspect category proportion
                </div>
              </div>

              {/* Category Breakdown Progress Bars & Spending Caps */}
              <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                {categoryBreakdown.map((item) => {
                  const colors = CATEGORY_COLORS[item.category];
                  const hasBudget = item.budgetLimit && item.budgetLimit > 0;
                  const percentOfCatBudget = hasBudget
                    ? (item.amount / item.budgetLimit!) * 100
                    : null;
                  const isHovered = hoveredCategory === item.category;

                  return (
                    <div
                      key={item.category}
                      onMouseEnter={() => setHoveredCategory(item.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className={`space-y-1.5 p-1 rounded-lg transition-colors ${
                        isHovered ? 'bg-slate-100 dark:bg-slate-800/40' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: colors?.bar || '#94a3b8' }}
                          />
                          <span className={`font-semibold ${isHovered ? 'text-slate-950 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                            {item.category}
                          </span>
                          <span className="text-slate-500 font-mono tabular-nums">
                            ({item.count})
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            {item.percentage.toFixed(1)}%
                          </span>
                          <span className="font-bold font-mono tabular-nums text-slate-950 dark:text-white">
                            {formatCurrency(item.amount, currency)}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: colors?.bar || '#94a3b8',
                          }}
                        />
                      </div>

                      {/* Category Budget Status if specified */}
                      {hasBudget && percentOfCatBudget !== null && (
                        <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono tabular-nums">
                          <span>Cap: {formatCurrency(item.budgetLimit!, currency)}</span>
                          <span
                            className={
                              percentOfCatBudget > 100
                                ? 'text-rose-600 dark:text-rose-400 font-medium'
                                : percentOfCatBudget > 85
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {percentOfCatBudget.toFixed(0)}% used
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              No transactions logged for this month.
            </div>
          )}
        </div>

        {/* Top Merchants & Payment Method Share */}
        <div className="space-y-6">
          {/* Top Merchants */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              Top Merchants This Month
            </h3>

            {topMerchants.length > 0 ? (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/80">
                {topMerchants.map((item, idx) => (
                  <div
                    key={item.merchant}
                    className="py-2.5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px] w-4 shrink-0">
                        0{idx + 1}.
                      </span>
                      <div className="min-w-0 truncate">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.merchant}
                        </div>
                        <div className="text-slate-500 text-[11px] truncate">
                          {item.category} · {item.count} {item.count === 1 ? 'order' : 'orders'}
                        </div>
                      </div>
                    </div>

                    <div className="font-bold font-mono tabular-nums text-slate-950 dark:text-white shrink-0 ml-3">
                      {formatCurrency(item.total, currency)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No merchant data for this month.
              </div>
            )}
          </div>

          {/* Payment Method Distribution */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              Payment Method Breakdown
            </h3>

            <div className="mt-3 space-y-2.5">
              {paymentMethodsList.map((p) => (
                <div key={p.method} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">{p.method}</span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-white font-medium">
                      {formatCurrency(p.amount, currency)}{' '}
                      <span className="text-slate-500">({p.percentage.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${p.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Spending by Custom Label / Tag */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              Spending by Custom Tag / Label
            </h3>

            {(() => {
              const tagMap: Record<string, { total: number; count: number }> = {};
              for (const exp of monthExpenses) {
                if (exp.tags && exp.tags.length > 0) {
                  for (const t of exp.tags) {
                    if (!tagMap[t]) tagMap[t] = { total: 0, count: 0 };
                    tagMap[t].total += exp.amount;
                    tagMap[t].count += 1;
                  }
                }
              }
              const tagList = Object.entries(tagMap)
                .map(([tag, data]) => ({
                  tag,
                  amount: data.total,
                  count: data.count,
                  percentage: monthSummary.totalSpent > 0 ? (data.total / monthSummary.totalSpent) * 100 : 0,
                }))
                .sort((a, b) => b.amount - a.amount);

              if (tagList.length === 0) {
                return (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No tagged transactions this month. Add tags like #Work or #Personal to track custom groupings.
                  </div>
                );
              }

              return (
                <div className="mt-3 space-y-2.5">
                  {tagList.map((t) => (
                    <div key={t.tag} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold font-mono">
                          #{t.tag}{' '}
                          <span className="text-slate-500 font-normal">
                            ({t.count} {t.count === 1 ? 'item' : 'items'})
                          </span>
                        </span>
                        <span className="font-mono tabular-nums text-slate-950 dark:text-white font-medium">
                          {formatCurrency(t.amount, currency)}{' '}
                          <span className="text-slate-500">({t.percentage.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${t.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
