import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Plus,
  Calendar,
  SlidersHorizontal,
  Sun,
  Moon,
  Search,
  X,
  ArrowRight,
  Tag,
  FileDown,
} from 'lucide-react';
import { AppTab } from './Sidebar';
import { Expense } from '../types';
import { formatCurrency } from '../utils/formatters';
import { CATEGORY_COLORS } from '../data/sampleExpenses';

interface TopNavProps {
  currentTab: AppTab;
  onOpenMobileSidebar: () => void;
  onOpenAddExpense: () => void;
  onOpenBudgetModal: () => void;
  currency: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  matchingCount?: number;
  totalCount?: number;
  filteredExpenses?: Expense[];
  onNavigateToTab?: (tab: AppTab) => void;
  onOpenPdfExport?: () => void;
}

const TAB_TITLES: Record<AppTab, { title: string; subtitle: string }> = {
  daily: {
    title: 'Daily Spend Tracking',
    subtitle: 'Real-time burn rate, daily target buffer & 31-day trajectory',
  },
  monthly: {
    title: 'Monthly Spend Pacing',
    subtitle: 'Budget consumption, cumulative pacing curve & category doughnut chart',
  },
  ledger: {
    title: 'Expense Ledger & Tags',
    subtitle: 'Filter by custom labels, search transactions, and export data',
  },
  recurring: {
    title: 'Recurring Expense Schedules',
    subtitle: 'Automated daily, weekly, and monthly repeat ledger entries',
  },
  insights: {
    title: 'AI Financial Insights',
    subtitle: 'Gemini pattern recognition, spending diagnostics, and saving tips',
  },
};

function highlightQuery(text: string, query: string) {
  if (!query || !query.trim() || !text) return text;
  const q = query.trim().toLowerCase();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(q);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-emerald-200/90 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 font-semibold px-0.5 rounded-xs">
        {text.slice(index, index + q.length)}
      </mark>
      {text.slice(index + q.length)}
    </>
  );
}

export const TopNav: React.FC<TopNavProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onOpenAddExpense,
  onOpenBudgetModal,
  currency,
  theme,
  onToggleTheme,
  searchQuery = '',
  onSearchChange,
  matchingCount = 0,
  totalCount = 0,
  filteredExpenses = [],
  onNavigateToTab,
  onOpenPdfExport,
}) => {
  const meta = TAB_TITLES[currentTab];
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const hasQuery = searchQuery.trim().length > 0;

  // Keyboard shortcut listener: Cmd+K / Ctrl+K or '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === 'Escape') {
        if (isFocused) {
          inputRef.current?.blur();
          setIsFocused(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused]);

  // Click outside listener to dismiss quick match dropdown
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/85 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Mobile Menu Toggle & Breadcrumbs */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="md:hidden p-1.5 sm:p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:block min-w-0">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 dark:text-slate-500 font-medium">LedgerPulse</span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-900 dark:text-slate-200 font-semibold truncate max-w-[120px] md:max-w-none">
                {meta.title}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden xl:block">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="flex-1 max-w-lg min-w-[160px] sm:min-w-[240px] mx-1 sm:mx-2 relative" ref={containerRef}>
          <div className="relative flex items-center">
            <div className="absolute left-3 pointer-events-none text-slate-400 dark:text-slate-500 flex items-center">
              <Search className="w-4 h-4" />
            </div>

            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange?.(e.target.value);
                setIsFocused(true);
              }}
              onFocus={() => setIsFocused(true)}
              placeholder="Search merchant, category, note..."
              className="w-full bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-14 sm:pr-24 py-1.5 sm:py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-2xs"
              aria-label="Global expense search"
            />

            {/* Right Controls inside search input: Match Counter & Clear button or Keyboard Shortcut */}
            <div className="absolute right-2 flex items-center gap-1.5">
              {hasQuery ? (
                <>
                  <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 tabular-nums">
                    {matchingCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange?.('');
                      inputRef.current?.focus();
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                    title="Clear search (Esc)"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <span className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-300/50 dark:border-slate-700/50 select-none">
                  <kbd className="font-sans text-[9px]">Ctrl</kbd>
                  <span>+</span>
                  <kbd className="font-sans text-[9px]">K</kbd>
                </span>
              )}
            </div>
          </div>

          {/* Quick Results Flyout Dropdown when focused & has query */}
          {isFocused && hasQuery && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 text-xs animation-fade-in"
            >
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono tabular-nums">
                    {matchingCount}
                  </span>
                  <span>
                    {matchingCount === 1 ? 'transaction matches' : 'transactions match'} (of {totalCount})
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  Real-time filter active across all views
                </span>
              </div>

              {matchingCount > 0 ? (
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredExpenses.slice(0, 5).map((exp) => {
                    const colors = CATEGORY_COLORS[exp.category];
                    return (
                      <div
                        key={exp.id}
                        onClick={() => {
                          if (onNavigateToTab && currentTab !== 'ledger') {
                            onNavigateToTab('ledger');
                          }
                          setIsFocused(false);
                        }}
                        className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {highlightQuery(exp.merchant, searchQuery)}
                            </span>
                            <span
                              className={`text-[9px] font-medium px-1.5 py-0.2 rounded-full border shrink-0 ${colors?.bg || 'bg-slate-100'} ${colors?.text || 'text-slate-700'} ${colors?.border || 'border-slate-300'}`}
                            >
                              {highlightQuery(exp.category, searchQuery)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                            <span>{exp.date}</span>
                            <span>&bull;</span>
                            <span>{exp.paymentMethod}</span>
                            {exp.notes && (
                              <>
                                <span>&bull;</span>
                                <span className="text-slate-500 dark:text-slate-400 italic truncate max-w-[150px]">
                                  {highlightQuery(exp.notes, searchQuery)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                            {formatCurrency(exp.amount, currency)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-slate-500 text-xs">
                  <p className="font-medium text-slate-700 dark:text-slate-300">
                    No expenses matching "{searchQuery}"
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Try searching by merchant (e.g. Starbucks, Uber), category (e.g. Groceries), or note
                  </p>
                </div>
              )}

              <div className="p-2 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                {currentTab !== 'ledger' && matchingCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToTab?.('ledger');
                      setIsFocused(false);
                    }}
                    className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium flex items-center gap-1"
                  >
                    <span>Inspect all in Ledger</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="text-slate-400 text-[10px]">
                    Filtered in Daily, Monthly, Ledger & Insights
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange?.('');
                    setIsFocused(false);
                  }}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-auto text-[10px]"
                >
                  Clear search
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Theme Toggle, Date Pill & Quick Add Button */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors flex items-center justify-center shadow-2xs"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-400 font-mono shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Today: Oct 29, 2026</span>
          </div>

          <button
            type="button"
            onClick={onOpenBudgetModal}
            className="hidden lg:flex p-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors items-center gap-1.5 shadow-2xs"
            title="Budget Settings"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Targets</span>
          </button>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={onOpenPdfExport}
            className="p-2 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
            title="Download Spending Statement in PDF format (Weekly, Monthly, Yearly)"
            aria-label="Download Spending Statement in PDF format"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />
            <span className="hidden md:inline font-medium">Export PDF</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddExpense}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">Add Expense</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>
    </header>
  );
};
