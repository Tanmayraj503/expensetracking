import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Expense, BudgetSettings, MonthSummary } from '../types';
import { formatCurrency, formatMonthYear } from '../utils/formatters';

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
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  expenses,
  budgetSettings,
  selectedYearMonth,
  onSelectYearMonth,
  onOpenBudgetModal,
}) => {
  const [insights, setInsights] = useState<FinancialInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);

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
  ).sort().reverse();

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
            Gemini analyzes transaction trends, spending velocity, and leaks to deliver high-impact tips
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <select
            value={selectedYearMonth}
            onChange={(e) => onSelectYearMonth(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
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
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''}`} />
            <span>{isLoading ? 'Analyzing...' : 'Re-Analyze'}</span>
          </button>
        </div>
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
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 animate-pulse h-36"></div>
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
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Potential Savings:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {tip.potentialSavings}
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-tight">
                          <strong className="text-slate-900 dark:text-slate-200">Action:</strong> {tip.actionStep}
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
                        <span className="text-slate-500 dark:text-slate-400">{adj.currentSpending}</span>
                        <ArrowRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400">{adj.suggestedBudget}</span>
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
