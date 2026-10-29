import React from 'react';
import {
  Calendar,
  BarChart3,
  Receipt,
  Sparkles,
  Repeat,
  SlidersHorizontal,
  Download,
  RotateCcw,
  Plus,
  PanelLeftClose,
  PanelLeft,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { BudgetSettings, RecurringRule } from '../types';

export type AppTab = 'daily' | 'monthly' | 'ledger' | 'recurring' | 'insights';

interface SidebarProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenAddExpense: () => void;
  onOpenBudgetModal: () => void;
  onExportCsv: () => void;
  onResetData: () => void;
  budgetSettings: BudgetSettings;
  activeRecurringRulesCount: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onOpenAddExpense,
  onOpenBudgetModal,
  onExportCsv,
  onResetData,
  budgetSettings,
  activeRecurringRulesCount,
  theme,
  onToggleTheme,
}) => {
  const navItems = [
    {
      id: 'daily' as AppTab,
      label: 'Daily Spend',
      description: 'Run rate & 31-day trajectory',
      icon: Calendar,
    },
    {
      id: 'monthly' as AppTab,
      label: 'Monthly Tracking',
      description: 'Budget pacing & category chart',
      icon: BarChart3,
    },
    {
      id: 'ledger' as AppTab,
      label: 'Expense Ledger',
      description: 'Full transactions & tags',
      icon: Receipt,
    },
    {
      id: 'recurring' as AppTab,
      label: 'Recurring Schedules',
      description: 'Daily, weekly & monthly repeats',
      icon: Repeat,
      badge: activeRecurringRulesCount > 0 ? activeRecurringRulesCount : undefined,
    },
    {
      id: 'insights' as AppTab,
      label: 'AI Insights',
      description: 'Gemini financial tips & health',
      icon: Sparkles,
      highlight: true,
    },
  ];

  const handleNavClick = (tab: AppTab) => {
    onTabChange(tab);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-3 sm:p-4 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 transition-colors duration-200">
      {/* Top Brand & New Action */}
      <div className="space-y-4">
        {/* Brand Lockup */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-base tracking-tighter shrink-0 shadow-xs">
              LP
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white block truncate">
                  LedgerPulse
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block truncate">
                  Financial Spend Intelligence
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Action: Add Expense */}
        <button
          type="button"
          onClick={() => {
            onOpenAddExpense();
            onCloseMobile();
          }}
          className={`w-full font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
            isCollapsed ? 'p-2.5' : 'px-3.5 py-2.5 text-xs sm:text-sm'
          }`}
          title="Add Expense"
        >
          <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Add Expense</span>}
        </button>

        {/* Navigation Items */}
        <nav className="space-y-1 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 rounded-lg text-xs font-medium transition-colors text-left ${
                  isCollapsed ? 'p-2.5 justify-center' : 'px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-950 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/40'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive
                      ? item.highlight
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-white'
                      : item.highlight
                      ? 'text-emerald-600 dark:text-emerald-400/80'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                />

                {!isCollapsed && (
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="ml-2 px-1.5 py-0.2 text-[10px] font-mono tabular-nums font-bold rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-emerald-700 dark:text-emerald-400">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Theme Toggle, Settings & Tools */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 space-y-1">
        {/* Accessible Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className={`w-full flex items-center gap-3 rounded-lg text-xs font-medium transition-colors ${
            isCollapsed ? 'p-2.5 justify-center' : 'px-3 py-2'
          } text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50`}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 shrink-0 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 shrink-0 text-indigo-600" />
          )}
          {!isCollapsed && (
            <span className="truncate">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenBudgetModal();
            onCloseMobile();
          }}
          className={`w-full flex items-center gap-3 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors ${
            isCollapsed ? 'p-2.5 justify-center' : 'px-3 py-2'
          }`}
          title="Budget Settings"
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
          {!isCollapsed && <span className="truncate">Budget Settings</span>}
        </button>

        <button
          type="button"
          onClick={() => {
            onExportCsv();
            onCloseMobile();
          }}
          className={`w-full flex items-center gap-3 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors ${
            isCollapsed ? 'p-2.5 justify-center' : 'px-3 py-2'
          }`}
          title="Export CSV"
        >
          <Download className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
          {!isCollapsed && <span className="truncate">Export CSV</span>}
        </button>

        <button
          type="button"
          onClick={() => {
            onResetData();
            onCloseMobile();
          }}
          className={`w-full flex items-center gap-3 rounded-lg text-xs text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors ${
            isCollapsed ? 'p-2.5 justify-center' : 'px-3 py-2'
          }`}
          title="Reset Sample Data"
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="truncate">Reset Sample Data</span>}
        </button>

        {/* Currency & Monthly Budget Indicator */}
        {!isCollapsed && (
          <div className="mt-3 p-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg text-[11px] font-mono">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span>Target:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-200">
                {budgetSettings.currency} {budgetSettings.monthlyBudget}/mo
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500 mt-0.5">
              <span>Daily Rate:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {budgetSettings.currency} {budgetSettings.dailyTarget}/day
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden md:block shrink-0 sticky top-0 h-screen transition-all duration-200 z-30 ${
          isCollapsed ? 'w-18' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Mobile Off-Canvas Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 md:hidden transition-transform duration-300 transform ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};
