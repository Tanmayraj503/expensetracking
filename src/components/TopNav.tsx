import React from 'react';
import { Menu, Plus, Calendar, SlidersHorizontal, Sun, Moon } from 'lucide-react';
import { AppTab } from './Sidebar';

interface TopNavProps {
  currentTab: AppTab;
  onOpenMobileSidebar: () => void;
  onOpenAddExpense: () => void;
  onOpenBudgetModal: () => void;
  currency: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
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

export const TopNav: React.FC<TopNavProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onOpenAddExpense,
  onOpenBudgetModal,
  theme,
  onToggleTheme,
}) => {
  const meta = TAB_TITLES[currentTab];

  return (
    <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/70 backdrop-blur-md sticky top-0 z-20 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile Menu Toggle & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 dark:text-slate-500 font-medium">LedgerPulse</span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-900 dark:text-slate-200 font-semibold truncate">{meta.title}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              {meta.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Theme Toggle, Date Pill & Quick Add Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors flex items-center justify-center"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-400 font-mono">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Today: Oct 29, 2026</span>
          </div>

          <button
            type="button"
            onClick={onOpenBudgetModal}
            className="hidden lg:flex p-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors items-center gap-1.5"
            title="Budget Settings"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Targets</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddExpense}
            className="px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>
    </header>
  );
};
