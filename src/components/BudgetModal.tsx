import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  DollarSign,
  Target,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  AlertCircle,
  PiggyBank,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { BudgetSettings, ExpenseCategory, SavingsGoal } from '../types';
import { CATEGORIES, CATEGORY_COLORS } from '../data/sampleExpenses';
import { CURRENCY_SYMBOLS, formatCurrency } from '../utils/formatters';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgetSettings: BudgetSettings;
  onSaveSettings: (newSettings: BudgetSettings) => void;
  initialTab?: 'budget' | 'goals';
}

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD'];

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  budgetSettings,
  onSaveSettings,
  initialTab = 'budget',
}) => {
  const [activeTab, setActiveTab] = useState<'budget' | 'goals'>(initialTab);
  const [monthlyBudget, setMonthlyBudget] = useState(budgetSettings.monthlyBudget.toString());
  const [currency, setCurrency] = useState(budgetSettings.currency);
  const [autoDailyTarget, setAutoDailyTarget] = useState(budgetSettings.autoDailyTarget);
  const [customDailyTarget, setCustomDailyTarget] = useState(budgetSettings.dailyTarget.toString());
  const [categoryBudgets, setCategoryBudgets] = useState<Partial<Record<ExpenseCategory, string>>>(
    () => {
      const initial: Partial<Record<ExpenseCategory, string>> = {};
      CATEGORIES.forEach((cat) => {
        if (budgetSettings.categoryBudgets[cat] !== undefined) {
          initial[cat] = budgetSettings.categoryBudgets[cat]?.toString() || '';
        }
      });
      return initial;
    }
  );

  // Savings Goals state
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(
    budgetSettings.savingsGoals || []
  );

  // Goal Creation / Editing Form state
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalName, setGoalName] = useState('');
  const [goalTargetAmount, setGoalTargetAmount] = useState('');
  const [goalCurrentAmount, setGoalCurrentAmount] = useState('0');
  const [goalCategory, setGoalCategory] = useState<ExpenseCategory>('Housing');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [goalNotes, setGoalNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state whenever modal opens or settings change
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setMonthlyBudget(budgetSettings.monthlyBudget.toString());
      setCurrency(budgetSettings.currency);
      setAutoDailyTarget(budgetSettings.autoDailyTarget);
      setCustomDailyTarget(budgetSettings.dailyTarget.toString());
      setSavingsGoals(budgetSettings.savingsGoals || []);
      setIsGoalFormOpen(false);
      setEditingGoalId(null);
      setFormError(null);

      const initial: Partial<Record<ExpenseCategory, string>> = {};
      CATEGORIES.forEach((cat) => {
        if (budgetSettings.categoryBudgets[cat] !== undefined) {
          initial[cat] = budgetSettings.categoryBudgets[cat]?.toString() || '';
        }
      });
      setCategoryBudgets(initial);
    }
  }, [isOpen, initialTab, budgetSettings]);

  if (!isOpen) return null;

  const currencySymbol = CURRENCY_SYMBOLS[currency] || '$';
  const numericMonthlyBudget = parseFloat(monthlyBudget) || 0;
  const computedAutoDaily = Math.round((numericMonthlyBudget / 31) * 100) / 100;

  const handleCategoryBudgetChange = (cat: ExpenseCategory, val: string) => {
    setCategoryBudgets((prev) => ({
      ...prev,
      [cat]: val,
    }));
  };

  const handleOpenAddGoal = () => {
    setEditingGoalId(null);
    setGoalName('');
    setGoalTargetAmount('');
    setGoalCurrentAmount('0');
    setGoalCategory('Travel');
    setGoalTargetDate('');
    setGoalNotes('');
    setFormError(null);
    setIsGoalFormOpen(true);
  };

  const handleOpenEditGoal = (goal: SavingsGoal) => {
    setEditingGoalId(goal.id);
    setGoalName(goal.name);
    setGoalTargetAmount(goal.targetAmount.toString());
    setGoalCurrentAmount(goal.currentAmount.toString());
    setGoalCategory(goal.category);
    setGoalTargetDate(goal.targetDate || '');
    setGoalNotes(goal.notes || '');
    setFormError(null);
    setIsGoalFormOpen(true);
  };

  const handleDeleteGoal = (goalId: string) => {
    setSavingsGoals((prev) => prev.filter((g) => g.id !== goalId));
    if (editingGoalId === goalId) {
      setIsGoalFormOpen(false);
    }
  };

  const handleQuickAddSavings = (goalId: string, delta: number) => {
    setSavingsGoals((prev) =>
      prev.map((g) => {
        if (g.id === goalId) {
          const next = Math.max(0, g.currentAmount + delta);
          return { ...g, currentAmount: next };
        }
        return g;
      })
    );
  };

  const handleSaveGoalForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim()) {
      setFormError('Please enter a goal name');
      return;
    }
    const target = parseFloat(goalTargetAmount);
    if (isNaN(target) || target <= 0) {
      setFormError('Target amount must be greater than zero');
      return;
    }
    const current = Math.max(0, parseFloat(goalCurrentAmount) || 0);

    if (editingGoalId) {
      setSavingsGoals((prev) =>
        prev.map((g) =>
          g.id === editingGoalId
            ? {
                ...g,
                name: goalName.trim(),
                targetAmount: target,
                currentAmount: current,
                category: goalCategory,
                targetDate: goalTargetDate || undefined,
                notes: goalNotes.trim() || undefined,
              }
            : g
        )
      );
    } else {
      const newGoal: SavingsGoal = {
        id: `goal-${Date.now()}`,
        name: goalName.trim(),
        targetAmount: target,
        currentAmount: current,
        category: goalCategory,
        targetDate: goalTargetDate || undefined,
        notes: goalNotes.trim() || undefined,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setSavingsGoals((prev) => [...prev, newGoal]);
    }

    setIsGoalFormOpen(false);
    setEditingGoalId(null);
    setFormError(null);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalMonthly = Math.max(0, parseFloat(monthlyBudget) || 0);
    const finalDaily = autoDailyTarget
      ? Math.round((finalMonthly / 31) * 100) / 100
      : Math.max(0, parseFloat(customDailyTarget) || 0);

    const parsedCatBudgets: Partial<Record<ExpenseCategory, number>> = {};
    CATEGORIES.forEach((cat) => {
      const raw = categoryBudgets[cat];
      if (raw && !isNaN(parseFloat(raw))) {
        parsedCatBudgets[cat] = Math.max(0, parseFloat(raw));
      }
    });

    onSaveSettings({
      monthlyBudget: finalMonthly,
      dailyTarget: finalDaily,
      autoDailyTarget,
      currency,
      categoryBudgets: parsedCatBudgets,
      savingsGoals,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs transition-colors">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Budget & Financial Goals
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Configure spending targets, category limits, and long-term savings milestones
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Tabs Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40 px-6 pt-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('budget');
              setIsGoalFormOpen(false);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'budget'
                ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Monthly & Category Caps</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('goals')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'goals'
                ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Savings Goals</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums ${
                activeTab === 'goals'
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {savingsGoals.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Monthly & Category Budgets */}
        {activeTab === 'budget' && (
          <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto">
            {/* Currency Preference */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Display Currency
              </label>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setCurrency(curr)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      currency === curr
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {CURRENCY_SYMBOLS[curr]} {curr}
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly Budget */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Overall Monthly Budget
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-lg">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Used to pace monthly spend and calculate burn-rate trajectory.
              </p>
            </div>

            {/* Daily Spend Target */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Daily Spend Target
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={autoDailyTarget}
                    onChange={(e) => setAutoDailyTarget(e.target.checked)}
                    className="rounded-xs border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Auto-divide monthly limit (31 days)</span>
                </label>
              </div>

              {autoDailyTarget ? (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Calculated Daily Run Rate:</span>
                  <span className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {currencySymbol}{computedAutoDaily.toFixed(2)}/day
                  </span>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={customDailyTarget}
                      onChange={(e) => setCustomDailyTarget(e.target.value)}
                      required
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Custom daily spending ceiling. Days exceeding this will be flagged in charts.
                  </p>
                </div>
              )}
            </div>

            {/* Category Budgets Caps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Category Spending Caps (Optional)
                </label>
                <span className="text-[11px] text-slate-500">Monthly limits</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {CATEGORIES.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between gap-3 text-xs p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-950/40"
                  >
                    <span className="text-slate-700 dark:text-slate-300">{cat}</span>
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-mono text-xs">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        placeholder="No limit"
                        value={categoryBudgets[cat] || ''}
                        onChange={(e) => handleCategoryBudgetChange(cat, e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md pl-6 pr-2 py-1 text-xs font-mono tabular-nums text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Save All Settings</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Savings Goals */}
        {activeTab === 'goals' && (
          <div className="p-6 space-y-5 overflow-y-auto">
            {/* Goal Form (New or Edit) */}
            {isGoalFormOpen ? (
              <form
                onSubmit={handleSaveGoalForm}
                className="p-4 bg-slate-50 dark:bg-slate-950/70 border border-emerald-500/30 rounded-xl space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {editingGoalId ? 'Edit Savings Goal' : 'Define New Long-Term Goal'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsGoalFormOpen(false);
                      setEditingGoalId(null);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {formError && (
                  <div className="flex items-center gap-2 p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-lg text-rose-700 dark:text-rose-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Goal Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Goal Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Emergency Buffer Fund, Japan Vacation, Down Payment"
                      value={goalName}
                      onChange={(e) => setGoalName(e.target.value)}
                      required
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Target Amount */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Amount *
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        placeholder="5000.00"
                        value={goalTargetAmount}
                        onChange={(e) => setGoalTargetAmount(e.target.value)}
                        required
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-7 pr-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Current Saved Amount */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Current Saved Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={goalCurrentAmount}
                        onChange={(e) => setGoalCurrentAmount(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-7 pr-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Associated Category */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Assigned Category
                    </label>
                    <select
                      value={goalCategory}
                      onChange={(e) => setGoalCategory(e.target.value as ExpenseCategory)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Links goal progress with monthly category tracking
                    </p>
                  </div>

                  {/* Target Date */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Completion Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={goalTargetDate}
                      onChange={(e) => setGoalTargetDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Notes / Motivation */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Notes & Strategy (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Save $200 from each paycheck; keep in high-yield account"
                      value={goalNotes}
                      onChange={(e) => setGoalNotes(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsGoalFormOpen(false);
                      setEditingGoalId(null);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{editingGoalId ? 'Update Goal' : 'Add Goal'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Active Long-Term Goals
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Define dedicated savings targets for specific spending categories
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddGoal}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>New Goal</span>
                </button>
              </div>
            )}

            {/* List of Goals */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {savingsGoals.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <PiggyBank className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    No savings goals established yet
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    Create long-term targets for vacation funds, emergency reserves, equipment upgrades, or major life investments.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenAddGoal}
                    className="mt-3 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create your first goal now</span>
                  </button>
                </div>
              ) : (
                savingsGoals.map((goal) => {
                  const percent = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                  const isDone = goal.currentAmount >= goal.targetAmount;
                  const colors = CATEGORY_COLORS[goal.category];

                  return (
                    <div
                      key={goal.id}
                      className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {goal.name}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors?.bg || 'bg-slate-100'} ${colors?.text || 'text-slate-700'} ${colors?.border || 'border-slate-300'}`}
                            >
                              {goal.category}
                            </span>
                          </div>

                          {goal.notes && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {goal.notes}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditGoal(goal)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
                            title="Edit goal"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors"
                            title="Delete goal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Amounts & Progress Bar */}
                      <div>
                        <div className="flex justify-between items-baseline text-xs mb-1 font-mono tabular-nums">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(goal.currentAmount, currency)}
                            <span className="text-slate-500 font-normal"> / {formatCurrency(goal.targetAmount, currency)}</span>
                          </span>
                          <span className={`text-[11px] font-bold ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {percent.toFixed(1)}%
                          </span>
                        </div>

                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isDone ? 'bg-emerald-500' : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${percent}%`,
                              backgroundColor: colors?.bar || undefined,
                            }}
                          />
                        </div>
                      </div>

                      {/* Quick Add Deposits & Target Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px]">
                        <div className="text-slate-500 flex items-center gap-1">
                          {goal.targetDate ? (
                            <>
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>Target: {goal.targetDate}</span>
                            </>
                          ) : (
                            <span>{formatCurrency(Math.max(0, goal.targetAmount - goal.currentAmount), currency)} to reach target</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 mr-0.5">Quick add:</span>
                          {[50, 100, 250].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => handleQuickAddSavings(goal.id, amt)}
                              className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            >
                              +{currencySymbol}{amt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Bottom Save Action */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {savingsGoals.length} {savingsGoals.length === 1 ? 'goal' : 'goals'} defined
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save All Settings & Goals</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
