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
  ChevronDown,
  ChevronUp,
  Tag,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { BudgetSettings, ExpenseCategory, SavingsGoal, Expense } from '../types';
import { CATEGORIES, CATEGORY_COLORS } from '../data/sampleExpenses';
import { CURRENCY_SYMBOLS, formatCurrency, calculateGoalSavings, matchExpenseToGoalTag } from '../utils/formatters';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgetSettings: BudgetSettings;
  onSaveSettings: (newSettings: BudgetSettings) => void;
  initialTab?: 'budget' | 'goals' | 'assistant';
  expenses?: Expense[];
}

type OptimizationStrategy = 'balanced' | 'aggressive-savings' | 'realistic-baseline';

interface AiCategorySuggestion {
  category: ExpenseCategory;
  historicalMonthlyAvg: number;
  latestMonthSpend: number;
  currentCap: number | null;
  suggestedCap: number;
  monthlySavingsDelta: number;
  priority: 'essential' | 'optimize' | 'cutback' | 'maintain';
  rationale: string;
}

interface AiBudgetPlan {
  summary: string;
  recommendedMonthlyBudget: number;
  projectedMonthlySavings: number;
  goalAlignmentNote: string;
  keyInsights: string[];
  categorySuggestions: AiCategorySuggestion[];
  analyzedMonthsCount: number;
  analyzedTransactionsCount: number;
}

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD'];

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  budgetSettings,
  onSaveSettings,
  initialTab = 'budget',
  expenses = [],
}) => {
  const [activeTab, setActiveTab] = useState<'budget' | 'goals' | 'assistant'>(initialTab);
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
  const [goalTag, setGoalTag] = useState('');
  const [isTagUserEdited, setIsTagUserEdited] = useState(false);
  const [goalTargetAmount, setGoalTargetAmount] = useState('');
  const [goalCurrentAmount, setGoalCurrentAmount] = useState('0');
  const [goalCategory, setGoalCategory] = useState<ExpenseCategory>('Housing');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [goalNotes, setGoalNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  // AI Budget Coach state
  const [aiStrategy, setAiStrategy] = useState<OptimizationStrategy>('balanced');
  const [aiCustomFocus, setAiCustomFocus] = useState<string>('');
  const [aiPlan, setAiPlan] = useState<AiBudgetPlan | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedAiCategories, setSelectedAiCategories] = useState<Record<string, boolean>>({});
  const [applyRecommendedOverall, setApplyRecommendedOverall] = useState<boolean>(true);
  const [aiAppliedNotice, setAiAppliedNotice] = useState<string | null>(null);

  const distinctMonthsCount = React.useMemo(() => {
    const months = new Set(
      expenses.map((e) => (e.date ? e.date.slice(0, 7) : '')).filter((ym) => ym.length === 7)
    );
    return months.size;
  }, [expenses]);

  // Extract unique tags present across transactions and suggested goal tags
  const suggestedTags = React.useMemo(() => {
    const set = new Set<string>();
    ['Emergency Fund', 'Vacation', 'Down Payment', 'Car Fund', 'Tech Setup', 'Savings', 'Retirement', 'Education'].forEach((t) =>
      set.add(t)
    );
    expenses.forEach((e) => {
      e.tags?.forEach((t) => {
        const clean = t.trim().replace(/^#/, '');
        if (clean) set.add(clean);
      });
    });
    return Array.from(set);
  }, [expenses]);

  // Live preview for form: how many transactions and total savings match the typed tag/name
  const liveMatching = React.useMemo(() => {
    const tagToMatch = (goalTag.trim() || goalName.trim()).replace(/^#/, '');
    if (!tagToMatch) return { count: 0, total: 0, sampleMerchant: null as string | null };
    const matching = expenses.filter((e) => matchExpenseToGoalTag(e, tagToMatch));
    const total = matching.reduce((sum, e) => sum + e.amount, 0);
    return {
      count: matching.length,
      total,
      sampleMerchant: matching[0]?.merchant || null,
    };
  }, [goalTag, goalName, expenses]);

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
      setGoalTag('');
      setIsTagUserEdited(false);
      setExpandedGoalId(null);
      setFormError(null);
      setAiError(null);
      setAiAppliedNotice(null);

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

  const handleOpenAddGoal = (
    defaultName = '',
    defaultTag = '',
    defaultTarget = '',
    defaultCat: ExpenseCategory = 'Travel',
    defaultNotes = ''
  ) => {
    setEditingGoalId(null);
    setGoalName(defaultName);
    setGoalTag(defaultTag || defaultName);
    setIsTagUserEdited(Boolean(defaultTag));
    setGoalTargetAmount(defaultTarget);
    setGoalCurrentAmount('0');
    setGoalCategory(defaultCat);
    setGoalTargetDate('');
    setGoalNotes(defaultNotes);
    setFormError(null);
    setIsGoalFormOpen(true);
  };

  const handleOpenEditGoal = (goal: SavingsGoal) => {
    setEditingGoalId(goal.id);
    setGoalName(goal.name);
    setGoalTag(goal.tag || goal.name);
    setIsTagUserEdited(true);
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
    const chosenTag = (goalTag.trim() || goalName.trim()).replace(/^#/, '');

    if (editingGoalId) {
      setSavingsGoals((prev) =>
        prev.map((g) =>
          g.id === editingGoalId
            ? {
                ...g,
                name: goalName.trim(),
                tag: chosenTag,
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
        tag: chosenTag,
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
    setGoalTag('');
    setIsTagUserEdited(false);
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

  const handleRunAiAnalysis = async (overrideStrategy?: OptimizationStrategy) => {
    setIsAiLoading(true);
    setAiError(null);
    setAiAppliedNotice(null);

    const draftCatBudgets: Partial<Record<ExpenseCategory, number>> = {};
    CATEGORIES.forEach((cat) => {
      const raw = categoryBudgets[cat];
      if (raw && !isNaN(parseFloat(raw))) {
        draftCatBudgets[cat] = Math.max(0, parseFloat(raw));
      }
    });

    // Include live goal savings progress so AI knows real-time goal cushion
    const enrichedGoals = savingsGoals.map((g) => {
      const progress = calculateGoalSavings(g, expenses);
      return {
        ...g,
        currentAmount: progress.totalAmount,
      };
    });

    try {
      const res = await fetch('/api/budget-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenses,
          budgetSettings: {
            monthlyBudget: numericMonthlyBudget || budgetSettings.monthlyBudget,
            dailyTarget: autoDailyTarget ? computedAutoDaily : parseFloat(customDailyTarget) || budgetSettings.dailyTarget,
            autoDailyTarget,
            currency,
            categoryBudgets: draftCatBudgets,
            savingsGoals: enrichedGoals,
          },
          strategy: overrideStrategy || aiStrategy,
          customFocus: aiCustomFocus.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to generate AI budget recommendations.');
      }

      setAiPlan(data as AiBudgetPlan);
      const initialSelection: Record<string, boolean> = {};
      (data.categorySuggestions || []).forEach((s: AiCategorySuggestion) => {
        initialSelection[s.category] = true;
      });
      setSelectedAiCategories(initialSelection);
    } catch (err: any) {
      setAiError(err?.message || 'Failed to reach AI Budgeting Assistant.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleApplySingleAiCap = (cat: ExpenseCategory, suggestedCap: number) => {
    setCategoryBudgets((prev) => ({
      ...prev,
      [cat]: String(suggestedCap),
    }));
    setAiAppliedNotice(`Applied ${currencySymbol}${suggestedCap} cap to ${cat}. Review or save when ready.`);
  };

  const handleApplySelectedAiCaps = (saveImmediately: boolean = false) => {
    if (!aiPlan) return;

    const nextCategoryDraft = { ...categoryBudgets };
    let appliedCount = 0;

    aiPlan.categorySuggestions.forEach((item) => {
      if (selectedAiCategories[item.category]) {
        nextCategoryDraft[item.category] = String(item.suggestedCap);
        appliedCount++;
      }
    });

    const nextMonthlyStr =
      applyRecommendedOverall && aiPlan.recommendedMonthlyBudget > 0
        ? String(aiPlan.recommendedMonthlyBudget)
        : monthlyBudget;

    setCategoryBudgets(nextCategoryDraft);
    if (applyRecommendedOverall && aiPlan.recommendedMonthlyBudget > 0) {
      setMonthlyBudget(nextMonthlyStr);
    }

    if (saveImmediately) {
      const finalMonthly = Math.max(0, parseFloat(nextMonthlyStr) || 0);
      const finalDaily = autoDailyTarget
        ? Math.round((finalMonthly / 31) * 100) / 100
        : Math.max(0, parseFloat(customDailyTarget) || 0);

      const parsedCatBudgets: Partial<Record<ExpenseCategory, number>> = {};
      CATEGORIES.forEach((cat) => {
        const raw = nextCategoryDraft[cat];
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
      return;
    }

    setAiAppliedNotice(
      `Applied ${appliedCount} category ${appliedCount === 1 ? 'cap' : 'caps'}${
        applyRecommendedOverall ? ` & ${currencySymbol}${aiPlan.recommendedMonthlyBudget} monthly limit` : ''
      } to your draft settings.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs transition-colors">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
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
              Configure spending targets, category limits, savings goals, and AI-optimized caps
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
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40 px-4 sm:px-6 pt-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('budget');
              setIsGoalFormOpen(false);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
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
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
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

          <button
            type="button"
            onClick={() => {
              setActiveTab('assistant');
              setIsGoalFormOpen(false);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'assistant'
                ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>AI Budget Coach</span>
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('assistant');
                      if (!aiPlan && !isAiLoading) {
                        handleRunAiAnalysis();
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Optimize with AI</span>
                  </button>
                  <span className="text-[11px] text-slate-500">Monthly limits</span>
                </div>
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
            {/* Context Explainer Banner */}
            <div className="bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3.5 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <Target className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Tag-Driven Savings Targets</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold">
                    Auto-Tracked
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  Set specific financial milestones (e.g. <strong>Emergency Fund</strong>, <strong>Vacation</strong>).
                  Transactions tagged with matching labels (like <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">#Emergency Fund</span> or <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">#Vacation</span>) automatically advance the progress bars in real time, combined with any base allocations.
                </p>
              </div>
            </div>

            {/* Quick Starter Templates */}
            {!isGoalFormOpen && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-thin">
                <span className="text-[11px] font-medium text-slate-500 shrink-0">Quick Templates:</span>
                <button
                  type="button"
                  onClick={() =>
                    handleOpenAddGoal(
                      'Emergency Fund',
                      'Emergency Fund',
                      '5000',
                      'Housing',
                      '3-6 months essential buffer fund'
                    )
                  }
                  className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-700 dark:text-slate-300 transition-colors shrink-0 flex items-center gap-1 font-medium shadow-2xs"
                >
                  <Plus className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Emergency Fund ($5,000)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleOpenAddGoal(
                      'Vacation',
                      'Vacation',
                      '3000',
                      'Travel',
                      'Summer trip & travel savings'
                    )
                  }
                  className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-700 dark:text-slate-300 transition-colors shrink-0 flex items-center gap-1 font-medium shadow-2xs"
                >
                  <Plus className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Vacation ($3,000)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleOpenAddGoal(
                      'Workspace Upgrade',
                      'Tech Setup',
                      '1500',
                      'Shopping',
                      'New ergonomic desk & hardware'
                    )
                  }
                  className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-700 dark:text-slate-300 transition-colors shrink-0 flex items-center gap-1 font-medium shadow-2xs"
                >
                  <Plus className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Tech Setup ($1,500)</span>
                </button>
              </div>
            )}

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
                      placeholder="e.g. Emergency Fund, Vacation, Down Payment"
                      value={goalName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGoalName(val);
                        if (!isTagUserEdited) {
                          setGoalTag(val);
                        }
                      }}
                      required
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Tracking Tag */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Tracking Tag *
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Links transactions with this tag to this goal
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs">
                        #
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. Emergency Fund, Vacation, Tech Setup"
                        value={goalTag.replace(/^#/, '')}
                        onChange={(e) => {
                          setIsTagUserEdited(true);
                          setGoalTag(e.target.value.replace(/^#/, ''));
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-7 pr-3 py-2 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Suggested Tag Chips */}
                    {suggestedTags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Tag className="w-2.5 h-2.5" /> Suggestions:
                        </span>
                        {suggestedTags.slice(0, 8).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              setIsTagUserEdited(true);
                              setGoalTag(st);
                            }}
                            className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors border border-transparent hover:border-emerald-400/30"
                          >
                            #{st}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Live Match Preview */}
                    <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <span className="font-semibold text-emerald-950 dark:text-emerald-200">
                            {liveMatching.count > 0
                              ? `${liveMatching.count} transaction${liveMatching.count === 1 ? '' : 's'} identified in ledger`
                              : 'No ledger transactions currently match this tag'}
                          </span>
                          <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 block">
                            {liveMatching.count > 0
                              ? `Identified ${formatCurrency(liveMatching.total, currency)} in savings (e.g. "${liveMatching.sampleMerchant}")`
                              : `Add #${goalTag.trim() || goalName.trim() || 'tag'} to any expense to track it automatically`}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        +{formatCurrency(liveMatching.total, currency)}
                      </span>
                    </div>
                  </div>

                  {/* Target Amount */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Goal Amount *
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

                  {/* Base Saved Amount (Manual deposit / starting balance) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Base / Starting Balance
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
                    <p className="text-[10px] text-slate-500 mt-1">
                      Direct cash allocations, added to tagged transaction savings
                    </p>
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
                      Links goal with monthly budget category tracking
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
                      placeholder="e.g. Save from monthly freelance checks; keep in high-yield account"
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
                    <span>{editingGoalId ? 'Update Goal' : 'Save Goal'}</span>
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
                    Define targets and track progress via transaction tags and manual deposits
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenAddGoal()}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>New Goal</span>
                </button>
              </div>
            )}

            {/* List of Goals */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {savingsGoals.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <PiggyBank className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    No savings goals established yet
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    Create long-term targets like emergency funds or vacation savings, and track your progress with transaction tags.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenAddGoal('Emergency Fund', 'Emergency Fund', '5000', 'Housing')}
                    className="mt-3 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create an Emergency Fund goal now</span>
                  </button>
                </div>
              ) : (
                savingsGoals.map((goal) => {
                  const savings = calculateGoalSavings(goal, expenses);
                  const isDone = savings.isCompleted;
                  const colors = CATEGORY_COLORS[goal.category];
                  const isExpanded = expandedGoalId === goal.id;
                  const activeTag = goal.tag || goal.name;

                  return (
                    <div
                      key={goal.id}
                      className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {goal.name}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                              <Tag className="w-2.5 h-2.5" />
                              #{activeTag}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors?.bg || 'bg-slate-100'} ${colors?.text || 'text-slate-700'} ${colors?.border || 'border-slate-300'}`}
                            >
                              {goal.category}
                            </span>
                          </div>

                          {goal.notes && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
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
                          <div>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                              {formatCurrency(savings.totalAmount, currency)}
                            </span>
                            <span className="text-slate-500 font-normal"> / {formatCurrency(goal.targetAmount, currency)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isDone && (
                              <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                <Check className="w-3 h-3 stroke-[3]" /> Target Met
                              </span>
                            )}
                            <span className={`text-xs font-bold ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                              {savings.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Dynamic Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isDone ? 'bg-emerald-500' : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(100, savings.percentage)}%`,
                              backgroundColor: colors?.bar || undefined,
                            }}
                          />
                        </div>

                        {/* Savings Breakdown: Tagged vs Base */}
                        <div className="mt-1.5 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-emerald-700 dark:text-emerald-400 font-mono font-medium">
                              {formatCurrency(savings.taggedAmount, currency)}
                            </span>
                            <span>identified from {savings.matchingExpenses.length} tagged transaction{savings.matchingExpenses.length === 1 ? '' : 's'}</span>
                            {savings.baseAmount > 0 && (
                              <span className="text-slate-400">
                                (+{formatCurrency(savings.baseAmount, currency)} manual base)
                              </span>
                            )}
                          </div>

                          {savings.matchingExpenses.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                              className="text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 font-medium ml-auto"
                            >
                              <span>{isExpanded ? 'Hide' : 'Inspect'} transactions</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Transaction Drawer */}
                      {isExpanded && savings.matchingExpenses.length > 0 && (
                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 max-h-44 overflow-y-auto">
                          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                            <span>Tagged Ledger Transactions (#{activeTag})</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                              Subtotal: {formatCurrency(savings.taggedAmount, currency)}
                            </span>
                          </div>
                          {savings.matchingExpenses.map((exp) => (
                            <div
                              key={exp.id}
                              className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-medium text-slate-900 dark:text-white truncate">
                                  {exp.merchant}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                  <span>{exp.date}</span>
                                  <span>&bull;</span>
                                  <span>{exp.paymentMethod}</span>
                                  <span>&bull;</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    {exp.tags?.join(', ')}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0 font-mono font-bold text-slate-900 dark:text-white">
                                {formatCurrency(exp.amount, currency)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Quick Add Deposits & Target Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px]">
                        <div className="text-slate-500 flex items-center gap-1 font-mono">
                          {goal.targetDate ? (
                            <>
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>Target: {goal.targetDate}</span>
                            </>
                          ) : (
                            <span>
                              {formatCurrency(Math.max(0, goal.targetAmount - savings.totalAmount), currency)} remaining to goal
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 mr-0.5">Quick deposit:</span>
                          {[50, 100, 250].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => handleQuickAddSavings(goal.id, amt)}
                              className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-2xs"
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
                {savingsGoals.length} {savingsGoals.length === 1 ? 'goal' : 'goals'} configured
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

        {/* Tab 3: AI Budget Coach */}
        {activeTab === 'assistant' && (
          <div className="p-6 space-y-4 overflow-y-auto">
            {/* Strategy & Context Header */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      AI Category Cap & Goal Optimizer
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Audits {expenses.length} historical transactions across {distinctMonthsCount || 1}{' '}
                      {distinctMonthsCount === 1 ? 'month' : 'months'} &bull; {savingsGoals.length} active{' '}
                      {savingsGoals.length === 1 ? 'goal' : 'goals'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRunAiAnalysis()}
                  disabled={isAiLoading}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5 shrink-0"
                >
                  {isAiLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing History...</span>
                    </>
                  ) : aiPlan ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Re-analyze Caps</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Analyze & Suggest Caps</span>
                    </>
                  )}
                </button>
              </div>

              {/* Optimization Strategy Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: 'balanced',
                      label: 'Balanced Optimization',
                      desc: 'Realistic trims (8–15%) on discretionary spend',
                    },
                    {
                      id: 'aggressive-savings',
                      label: 'Accelerate Goals',
                      desc: 'Maximize monthly surplus toward savings goals',
                    },
                    {
                      id: 'realistic-baseline',
                      label: 'Realistic Baseline',
                      desc: 'Align caps tightly to historical run-rates',
                    },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setAiStrategy(mode.id)}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      aiStrategy === mode.id
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`text-[11px] font-bold ${
                        aiStrategy === mode.id
                          ? 'text-emerald-800 dark:text-emerald-300'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {mode.label}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                      {mode.desc}
                    </div>
                  </button>
                ))}
              </div>

              {/* Optional Custom Focus Prompt */}
              <div>
                <input
                  type="text"
                  value={aiCustomFocus}
                  onChange={(e) => setAiCustomFocus(e.target.value)}
                  placeholder="Optional focus (e.g. Prioritize Emergency Fund, keep Groceries at $600, trim Dining)"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Error State */}
            {aiError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">AI Assistant Unavailable</div>
                  <p className="mt-0.5 leading-relaxed">{aiError}</p>
                </div>
              </div>
            )}

            {/* Applied Confirmation Notice */}
            {aiAppliedNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{aiAppliedNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('budget')}
                  className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0 flex items-center gap-0.5"
                >
                  <span>Review Caps</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Empty / Initial Prompt State */}
            {!aiPlan && !isAiLoading && !aiError && (
              <div className="p-7 text-center bg-slate-50/70 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                <Sliders className="w-7 h-7 text-emerald-500 mx-auto opacity-80" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Ready to optimize your monthly category limits
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Click <strong>Analyze &amp; Suggest Caps</strong> to inspect your historical category averages, recurring obligations, and active savings goals for tailored monthly limits.
                </p>
              </div>
            )}

            {/* Loading Skeleton */}
            {isAiLoading && (
              <div className="p-8 text-center bg-slate-50/70 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Evaluating multi-month spending velocity &amp; goal timelines...
                </p>
                <p className="text-[11px] text-slate-500">
                  Calibrating realistic category caps in {currency}
                </p>
              </div>
            )}

            {/* AI Plan Output */}
            {aiPlan && !isAiLoading && (
              <div className="space-y-4">
                {/* Summary KPI & Rationale Card */}
                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/25 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Suggested Monthly Cap</span>
                      <span className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(aiPlan.recommendedMonthlyBudget, currency)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Current: {formatCurrency(numericMonthlyBudget, currency)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Est. Monthly Surplus</span>
                      <span className="text-base font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                        {aiPlan.projectedMonthlySavings > 0 ? '+' : ''}
                        {formatCurrency(aiPlan.projectedMonthlySavings, currency)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">Toward financial goals</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Categories Tuned</span>
                      <span className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {aiPlan.categorySuggestions.length}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        From {aiPlan.analyzedTransactionsCount} transactions
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {aiPlan.summary}
                  </p>

                  {aiPlan.goalAlignmentNote && (
                    <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-emerald-500/20 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2">
                      <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{aiPlan.goalAlignmentNote}</span>
                    </div>
                  )}

                  {aiPlan.keyInsights.length > 0 && (
                    <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400 pl-1">
                      {aiPlan.keyInsights.map((ins, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <span>{ins}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Category-by-Category Suggested Caps */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">
                      Recommended Category Monthly Caps
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyRecommendedOverall}
                        onChange={(e) => setApplyRecommendedOverall(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        Also update overall monthly budget ({formatCurrency(aiPlan.recommendedMonthlyBudget, currency)})
                      </span>
                    </label>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {aiPlan.categorySuggestions.map((item) => {
                      const isChecked = !!selectedAiCategories[item.category];
                      const currentDraftVal = parseFloat(categoryBudgets[item.category] || '');
                      const isAlreadyApplied = !isNaN(currentDraftVal) && currentDraftVal === item.suggestedCap;
                      const catColor = CATEGORY_COLORS[item.category]?.bar || '#10b981';

                      const priorityBadge =
                        item.priority === 'essential'
                          ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          : item.priority === 'cutback'
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          : item.priority === 'optimize'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300';

                      return (
                        <div
                          key={item.category}
                          className={`p-3 rounded-xl border transition-colors ${
                            isChecked
                              ? 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800'
                              : 'bg-slate-50/40 dark:bg-slate-950/20 border-slate-200/50 dark:border-slate-800/40 opacity-65'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) =>
                                  setSelectedAiCategories((prev) => ({
                                    ...prev,
                                    [item.category]: e.target.checked,
                                  }))
                                }
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: catColor }}
                              />
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {item.category}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${priorityBadge}`}
                              >
                                {item.priority}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
                              <div className="text-slate-500">
                                Avg:{' '}
                                <span className="text-slate-700 dark:text-slate-300 font-semibold">
                                  {formatCurrency(item.historicalMonthlyAvg, currency)}
                                </span>
                              </div>
                              <div className="text-slate-500">
                                Cap:{' '}
                                <span className="text-slate-700 dark:text-slate-300">
                                  {item.currentCap !== null
                                    ? formatCurrency(item.currentCap, currency)
                                    : 'None'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                                  {formatCurrency(item.suggestedCap, currency)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleApplySingleAiCap(item.category, item.suggestedCap)}
                                className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold border transition-colors ${
                                  isAlreadyApplied
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                                }`}
                              >
                                {isAlreadyApplied ? 'Applied' : 'Apply'}
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 pl-6 leading-snug">
                            {item.rationale}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => handleApplySelectedAiCaps(false)}
                      className="px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors"
                    >
                      Apply to Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplySelectedAiCaps(true)}
                      className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Apply &amp; Save All</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
