import React, { useState, useMemo } from 'react';
import {
  X,
  FileDown,
  Calendar,
  Check,
  Table,
  Layers,
  ArrowRight,
  Sparkles,
  AlertCircle,
  FileText,
  Clock,
  PieChart as PieIcon,
} from 'lucide-react';
import { Expense, BudgetSettings } from '../types';
import { formatCurrency, formatMonthYear } from '../utils/formatters';
import { generateSpendingsPdf, PdfReportPeriod, formatPdfCurrency } from '../utils/pdfGenerator';
import { CATEGORY_COLORS } from '../data/sampleExpenses';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Expense[];
  budgetSettings: BudgetSettings;
  initialPeriod?: PdfReportPeriod;
  initialYearMonth?: string;
  onExportSuccess?: (filename: string, count: number, total: number) => void;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  expenses,
  budgetSettings,
  initialPeriod = 'monthly',
  initialYearMonth = '2026-10',
  onExportSuccess,
}) => {
  const [period, setPeriod] = useState<PdfReportPeriod>(initialPeriod);
  const [selectedMonth, setSelectedMonth] = useState<string>(initialYearMonth);
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [weeklyOption, setWeeklyOption] = useState<'current-week' | 'last-7-days' | 'prev-week'>('last-7-days');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-10-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-10-29');

  const [includeCategoryBreakdown, setIncludeCategoryBreakdown] = useState<boolean>(true);
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const currency = budgetSettings.currency;

  // Calculate distinct available months and years from expenses
  const { availableMonths, availableYears } = useMemo(() => {
    const monthsSet = new Set<string>();
    const yearsSet = new Set<string>();

    expenses.forEach((e) => {
      if (e.date) {
        const ym = e.date.slice(0, 7);
        const y = e.date.slice(0, 4);
        monthsSet.add(ym);
        yearsSet.add(y);
      }
    });

    // Ensure default anchor periods exist
    monthsSet.add('2026-10');
    monthsSet.add('2026-09');
    yearsSet.add('2026');

    return {
      availableMonths: Array.from(monthsSet).sort().reverse(),
      availableYears: Array.from(yearsSet).sort().reverse(),
    };
  }, [expenses]);

  // Determine computed start and end dates based on selected period
  const { startDate, endDate, periodTitle, periodSubtitle } = useMemo(() => {
    if (period === 'weekly') {
      if (weeklyOption === 'current-week') {
        // Current week (Monday to Sunday containing Oct 29, 2026 -> Oct 26 to Nov 01)
        return {
          startDate: '2026-10-26',
          endDate: '2026-11-01',
          periodTitle: 'Weekly Expense Report',
          periodSubtitle: 'Current Calendar Week (Oct 26 – Nov 01, 2026)',
        };
      } else if (weeklyOption === 'prev-week') {
        // Previous week (Oct 19 to Oct 25)
        return {
          startDate: '2026-10-19',
          endDate: '2026-10-25',
          periodTitle: 'Weekly Expense Report',
          periodSubtitle: 'Previous Calendar Week (Oct 19 – Oct 25, 2026)',
        };
      } else {
        // Last 7 days (Oct 23 to Oct 29)
        return {
          startDate: '2026-10-23',
          endDate: '2026-10-29',
          periodTitle: 'Weekly Expense Report',
          periodSubtitle: 'Last 7 Days (Oct 23 – Oct 29, 2026)',
        };
      }
    }

    if (period === 'monthly') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const endDayStr = String(daysInMonth).padStart(2, '0');
      const monthLabel = formatMonthYear(selectedMonth);

      return {
        startDate: `${selectedMonth}-01`,
        endDate: `${selectedMonth}-${endDayStr}`,
        periodTitle: `Monthly Statement: ${monthLabel}`,
        periodSubtitle: `Full Month Period (${selectedMonth}-01 to ${selectedMonth}-${endDayStr})`,
      };
    }

    if (period === 'yearly') {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`,
        periodTitle: `Annual Financial Spending Report: ${selectedYear}`,
        periodSubtitle: `Calendar Year ${selectedYear} (Jan 01 – Dec 31)`,
      };
    }

    // Custom
    return {
      startDate: customStartDate || '2026-10-01',
      endDate: customEndDate || '2026-10-29',
      periodTitle: 'Custom Date Spending Report',
      periodSubtitle: `Custom Period (${customStartDate} to ${customEndDate})`,
    };
  }, [period, weeklyOption, selectedMonth, selectedYear, customStartDate, customEndDate]);

  // Compute preview expenses for the selected range
  const previewExpenses = useMemo(() => {
    return expenses.filter((e) => e.date >= startDate && e.date <= endDate);
  }, [expenses, startDate, endDate]);

  const totalSpend = useMemo(() => {
    return previewExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [previewExpenses]);

  // Compute top category in this period
  const topCategoryInfo = useMemo(() => {
    if (previewExpenses.length === 0) return null;
    const catMap = new Map<string, number>();
    previewExpenses.forEach((e) => {
      catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount);
    });
    const sorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
    if (!sorted[0]) return null;
    return {
      category: sorted[0][0],
      amount: sorted[0][1],
      percentage: totalSpend > 0 ? (sorted[0][1] / totalSpend) * 100 : 0,
    };
  }, [previewExpenses, totalSpend]);

  if (!isOpen) return null;

  const handleGeneratePdf = () => {
    setIsGenerating(true);
    setExportNotice(null);

    try {
      const result = generateSpendingsPdf(expenses, {
        period,
        title: periodTitle,
        subtitle: periodSubtitle,
        startDate,
        endDate,
        currency,
        includeCategoryBreakdown,
        includeNotes,
        sortBy,
      });

      setIsGenerating(false);
      setExportNotice(`Successfully downloaded "${result.filename}" with ${result.transactionCount} transactions!`);
      if (onExportSuccess) {
        onExportSuccess(result.filename, result.transactionCount, result.totalSpend);
      }
    } catch (err) {
      console.error('Failed to generate PDF report:', err);
      setIsGenerating(false);
      setExportNotice('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-colors">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <FileDown className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 id="pdf-modal-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Download Spending PDF Statement
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Generate high-resolution, paginated PDF reports for Weekly, Monthly, or Yearly spendings
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Period Selector Tabs */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40">
          <div className="flex gap-2">
            {(
              [
                { id: 'weekly', label: 'Weekly Report' },
                { id: 'monthly', label: 'Monthly Statement' },
                { id: 'yearly', label: 'Yearly Report' },
                { id: 'custom', label: 'Custom Range' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-all ${
                  period === tab.id
                    ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Period-specific controls */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3">
            {period === 'weekly' && (
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-2">
                  Select Weekly Range:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setWeeklyOption('last-7-days')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      weeklyOption === 'last-7-days'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-xs">Last 7 Days</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      Oct 23 – Oct 29, 2026
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWeeklyOption('current-week')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      weeklyOption === 'current-week'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-xs">Calendar Week</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      Oct 26 – Nov 01, 2026
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWeeklyOption('prev-week')}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      weeklyOption === 'prev-week'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-xs">Previous Week</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      Oct 19 – Oct 25, 2026
                    </div>
                  </button>
                </div>
              </div>
            )}

            {period === 'monthly' && (
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-2">
                  Select Month for Statement:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {availableMonths.map((ym) => (
                    <button
                      key={ym}
                      type="button"
                      onClick={() => setSelectedMonth(ym)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selectedMonth === ym
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {formatMonthYear(ym)}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[11px] text-slate-500">Or custom month:</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {period === 'yearly' && (
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-200 mb-2">
                  Select Calendar Year:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {availableYears.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedYear(yr)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        selectedYear === yr
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      Full Year {yr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {period === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date:
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Date:
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Live Preview Stats */}
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-emerald-500/10">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>PDF Statement Scope & Summary</span>
              </span>
              <span className="font-mono text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                {startDate} &rarr; {endDate}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">Total Spend</span>
                <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(totalSpend, currency)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">Transactions</span>
                <span className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                  {previewExpenses.length}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">Top Category</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block mt-0.5">
                  {topCategoryInfo ? topCategoryInfo.category : 'None'}
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  {topCategoryInfo ? `${topCategoryInfo.percentage.toFixed(0)}% of spend` : '—'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">PDF Formatting</span>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 block mt-0.5">
                  Vector A4 Table
                </span>
                <span className="text-[9px] text-slate-400">Zero text clipping</span>
              </div>
            </div>
          </div>

          {/* Table Customization & Sort Controls */}
          <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-2 text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider block">
              PDF Table Layout & Sorting Options
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Sort Transactions By:
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="date-desc">Date (Newest first)</option>
                  <option value="date-asc">Date (Oldest first)</option>
                  <option value="amount-desc">Amount (Highest first)</option>
                  <option value="amount-asc">Amount (Lowest first)</option>
                </select>
              </div>

              <div className="space-y-1.5 pt-1 sm:pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeCategoryBreakdown}
                    onChange={(e) => setIncludeCategoryBreakdown(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Include Category Allocation Summary table</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Include Tags and Notes column with line wrapping</span>
                </label>
              </div>
            </div>
          </div>

          {exportNotice && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{exportNotice}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
          <div className="text-[11px] text-slate-500 hidden sm:block">
            Auto-formatted with multi-page table headers and page numbers
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={isGenerating || previewExpenses.length === 0}
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm flex items-center gap-2"
            >
              <FileDown className="w-4 h-4 stroke-[2.5]" />
              <span>
                {isGenerating
                  ? 'Generating PDF...'
                  : `Download ${period === 'weekly' ? 'Weekly' : period === 'monthly' ? 'Monthly' : period === 'yearly' ? 'Yearly' : 'Custom'} PDF`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
