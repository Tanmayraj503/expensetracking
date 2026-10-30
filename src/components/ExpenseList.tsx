import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  SlidersHorizontal,
  ArrowUpDown,
  CreditCard,
  Edit2,
  Trash2,
  Plus,
  Calendar,
  CalendarRange,
  X,
  FileSpreadsheet,
  Tag,
  Repeat,
  Building2,
  RotateCcw,
  Check,
} from 'lucide-react';
import { Expense, ExpenseCategory, BudgetSettings } from '../types';
import { CATEGORIES, CATEGORY_COLORS, PAYMENT_METHODS } from '../data/sampleExpenses';
import {
  formatCurrency,
  formatDateLabel,
  formatFullDate,
  formatMonthYear,
} from '../utils/formatters';

interface ExpenseListProps {
  expenses: Expense[];
  budgetSettings: BudgetSettings;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onAddExpense: () => void;
  onExportCsv: () => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  budgetSettings,
  onEditExpense,
  onDeleteExpense,
  onAddExpense,
  onExportCsv,
}) => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedRecurrence, setSelectedRecurrence] = useState<string>('all');
  const [sortBy, setSortBy] = useState<
    'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'merchant-asc'
  >('date-desc');

  // Date Range State
  const [datePreset, setDatePreset] = useState<
    'all' | 'this-month' | 'last-7' | 'last-30' | 'custom'
  >('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [showDateRangeCustom, setShowDateRangeCustom] = useState<boolean>(false);

  const currency = budgetSettings.currency;

  // Extract all unique merchants with counts
  const allMerchants = useMemo(() => {
    const merchantMap = new Map<string, number>();
    expenses.forEach((e) => {
      merchantMap.set(e.merchant, (merchantMap.get(e.merchant) || 0) + 1);
    });
    return Array.from(merchantMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([merchant, count]) => ({ merchant, count }));
  }, [expenses]);

  // Extract category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.forEach((e) => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return counts;
  }, [expenses]);

  // Extract all unique tags dynamically
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    expenses.forEach((e) => {
      e.tags?.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [expenses]);

  // Handler for Date Range Presets
  const handleDatePresetChange = (
    preset: 'all' | 'this-month' | 'last-7' | 'last-30' | 'custom'
  ) => {
    setDatePreset(preset);
    const anchorStr = '2026-10-29';
    const [y, m, d] = anchorStr.split('-').map(Number);
    const anchorDate = new Date(y, m - 1, d);

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      setShowDateRangeCustom(false);
    } else if (preset === 'this-month') {
      setStartDate('2026-10-01');
      setEndDate('2026-10-31');
      setShowDateRangeCustom(false);
    } else if (preset === 'last-7') {
      const past7 = new Date(anchorDate);
      past7.setDate(anchorDate.getDate() - 6);
      const past7Str = `${past7.getFullYear()}-${String(past7.getMonth() + 1).padStart(2, '0')}-${String(past7.getDate()).padStart(2, '0')}`;
      setStartDate(past7Str);
      setEndDate(anchorStr);
      setShowDateRangeCustom(false);
    } else if (preset === 'last-30') {
      const past30 = new Date(anchorDate);
      past30.setDate(anchorDate.getDate() - 29);
      const past30Str = `${past30.getFullYear()}-${String(past30.getMonth() + 1).padStart(2, '0')}-${String(past30.getDate()).padStart(2, '0')}`;
      setStartDate(past30Str);
      setEndDate(anchorStr);
      setShowDateRangeCustom(false);
    } else if (preset === 'custom') {
      setShowDateRangeCustom(true);
      if (!startDate) setStartDate('2026-10-01');
      if (!endDate) setEndDate(anchorStr);
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setDatePreset('custom');
    setShowDateRangeCustom(true);
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setDatePreset('custom');
    setShowDateRangeCustom(true);
  };

  // Filtered and sorted expenses
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        // Merchant filter (exact dropdown)
        if (selectedMerchant !== 'all' && e.merchant !== selectedMerchant) {
          return false;
        }

        // Search query (matches merchant, notes, category, or tags)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchMerchant = e.merchant.toLowerCase().includes(q);
          const matchNotes = (e.notes || '').toLowerCase().includes(q);
          const matchCategory = e.category.toLowerCase().includes(q);
          const matchTags = e.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchMerchant && !matchNotes && !matchCategory && !matchTags) return false;
        }

        // Category filter
        if (selectedCategory !== 'all' && e.category !== selectedCategory) {
          return false;
        }

        // Date range filter
        if (startDate && e.date < startDate) {
          return false;
        }
        if (endDate && e.date > endDate) {
          return false;
        }

        // Tag filter
        if (selectedTag !== 'all' && !e.tags?.includes(selectedTag)) {
          return false;
        }

        // Recurrence filter
        if (selectedRecurrence === 'recurring' && !e.isRecurring) {
          return false;
        }
        if (selectedRecurrence === 'one-time' && e.isRecurring) {
          return false;
        }

        // Payment method filter
        if (selectedPaymentMethod !== 'all' && e.paymentMethod !== selectedPaymentMethod) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
        }
        if (sortBy === 'date-asc') {
          return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
        }
        if (sortBy === 'amount-desc') {
          return b.amount - a.amount;
        }
        if (sortBy === 'amount-asc') {
          return a.amount - b.amount;
        }
        if (sortBy === 'merchant-asc') {
          return a.merchant.localeCompare(b.merchant);
        }
        return 0;
      });
  }, [
    expenses,
    searchQuery,
    selectedMerchant,
    selectedCategory,
    startDate,
    endDate,
    selectedTag,
    selectedRecurrence,
    selectedPaymentMethod,
    sortBy,
  ]);

  // Total amount of filtered list
  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  // Group expenses by date (for date-sorted views)
  const groupedByDate = useMemo(() => {
    const groups: Array<{ date: string; items: Expense[]; subtotal: number }> = [];
    const dateMap = new Map<string, Expense[]>();

    filteredExpenses.forEach((exp) => {
      const list = dateMap.get(exp.date) || [];
      list.push(exp);
      dateMap.set(exp.date, list);
    });

    dateMap.forEach((items, date) => {
      const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
      groups.push({ date, items, subtotal });
    });

    return groups;
  }, [filteredExpenses]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedMerchant !== 'all' ||
    selectedCategory !== 'all' ||
    startDate !== '' ||
    endDate !== '' ||
    selectedTag !== 'all' ||
    selectedRecurrence !== 'all' ||
    selectedPaymentMethod !== 'all';

  const activeFiltersCount =
    (searchQuery.trim() !== '' ? 1 : 0) +
    (selectedMerchant !== 'all' ? 1 : 0) +
    (selectedCategory !== 'all' ? 1 : 0) +
    (startDate !== '' || endDate !== '' ? 1 : 0) +
    (selectedTag !== 'all' ? 1 : 0) +
    (selectedRecurrence !== 'all' ? 1 : 0) +
    (selectedPaymentMethod !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedMerchant('all');
    setSelectedCategory('all');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setSelectedTag('all');
    setSelectedRecurrence('all');
    setSelectedPaymentMethod('all');
    setShowDateRangeCustom(false);
  };

  const clearDateRange = () => {
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setShowDateRangeCustom(false);
  };

  return (
    <div className="space-y-6">
      {/* Ledger Header & Search/Filter Controls Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs transition-colors">
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Expense Ledger & Explorer
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {expenses.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Live search and filter transactions by merchant name, category, or date range
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onExportCsv}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={onAddExpense}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
          </div>
        </div>

        {/* Primary Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
          {/* Merchant / General Search Input */}
          <div className="sm:col-span-2 lg:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              aria-label="Search by merchant name, category, or notes"
              placeholder="Search merchant name (e.g. Starbucks, Target)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white rounded-lg pl-9 pr-8 py-2 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="lg:col-span-3">
            <select
              aria-label="Filter by Category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-500 transition-colors"
            >
              <option value="all">All Categories ({expenses.length})</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} ({categoryCounts[cat] || 0})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Selector Dropdown */}
          <div className="lg:col-span-3">
            <div className="relative">
              <select
                aria-label="Filter by Date Range"
                value={datePreset}
                onChange={(e) =>
                  handleDatePresetChange(
                    e.target.value as 'all' | 'this-month' | 'last-7' | 'last-30' | 'custom'
                  )
                }
                className={`w-full bg-slate-50 dark:bg-slate-950 border text-xs text-slate-800 dark:text-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-hidden focus:border-emerald-500 transition-colors ${
                  startDate || endDate
                    ? 'border-emerald-500/50 dark:border-emerald-500/50 ring-1 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <option value="all">Date: All Time</option>
                <option value="this-month">Date: This Month (Oct 2026)</option>
                <option value="last-7">Date: Last 7 Days (Oct 23–29)</option>
                <option value="last-30">Date: Last 30 Days</option>
                <option value="custom">Date: Custom Range...</option>
              </select>
              <CalendarRange className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="sm:col-span-1 lg:col-span-2">
            <select
              aria-label="Sort Transactions"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:border-emerald-500 transition-colors"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
              <option value="merchant-asc">Merchant (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Date Range Custom Input Bar (Shows when Date preset is active or Custom chosen) */}
        {(datePreset !== 'all' || startDate || endDate || showDateRangeCustom) && (
          <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Date Range:</span>
              </span>

              {/* Start Date */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[11px]">From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white rounded px-2 py-1 font-mono focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* End Date */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[11px]">To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white rounded px-2 py-1 font-mono focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Quick Presets Buttons */}
              <div className="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  onClick={() => handleDatePresetChange('this-month')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    datePreset === 'this-month'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePresetChange('last-7')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    datePreset === 'last-7'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  Last 7D
                </button>
                <button
                  type="button"
                  onClick={() => handleDatePresetChange('last-30')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    datePreset === 'last-30'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  Last 30D
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={clearDateRange}
              className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 font-medium transition-colors self-start md:self-auto"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Date Range</span>
            </button>
          </div>
        )}

        {/* Secondary Filters Bar (Merchant Selector, Tags, Recurrence, Method) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Merchant Dropdown Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" />
                <span>Merchant:</span>
              </span>
              <select
                aria-label="Filter by Specific Merchant"
                value={selectedMerchant}
                onChange={(e) => setSelectedMerchant(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded px-2.5 py-1 focus:outline-hidden focus:border-emerald-500"
              >
                <option value="all">All Merchants ({allMerchants.length})</option>
                {allMerchants.map(({ merchant, count }) => (
                  <option key={merchant} value={merchant}>
                    {merchant} ({count})
                  </option>
                ))}
              </select>
            </div>

            {/* Recurrence Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
                <Repeat className="w-3 h-3 text-slate-400" />
                <span>Type:</span>
              </span>
              <select
                aria-label="Filter by Recurrence"
                value={selectedRecurrence}
                onChange={(e) => setSelectedRecurrence(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded px-2.5 py-1 focus:outline-hidden focus:border-emerald-500"
              >
                <option value="all">All Repeats</option>
                <option value="recurring">Recurring Only</option>
                <option value="one-time">One-Time Only</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-slate-400" />
                <span>Payment:</span>
              </span>
              <select
                aria-label="Filter by Payment Method"
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded px-2.5 py-1 focus:outline-hidden focus:border-emerald-500"
              >
                <option value="all">All Methods</option>
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Date Custom Range Toggle */}
          <button
            type="button"
            onClick={() => setShowDateRangeCustom(!showDateRangeCustom)}
            className={`text-xs px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 ${
              showDateRangeCustom || startDate || endDate
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 font-medium'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>{showDateRangeCustom ? 'Hide Date Inputs' : 'Custom Dates'}</span>
          </button>
        </div>

        {/* Quick Category Chips for One-Tap Filtering */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              Quick Filter by Category:
            </span>
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
              >
                Clear category
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800'
              }`}
            >
              All ({expenses.length})
            </button>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = categoryCounts[cat] || 0;
              if (count === 0 && !isSelected) return null;
              const catColor = CATEGORY_COLORS[cat];

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? 'all' : cat)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: catColor?.bar || '#10b981' }}
                  />
                  <span>{cat}</span>
                  <span
                    className={`font-mono text-[10px] ${
                      isSelected ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Tag Filter Chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-slate-500 text-[11px] font-medium mr-1 flex items-center gap-1">
              <Tag className="w-3 h-3 text-slate-400" />
              <span>Tags:</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedTag('all')}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                selectedTag === 'all'
                  ? 'bg-slate-800 dark:bg-slate-700 text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800'
              }`}
            >
              All Tags
            </button>
            {allTags.map((tag) => {
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(isSelected ? 'all' : tag)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1 ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <span>#{tag}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Filters Badges & Summary Metrics Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800/60 text-xs">
          {/* Active Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-600 dark:text-slate-400">
              Showing{' '}
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                {filteredExpenses.length}
              </span>{' '}
              of{' '}
              <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                {expenses.length}
              </span>{' '}
              {filteredExpenses.length === 1 ? 'transaction' : 'transactions'}
            </span>

            {/* Merchant Active Badge */}
            {selectedMerchant !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium">
                Merchant: {selectedMerchant}
                <button
                  type="button"
                  onClick={() => setSelectedMerchant('all')}
                  className="hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Search Query Badge */}
            {searchQuery.trim() !== '' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium">
                Search: "{searchQuery}"
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Category Badge */}
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-medium">
                Category: {selectedCategory}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Date Range Badge */}
            {(startDate || endDate) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 font-medium font-mono">
                Dates: {startDate ? formatDateLabel(startDate) : 'Start'} →{' '}
                {endDate ? formatDateLabel(endDate) : 'End'}
                <button type="button" onClick={clearDateRange} className="hover:text-rose-500">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Tag Badge */}
            {selectedTag !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 font-medium">
                Tag: #{selectedTag}
                <button
                  type="button"
                  onClick={() => setSelectedTag('all')}
                  className="hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Recurrence Badge */}
            {selectedRecurrence !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-medium capitalize">
                Type: {selectedRecurrence}
                <button
                  type="button"
                  onClick={() => setSelectedRecurrence('all')}
                  className="hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Payment Method Badge */}
            {selectedPaymentMethod !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-medium">
                Method: {selectedPaymentMethod}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('all')}
                  className="hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 ml-2 font-semibold transition-colors"
              >
                <X className="w-3 h-3" />
                <span>Reset All ({activeFiltersCount})</span>
              </button>
            )}
          </div>

          {/* Filtered Total Display */}
          <div className="text-slate-600 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap self-end sm:self-auto">
            Filtered Total:{' '}
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {formatCurrency(totalFilteredAmount, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Grouped Ledger Table / Cards */}
      {filteredExpenses.length > 0 ? (
        sortBy.startsWith('date') ? (
          /* Date-Grouped View */
          <div className="space-y-4">
            {groupedByDate.map((group) => (
              <div
                key={group.date}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition-colors"
              >
                {/* Date Group Header */}
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                      {formatFullDate(group.date)}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      · {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>

                  <div className="font-mono tabular-nums font-bold text-xs text-slate-800 dark:text-slate-200">
                    Subtotal: {formatCurrency(group.subtotal, currency)}
                  </div>
                </div>

                {/* Date Group Items */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {group.items.map((expense) => {
                    const catColor = CATEGORY_COLORS[expense.category] || {
                      text: 'text-slate-500 dark:text-slate-400',
                    };

                    return (
                      <div
                        key={expense.id}
                        className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                            <CreditCard className="w-3.5 h-3.5" />
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                                {expense.merchant}
                              </span>
                              {expense.isRecurring && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700 font-mono capitalize">
                                  <Repeat className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>{expense.recurrenceFrequency || 'monthly'} repeat</span>
                                </span>
                              )}
                              {expense.isAutoGenerated && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                                  (Auto)
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-400">
                              <button
                                type="button"
                                onClick={() => setSelectedCategory(expense.category)}
                                className={`${catColor.text} font-medium hover:underline text-left`}
                              >
                                {expense.category}
                              </button>
                              <span aria-hidden="true">·</span>
                              <span>{expense.paymentMethod}</span>
                              {expense.time && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">{expense.time}</span>
                                </>
                              )}
                            </div>

                            {/* Tags display */}
                            {expense.tags && expense.tags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                {expense.tags.map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => setSelectedTag(tag)}
                                    className="text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-slate-100 dark:bg-slate-800/70 hover:bg-slate-200 dark:hover:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700/60 transition-colors"
                                  >
                                    #{tag}
                                  </button>
                                ))}
                              </div>
                            )}

                            {expense.notes && (
                              <p className="text-[11px] text-slate-500 italic truncate">
                                "{expense.notes}"
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800/60">
                          <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                            {formatCurrency(expense.amount, currency)}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditExpense(expense)}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteExpense(expense.id)}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Flat Table View for Amount-Sorted and Merchant-Sorted Views */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 shadow-xs transition-colors">
            {filteredExpenses.map((expense) => {
              const catColor = CATEGORY_COLORS[expense.category] || {
                text: 'text-slate-500 dark:text-slate-400',
              };

              return (
                <div
                  key={expense.id}
                  className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                          {expense.merchant}
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 text-xs">
                          {formatDateLabel(expense.date)}
                        </span>
                        {expense.isRecurring && (
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700 font-mono capitalize">
                            {expense.recurrenceFrequency || 'recurring'}
                          </span>
                        )}
                        {expense.isAutoGenerated && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                            (Auto)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <button
                          type="button"
                          onClick={() => setSelectedCategory(expense.category)}
                          className={`${catColor.text} font-medium hover:underline text-left`}
                        >
                          {expense.category}
                        </button>
                        <span aria-hidden="true">·</span>
                        <span>{expense.paymentMethod}</span>
                      </div>

                      {/* Tags */}
                      {expense.tags && expense.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {expense.tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setSelectedTag(tag)}
                              className="text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-slate-100 dark:bg-slate-800/70 hover:bg-slate-200 dark:hover:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700/60 transition-colors"
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800/60">
                    <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(expense.amount, currency)}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(expense.id)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-xs transition-colors">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300">
            No expenses found
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-500 max-w-sm mx-auto mt-1">
            No transactions matched your current search filters, merchant name, category, or date range.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
              >
                Clear All Filters
              </button>
            )}
            <button
              type="button"
              onClick={onAddExpense}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log New Expense</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
