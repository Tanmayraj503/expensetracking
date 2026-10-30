import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar, AppTab } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { DailyTracker } from './components/DailyTracker';
import { MonthlyTracker } from './components/MonthlyTracker';
import { ExpenseList } from './components/ExpenseList';
import { RecurringView } from './components/RecurringView';
import { InsightsView } from './components/InsightsView';
import { ExpenseModal } from './components/ExpenseModal';
import { BudgetModal } from './components/BudgetModal';
import { Expense, BudgetSettings, RecurringRule } from './types';
import {
  loadExpenses,
  saveExpenses,
  loadBudgetSettings,
  saveBudgetSettings,
  loadRecurringRules,
  saveRecurringRules,
  INITIAL_RECURRING_RULES,
  exportToCsv,
  exportToJson,
} from './utils/storage';
import { processRecurringRules } from './utils/recurring';
import { SAMPLE_EXPENSES, DEFAULT_BUDGET_SETTINGS } from './data/sampleExpenses';
import { formatCurrency, formatMonthYear } from './utils/formatters';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>(() => loadBudgetSettings());
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>(() => loadRecurringRules());
  
  // Navigation State
  const [currentTab, setCurrentTab] = useState<AppTab>('daily');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Date State (Defaults to Current Date: October 29, 2026)
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>('2026-10');
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-29');

  // Modals & Drawers
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [addExpenseDefaultDate, setAddExpenseDefaultDate] = useState<string>('2026-10-29');

  // Notification Toast
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    type: 'success' | 'info' | 'error';
    undoAction?: () => void;
  } | null>(null);

  // Theme State: 'dark' or 'light'
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('ledgerpulse_theme_v1');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  });

  // Sync theme class to document.documentElement
  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('ledgerpulse_theme_v1', theme);
    } catch (e) {
      console.warn('Failed to persist theme preference:', e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Automatic Recurring Rules Processing on App Mount
  useEffect(() => {
    const { newExpenses, generatedCount, updatedRules } = processRecurringRules(
      recurringRules,
      expenses,
      '2026-10-29'
    );

    if (generatedCount > 0) {
      const merged = [...newExpenses, ...expenses];
      setExpenses(merged);
      saveExpenses(merged);
      setRecurringRules(updatedRules);
      saveRecurringRules(updatedRules);
      showToast(
        `Generated ${generatedCount} recurring ledger ${generatedCount === 1 ? 'entry' : 'entries'}`,
        'success'
      );
    }
  }, []);

  // Update Expenses helper
  const updateExpenses = (newExpenses: Expense[]) => {
    setExpenses(newExpenses);
    saveExpenses(newExpenses);
  };

  // Update Recurring Rules helper
  const updateRecurringRules = (newRules: RecurringRule[]) => {
    setRecurringRules(newRules);
    saveRecurringRules(newRules);
  };

  const updateBudgetSettings = (newSettings: BudgetSettings) => {
    setBudgetSettings(newSettings);
    saveBudgetSettings(newSettings);
    showToast('Budget settings updated successfully', 'success');
  };

  const showToast = (
    message: string,
    type: 'success' | 'info' | 'error' = 'info',
    undoAction?: () => void
  ) => {
    setToast({
      id: Date.now(),
      message,
      type,
      undoAction,
    });
  };

  // Extract all unique custom tags
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    expenses.forEach((e) => {
      e.tags?.forEach((t) => tagSet.add(t));
    });
    recurringRules.forEach((r) => {
      r.tags?.forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [expenses, recurringRules]);

  // Recent merchants for autocomplete
  const recentMerchants = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.merchant) set.add(e.merchant);
    });
    return Array.from(set).slice(0, 10);
  }, [expenses]);

  // Handlers for Expenses
  const handleOpenAddExpense = (datePreset?: string) => {
    setEditingExpense(null);
    setAddExpenseDefaultDate(datePreset || selectedDate || '2026-10-29');
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = (
    expenseData: Omit<Expense, 'id'>,
    existingId?: string
  ) => {
    if (existingId) {
      // Edit mode
      const updated = expenses.map((e) =>
        e.id === existingId ? { ...expenseData, id: existingId } : e
      );
      updateExpenses(updated);
      showToast(`Updated expense: ${expenseData.merchant}`, 'success');
    } else {
      // Add mode
      const newExpense: Expense = {
        ...expenseData,
        id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      };
      const updated = [newExpense, ...expenses];
      updateExpenses(updated);
      showToast(
        `Logged ${formatCurrency(newExpense.amount, budgetSettings.currency)} at ${newExpense.merchant}`,
        'success'
      );

      // If user chose to repeat this expense and no rule exists for it yet, optionally create recurring rule
      if (expenseData.isRecurring && expenseData.recurrenceFrequency) {
        const newRule: RecurringRule = {
          id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          merchant: expenseData.merchant,
          amount: expenseData.amount,
          category: expenseData.category,
          paymentMethod: expenseData.paymentMethod,
          frequency: expenseData.recurrenceFrequency,
          startDate: expenseData.date,
          tags: expenseData.tags,
          notes: expenseData.notes,
          isActive: true,
          lastGeneratedDate: expenseData.date,
          createdAt: new Date().toISOString(),
        };
        const updatedRules = [newRule, ...recurringRules];
        updateRecurringRules(updatedRules);
      }
    }
  };

  const handleQuickLogExpense = (expenseData: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    };
    const previousList = [...expenses];
    const updated = [newExpense, ...expenses];
    updateExpenses(updated);

    showToast(
      `Quick-logged ${expenseData.merchant} (${formatCurrency(expenseData.amount, budgetSettings.currency)})`,
      'success',
      () => {
        updateExpenses(previousList);
        showToast(`Undid quick-log of ${expenseData.merchant}`, 'info');
      }
    );
  };

  const handleDeleteExpense = (id: string) => {
    const expenseToDelete = expenses.find((e) => e.id === id);
    if (!expenseToDelete) return;

    const previousList = [...expenses];
    const updated = expenses.filter((e) => e.id !== id);
    updateExpenses(updated);

    showToast(
      `Removed ${expenseToDelete.merchant} (${formatCurrency(expenseToDelete.amount, budgetSettings.currency)})`,
      'info',
      () => {
        updateExpenses(previousList);
        showToast('Expense restored', 'success');
      }
    );
  };

  // Handlers for Recurring Rules
  const handleSaveRecurringRule = (
    ruleData: Omit<RecurringRule, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (existingId) {
      const updated = recurringRules.map((r) =>
        r.id === existingId
          ? { ...ruleData, id: existingId, createdAt: r.createdAt }
          : r
      );
      updateRecurringRules(updated);
      showToast(`Updated schedule for ${ruleData.merchant}`, 'success');
    } else {
      const newRule: RecurringRule = {
        ...ruleData,
        id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        createdAt: new Date().toISOString(),
      };
      const updated = [newRule, ...recurringRules];
      updateRecurringRules(updated);

      // Immediately process to generate any current entries if needed
      const { newExpenses, generatedCount } = processRecurringRules(
        [newRule],
        expenses,
        '2026-10-29'
      );
      if (generatedCount > 0) {
        updateExpenses([...newExpenses, ...expenses]);
      }

      showToast(
        `Created ${newRule.frequency} schedule for ${newRule.merchant}`,
        'success'
      );
    }
  };

  const handleDeleteRecurringRule = (id: string) => {
    const rule = recurringRules.find((r) => r.id === id);
    if (!rule) return;
    const updated = recurringRules.filter((r) => r.id !== id);
    updateRecurringRules(updated);
    showToast(`Deleted recurring rule for ${rule.merchant}`, 'info');
  };

  const handleToggleRecurringActive = (id: string) => {
    const updated = recurringRules.map((r) =>
      r.id === id ? { ...r, isActive: !r.isActive } : r
    );
    updateRecurringRules(updated);
    const target = updated.find((r) => r.id === id);
    showToast(
      target?.isActive
        ? `Resumed ${target.merchant} schedule`
        : `Paused ${target?.merchant} schedule`,
      'info'
    );
  };

  const handleManualTriggerRecurring = () => {
    const { newExpenses, generatedCount, updatedRules } = processRecurringRules(
      recurringRules,
      expenses,
      '2026-10-29'
    );

    if (generatedCount > 0) {
      updateExpenses([...newExpenses, ...expenses]);
      updateRecurringRules(updatedRules);
      showToast(
        `Successfully generated ${generatedCount} recurring ${generatedCount === 1 ? 'entry' : 'entries'}`,
        'success'
      );
    } else {
      showToast('All recurring schedules are up to date. No entries needed.', 'info');
    }
  };

  const handleExportCsvAction = () => {
    exportToCsv(expenses, budgetSettings.currency);
    showToast('Exported expense ledger with tags and repeats to CSV', 'success');
  };

  const handleResetData = () => {
    if (window.confirm('Reset all expenses, recurring rules, and targets to original sample values?')) {
      updateExpenses(SAMPLE_EXPENSES);
      updateRecurringRules(INITIAL_RECURRING_RULES);
      setBudgetSettings(DEFAULT_BUDGET_SETTINGS);
      saveBudgetSettings(DEFAULT_BUDGET_SETTINGS);
      setSelectedYearMonth('2026-10');
      setSelectedDate('2026-10-29');
      showToast('Reset to original sample data', 'info');
    }
  };

  const handleSelectYearMonth = (ym: string) => {
    setSelectedYearMonth(ym);
    if (!selectedDate.startsWith(ym)) {
      setSelectedDate(`${ym}-01`);
    }
  };

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    const ym = dateStr.slice(0, 7);
    if (ym !== selectedYearMonth) {
      setSelectedYearMonth(ym);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-700 dark:selection:text-emerald-300 transition-colors duration-200">
      {/* Collapsible Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenAddExpense={() => handleOpenAddExpense()}
        onOpenBudgetModal={() => setIsBudgetModalOpen(true)}
        onExportCsv={handleExportCsvAction}
        onResetData={handleResetData}
        budgetSettings={budgetSettings}
        activeRecurringRulesCount={recurringRules.filter((r) => r.isActive).length}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Contextual Nav */}
        <TopNav
          currentTab={currentTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenAddExpense={() => handleOpenAddExpense()}
          onOpenBudgetModal={() => setIsBudgetModalOpen(true)}
          currency={budgetSettings.currency}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Viewport Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {currentTab === 'daily' && (
            <DailyTracker
              expenses={expenses}
              selectedYearMonth={selectedYearMonth}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              budgetSettings={budgetSettings}
              onAddExpenseForDate={(date) => handleOpenAddExpense(date)}
              onEditExpense={handleOpenEditExpense}
              onDeleteExpense={handleDeleteExpense}
              onQuickLogExpense={handleQuickLogExpense}
            />
          )}

          {currentTab === 'monthly' && (
            <MonthlyTracker
              expenses={expenses}
              selectedYearMonth={selectedYearMonth}
              onSelectYearMonth={handleSelectYearMonth}
              budgetSettings={budgetSettings}
              onOpenBudgetModal={() => setIsBudgetModalOpen(true)}
              theme={theme}
            />
          )}

          {currentTab === 'ledger' && (
            <ExpenseList
              expenses={expenses}
              budgetSettings={budgetSettings}
              onEditExpense={handleOpenEditExpense}
              onDeleteExpense={handleDeleteExpense}
              onAddExpense={() => handleOpenAddExpense()}
              onExportCsv={handleExportCsvAction}
            />
          )}

          {currentTab === 'recurring' && (
            <RecurringView
              recurringRules={recurringRules}
              onSaveRule={handleSaveRecurringRule}
              onDeleteRule={handleDeleteRecurringRule}
              onToggleActive={handleToggleRecurringActive}
              onTriggerGenerate={handleManualTriggerRecurring}
              budgetSettings={budgetSettings}
              availableTags={availableTags}
            />
          )}

          {currentTab === 'insights' && (
            <InsightsView
              expenses={expenses}
              budgetSettings={budgetSettings}
              selectedYearMonth={selectedYearMonth}
              onSelectYearMonth={handleSelectYearMonth}
              onOpenBudgetModal={() => setIsBudgetModalOpen(true)}
              theme={theme}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 py-5 text-center text-xs text-slate-500 transition-colors">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-400">LedgerPulse</span>
              <span>·</span>
              <span className="text-slate-600 dark:text-slate-500">Daily, Monthly & Recurring Financial Intelligence</span>
            </div>

            <div className="flex items-center gap-4 text-slate-600 dark:text-slate-500">
              <button
                type="button"
                onClick={handleExportCsvAction}
                className="hover:text-slate-900 dark:hover:text-slate-300 transition-colors"
              >
                Export CSV
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => exportToJson(expenses, budgetSettings, recurringRules)}
                className="hover:text-slate-900 dark:hover:text-slate-300 transition-colors"
              >
                Backup JSON
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={handleResetData}
                className="hover:text-slate-900 dark:hover:text-slate-300 transition-colors"
              >
                Reset Data
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Expense Modal (Add / Edit) */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSave={handleSaveExpense}
        editingExpense={editingExpense}
        defaultDate={addExpenseDefaultDate}
        budgetSettings={budgetSettings}
        recentMerchants={recentMerchants}
        availableTags={availableTags}
      />

      {/* Budget & Target Modal */}
      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        budgetSettings={budgetSettings}
        onSaveSettings={updateBudgetSettings}
      />

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs px-4 py-3 rounded-xl shadow-2xl transition-all">
          {toast.type === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
          )}
          {toast.type === 'info' && (
            <Info className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
          )}
          {toast.type === 'error' && (
            <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
          )}

          <span className="font-medium">{toast.message}</span>

          {toast.undoAction && (
            <button
              type="button"
              onClick={toast.undoAction}
              className="ml-2 px-2 py-0.5 font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 rounded transition-colors"
            >
              Undo
            </button>
          )}

          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
