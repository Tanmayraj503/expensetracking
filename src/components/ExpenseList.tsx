import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  CreditCard,
  Edit2,
  Trash2,
  Plus,
  Calendar,
  X,
  FileSpreadsheet,
  Tag,
  Repeat,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedRecurrence, setSelectedRecurrence] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const currency = budgetSettings.currency;

  // Extract all unique tags dynamically
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    expenses.forEach((e) => {
      e.tags?.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [expenses]);

  // Extract available months from expenses for the month filter dropdown
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    expenses.forEach((e) => {
      monthSet.add(e.date.slice(0, 7));
    });
    return Array.from(monthSet).sort().reverse();
  }, [expenses]);

  // Filtered and sorted expenses
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
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

        // Month filter
        if (selectedMonth !== 'all' && !e.date.startsWith(selectedMonth)) {
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
        return 0;
      });
  }, [
    expenses,
    searchQuery,
    selectedCategory,
    selectedTag,
    selectedRecurrence,
    selectedPaymentMethod,
    selectedMonth,
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
    searchQuery !== '' ||
    selectedCategory !== 'all' ||
    selectedTag !== 'all' ||
    selectedRecurrence !== 'all' ||
    selectedPaymentMethod !== 'all' ||
    selectedMonth !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedTag('all');
    setSelectedRecurrence('all');
    setSelectedPaymentMethod('all');
    setSelectedMonth('all');
  };

  return (
    <div className="space-y-6">
      {/* Ledger Header & Search/Filter Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Expense Ledger & Tags
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Comprehensive transaction history with custom tags, repeats, search, and export
            </p>
          </div>

          <div className="flex items-center gap-3">
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
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          {/* Search Input */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search merchant, tag, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white rounded-lg pl-9 pr-3 py-2 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Tag Filter */}
          <div>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">All Tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          </div>

          {/* Recurrence Filter */}
          <div>
            <select
              value={selectedRecurrence}
              onChange={(e) => setSelectedRecurrence(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="all">All Repeats</option>
              <option value="recurring">Recurring Only</option>
              <option value="one-time">One-Time Only</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
            </select>
          </div>
        </div>

        {/* Quick Tag Pills for One-Click Tag Filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-slate-600 dark:text-slate-400 text-[11px] font-medium mr-1">Filter by Tag:</span>
            <button
              type="button"
              onClick={() => setSelectedTag('all')}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                selectedTag === 'all'
                  ? 'bg-slate-800 dark:bg-slate-700 text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800'
              }`}
            >
              All
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

        {/* Active Filter Indicators & Total Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs border-t border-slate-200 dark:border-slate-800/60">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 dark:text-slate-400">
              Showing <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">{filteredExpenses.length}</span>{' '}
              {filteredExpenses.length === 1 ? 'transaction' : 'transactions'}
            </span>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 ml-2 font-medium"
              >
                <X className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
            Total:{' '}
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
                              <span className={`${catColor.text} font-medium`}>
                                {expense.category}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{expense.paymentMethod}</span>
                              {expense.time && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {expense.time}
                                  </span>
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
          /* Flat Table View for Amount-Sorted Views */
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
                      </div>

                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <span className={`${catColor.text} font-medium`}>
                          {expense.category}
                        </span>
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
            No transactions matched your current search filters, labels, or date range.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
              >
                Clear Filters
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
