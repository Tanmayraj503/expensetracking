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
  Link2,
  Unlink,
  Repeat,
} from 'lucide-react';
import {
  BudgetSettings,
  ExpenseCategory,
  SavingsGoal,
  Expense,
  RecurringRule,
  RecurrenceFrequency,
  PaymentMethod,
} from '../types';
import { CATEGORIES, CATEGORY_COLORS, PAYMENT_METHODS } from '../data/sampleExpenses';
import {
  CURRENCY_SYMBOLS,
  formatCurrency,
  formatMonthYear,
  calculateGoalSavings,
  calculateGoalBudgetMetrics,
  matchExpenseToGoalTag,
  getRecurringMonthlyEquivalent,
} from '../utils/formatters';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgetSettings: BudgetSettings;
  onSaveSettings: (newSettings: BudgetSettings) => void;
  initialTab?: 'budget' | 'goals' | 'assistant';
  expenses?: Expense[];
  selectedYearMonth?: string;
  recurringRules?: RecurringRule[];
  onSaveRecurringRule?: (
    ruleData: Omit<RecurringRule, 'id' | 'createdAt'>,
    existingId?: string
  ) => RecurringRule | void;
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
  selectedYearMonth = '2026-10',
  recurringRules = [],
  onSaveRecurringRule,
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
  const [goalMonthlyContribution, setGoalMonthlyContribution] = useState('150');
  const [goalLinkedToBudget, setGoalLinkedToBudget] = useState(true);
  const [goalRecurringMode, setGoalRecurringMode] = useState<'none' | 'existing' | 'create'>('none');
  const [goalRecurringRuleId, setGoalRecurringRuleId] = useState<string>('');
  const [newRuleMerchant, setNewRuleMerchant] = useState<string>('');
  const [newRuleAmount, setNewRuleAmount] = useState<string>('150');
  const [newRuleFrequency, setNewRuleFrequency] = useState<RecurrenceFrequency>('monthly');
  const [newRuleStartDate, setNewRuleStartDate] = useState<string>('2026-10-29');
  const [newRulePaymentMethod, setNewRulePaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [editingInlineCapGoalId, setEditingInlineCapGoalId] = useState<string | null>(null);
  const [inlineCapValue, setInlineCapValue] = useState('');

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
      setGoalMonthlyContribution('150');
      setGoalLinkedToBudget(true);
      setGoalRecurringMode('none');
      setGoalRecurringRuleId('');
      setNewRuleMerchant('');
      setNewRuleAmount('150');
      setNewRuleFrequency('monthly');
      setNewRuleStartDate('2026-10-29');
      setNewRulePaymentMethod('Bank Transfer');
      setExpandedGoalId(null);
      setEditingInlineCapGoalId(null);
      setInlineCapValue('');
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

  const draftCategoryBudgetsNumeric = React.useMemo(() => {
    const parsed: Partial<Record<ExpenseCategory, number>> = {};
    CATEGORIES.forEach((cat) => {
      const raw = categoryBudgets[cat];
      if (raw && !isNaN(parseFloat(raw))) {
        parsed[cat] = Math.max(0, parseFloat(raw));
      }
    });
    return parsed;
  }, [categoryBudgets]);

  const monthExpenses = React.useMemo(
    () => expenses.filter((e) => e.date.startsWith(selectedYearMonth)),
    [expenses, selectedYearMonth]
  );

  const monthTotalSpent = React.useMemo(
    () => monthExpenses.reduce((sum, e) => sum + e.amount, 0),
    [monthExpenses]
  );

  const monthCategorySpendMap = React.useMemo(() => {
    const map: Partial<Record<ExpenseCategory, { spent: number; count: number }>> = {};
    monthExpenses.forEach((exp) => {
      const prev = map[exp.category] || { spent: 0, count: 0 };
      map[exp.category] = {
        spent: Math.round((prev.spent + exp.amount) * 100) / 100,
        count: prev.count + 1,
      };
    });
    return map;
  }, [monthExpenses]);

  const categoryCapsSummary = React.useMemo(() => {
    let totalAllocated = 0;
    let cappedCount = 0;
    let overCapCount = 0;

    CATEGORIES.forEach((cat) => {
      const cap = draftCategoryBudgetsNumeric[cat];
      if (cap !== undefined) {
        cappedCount += 1;
        totalAllocated += cap;
        const spent = monthCategorySpendMap[cat]?.spent || 0;
        if (spent > cap + 0.005) {
          overCapCount += 1;
        }
      }
    });

    return {
      totalAllocated: Math.round(totalAllocated * 100) / 100,
      cappedCount,
      overCapCount,
    };
  }, [draftCategoryBudgetsNumeric, monthCategorySpendMap]);

  const portfolioMetrics = React.useMemo(() => {
    let totalSaved = 0;
    let totalTarget = 0;
    let totalLinkedMonthly = 0;
    let linkedCount = 0;
    let completedCount = 0;

    savingsGoals.forEach((goal) => {
      const sav = calculateGoalSavings(goal, expenses);
      const bMetrics = calculateGoalBudgetMetrics(
        goal,
        expenses,
        draftCategoryBudgetsNumeric,
        selectedYearMonth
      );
      totalSaved += sav.totalAmount;
      totalTarget += goal.targetAmount;
      if (sav.isCompleted) completedCount += 1;
      if (bMetrics.linkedToBudget) {
        linkedCount += 1;
        totalLinkedMonthly += bMetrics.monthlyContribution;
      }
    });

    const pct = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;
    return {
      totalSaved,
      totalTarget,
      totalLinkedMonthly,
      linkedCount,
      completedCount,
      overallPercentage: pct,
    };
  }, [savingsGoals, expenses, draftCategoryBudgetsNumeric, selectedYearMonth]);

  if (!isOpen) return null;

  const currencySymbol = CURRENCY_SYMBOLS[currency] || '$';
  const numericMonthlyBudget = parseFloat(monthlyBudget) || 0;
  const computedAutoDaily = Math.round((numericMonthlyBudget / 31) * 100) / 100;
  const netSpendableAfterGoals = Math.max(0, numericMonthlyBudget - portfolioMetrics.totalLinkedMonthly);
  const monthBudgetHeadroom = Math.max(0, numericMonthlyBudget - monthTotalSpent);
  const unallocatedMonthlyBudget = Math.round((numericMonthlyBudget - categoryCapsSummary.totalAllocated) * 100) / 100;

  const handleCategoryBudgetChange = (cat: ExpenseCategory, val: string) => {
    setCategoryBudgets((prev) => ({
      ...prev,
      [cat]: val,
    }));
  };

  const handleClearAllCategoryCaps = () => {
    setCategoryBudgets({});
  };

  const handleOpenAddGoal = (
    defaultName = '',
    defaultTag = '',
    defaultTarget = '',
    defaultCat: ExpenseCategory = 'Travel',
    defaultNotes = '',
    defaultMonthly = '150'
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
    setGoalMonthlyContribution(defaultMonthly);
    setGoalLinkedToBudget(true);
    setGoalRecurringMode('none');
    setGoalRecurringRuleId('');
    setNewRuleMerchant(defaultName ? `${defaultName} Auto-Save` : '');
    setNewRuleAmount(defaultMonthly || '150');
    setNewRuleFrequency('monthly');
    setNewRuleStartDate('2026-10-29');
    setNewRulePaymentMethod('Bank Transfer');
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
    setGoalMonthlyContribution(
      goal.monthlyContribution !== undefined ? goal.monthlyContribution.toString() : '150'
    );
    setGoalLinkedToBudget(goal.linkedToBudget !== false);
    const hasLinkedRule = Boolean(
      goal.recurringRuleId && recurringRules.some((r) => r.id === goal.recurringRuleId)
    );
    setGoalRecurringMode(hasLinkedRule ? 'existing' : 'none');
    setGoalRecurringRuleId(hasLinkedRule ? goal.recurringRuleId || '' : '');
    setNewRuleMerchant(`${goal.name} Auto-Save`);
    setNewRuleAmount(
      goal.monthlyContribution !== undefined ? goal.monthlyContribution.toString() : '150'
    );
    setNewRuleFrequency('monthly');
    setNewRuleStartDate('2026-10-29');
    setNewRulePaymentMethod('Bank Transfer');
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
          const next = Math.max(0, Math.round((g.currentAmount + delta) * 100) / 100);
          return { ...g, currentAmount: next };
        }
        return g;
      })
    );
  };

  const handleToggleGoalBudgetLink = (goalId: string) => {
    setSavingsGoals((prev) =>
      prev.map((g) => {
        if (g.id === goalId) {
          const currentlyLinked = g.linkedToBudget !== false;
          return {
            ...g,
            linkedToBudget: !currentlyLinked,
          };
        }
        return g;
      })
    );
  };

  const handleSaveInlineCategoryCap = (cat: ExpenseCategory) => {
    const trimmed = inlineCapValue.trim();
    if (trimmed === '') {
      handleCategoryBudgetChange(cat, '');
    } else {
      const num = parseFloat(trimmed);
      if (!isNaN(num) && num >= 0) {
        handleCategoryBudgetChange(cat, String(Math.round(num * 100) / 100));
      }
    }
    setEditingInlineCapGoalId(null);
    setInlineCapValue('');
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
    let monthlyContrib = Math.max(0, parseFloat(goalMonthlyContribution) || 0);
    const chosenTag = (goalTag.trim() || goalName.trim()).replace(/^#/, '');

    let resolvedRecurringRuleId: string | undefined = undefined;
    if (goalRecurringMode === 'existing') {
      if (!goalRecurringRuleId) {
        setFormError('Select an existing recurring rule or choose None');
        return;
      }
      resolvedRecurringRuleId = goalRecurringRuleId;
      const matchedRule = recurringRules.find((r) => r.id === goalRecurringRuleId);
      if (matchedRule && monthlyContrib === 0) {
        monthlyContrib = getRecurringMonthlyEquivalent(matchedRule);
      }
    } else if (goalRecurringMode === 'create') {
      const ruleAmt = parseFloat(newRuleAmount);
      if (isNaN(ruleAmt) || ruleAmt <= 0) {
        setFormError('Recurring contribution amount must be greater than zero');
        return;
      }
      const ruleLabel = newRuleMerchant.trim() || `${goalName.trim()} Auto-Save`;
      if (onSaveRecurringRule) {
        const createdRule = onSaveRecurringRule({
          merchant: ruleLabel,
          amount: Math.round(ruleAmt * 100) / 100,
          category: goalCategory,
          paymentMethod: newRulePaymentMethod,
          frequency: newRuleFrequency,
          startDate: newRuleStartDate || '2026-10-29',
          tags: [chosenTag],
          notes: `Automated contribution for ${goalName.trim()}`,
          isActive: true,
        });
        if (createdRule && createdRule.id) {
          resolvedRecurringRuleId = createdRule.id;
          monthlyContrib = getRecurringMonthlyEquivalent(createdRule);
        }
      }
    }

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
                monthlyContribution: monthlyContrib,
                linkedToBudget: goalLinkedToBudget,
                recurringRuleId: resolvedRecurringRuleId,
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
        monthlyContribution: monthlyContrib,
        linkedToBudget: goalLinkedToBudget,
        recurringRuleId: resolvedRecurringRuleId,
      };
      setSavingsGoals((prev) => [...prev, newGoal]);
    }

    setIsGoalFormOpen(false);
    setEditingGoalId(null);
    setGoalTag('');
    setIsTagUserEdited(false);
    setGoalRecurringMode('none');
    setGoalRecurringRuleId('');
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
              {portfolioMetrics.linkedCount > 0 && portfolioMetrics.totalLinkedMonthly > 0 && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Link2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(portfolioMetrics.totalLinkedMonthly, currency)}/mo
                      </strong>{' '}
                      reserved across {portfolioMetrics.linkedCount} linked{' '}
                      {portfolioMetrics.linkedCount === 1 ? 'goal' : 'goals'} &middot; Net spendable:{' '}
                      <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(netSpendableAfterGoals, currency)}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('goals')}
                    className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
                  >
                    Manage goals &rarr;
                  </button>
                </div>
              )}
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

            {/* Category Spending Limits */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Category Spending Limits (Optional)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Compare against {formatMonthYear(selectedYearMonth)} spend &middot; tracked in Insights
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {categoryCapsSummary.cappedCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllCategoryCaps}
                      className="px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
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
                </div>
              </div>

              {/* Allocation Summary vs Monthly Budget */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="text-slate-600 dark:text-slate-400">
                  <span className="font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(categoryCapsSummary.totalAllocated, currency)}
                  </span>{' '}
                  allocated across {categoryCapsSummary.cappedCount} of {CATEGORIES.length} categories
                  {categoryCapsSummary.overCapCount > 0 && (
                    <span className="text-rose-600 dark:text-rose-400 font-medium">
                      {' '}
                      &middot; {categoryCapsSummary.overCapCount} over cap
                    </span>
                  )}
                </div>
                <div
                  className={`font-mono tabular-nums font-semibold ${
                    unallocatedMonthlyBudget >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {unallocatedMonthlyBudget >= 0
                    ? `${formatCurrency(unallocatedMonthlyBudget, currency)} unallocated`
                    : `${formatCurrency(Math.abs(unallocatedMonthlyBudget), currency)} over monthly budget`}
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {CATEGORIES.map((cat) => {
                  const linkedGoalsForCat = savingsGoals.filter((g) => g.category === cat);
                  const monthCatData = monthCategorySpendMap[cat] || { spent: 0, count: 0 };
                  const spent = monthCatData.spent;
                  const draftCap = draftCategoryBudgetsNumeric[cat];
                  const hasCap = draftCap !== undefined;
                  const pctUsed = hasCap
                    ? draftCap > 0
                      ? (spent / draftCap) * 100
                      : spent > 0
                      ? 100
                      : 0
                    : 0;
                  const isOver = hasCap && spent > draftCap + 0.005;
                  const isWarning = hasCap && !isOver && pctUsed >= 75;
                  const catBarColor = CATEGORY_COLORS[cat]?.bar || '#10b981';

                  return (
                    <div
                      key={cat}
                      className="p-2.5 rounded-lg bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: catBarColor }}
                            />
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                              {cat}
                            </span>
                            {linkedGoalsForCat.length > 0 && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                                &middot; {linkedGoalsForCat.length}{' '}
                                {linkedGoalsForCat.length === 1 ? 'goal' : 'goals'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 pl-4 mt-0.5">
                            Spent: {formatCurrency(spent, currency)}
                            {hasCap && (
                              <span
                                className={`ml-1.5 font-semibold ${
                                  isOver
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : isWarning
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                &middot; {pctUsed.toFixed(0)}%{' '}
                                {isOver
                                  ? `(${formatCurrency(spent - draftCap!, currency)} over)`
                                  : `(${formatCurrency(Math.max(0, draftCap! - spent), currency)} left)`}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!hasCap && spent > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCategoryBudgetChange(cat, String(Math.ceil(spent / 10) * 10))
                              }
                              title="Suggest limit rounded up from current month spend"
                              className="px-1.5 py-1 text-[10px] font-medium text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors whitespace-nowrap"
                            >
                              Set {currencySymbol}
                              {Math.ceil(spent / 10) * 10}
                            </button>
                          )}
                          <div className="relative w-28">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-mono text-xs">
                              {currencySymbol}
                            </span>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              aria-label={`${cat} monthly spending limit`}
                              placeholder="No limit"
                              value={categoryBudgets[cat] || ''}
                              onChange={(e) => handleCategoryBudgetChange(cat, e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md pl-6 pr-6 py-1 text-xs font-mono tabular-nums text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                            {categoryBudgets[cat] !== undefined && categoryBudgets[cat] !== '' && (
                              <button
                                type="button"
                                onClick={() => handleCategoryBudgetChange(cat, '')}
                                aria-label={`Clear ${cat} limit`}
                                title="Remove category limit"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-rose-500 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {hasCap && (
                        <div className="pl-4">
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isOver
                                  ? 'bg-rose-500'
                                  : isWarning
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{
                                width: `${
                                  spent === 0 ? 0 : Math.min(100, Math.max(2, pctUsed))
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
          <div className="p-6 space-y-4 overflow-y-auto">
            {/* Portfolio & Budget Linkage Summary Bar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Total Saved
                  </span>
                  <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(portfolioMetrics.totalSaved, currency)}
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-slate-500 block">
                    of {formatCurrency(portfolioMetrics.totalTarget, currency)} target
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Linked Monthly Reserve
                  </span>
                  <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(portfolioMetrics.totalLinkedMonthly, currency)}/mo
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {portfolioMetrics.linkedCount} of {savingsGoals.length} goals linked
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {formatMonthYear(selectedYearMonth)} Budget
                  </span>
                  <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(monthBudgetHeadroom, currency)} left
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-slate-500 block">
                    Spent {formatCurrency(monthTotalSpent, currency)} / {formatCurrency(numericMonthlyBudget, currency)}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Net Spendable Cap
                  </span>
                  <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(netSpendableAfterGoals, currency)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    After goal reserves · {portfolioMetrics.completedCount} met
                  </span>
                </div>
              </div>

              {savingsGoals.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums mb-1">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">
                      Combined Portfolio Progress
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {portfolioMetrics.overallPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, portfolioMetrics.overallPercentage)}%` }}
                    />
                  </div>
                </div>
              )}
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
                      '3-6 months essential buffer fund',
                      '250'
                    )
                  }
                  className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-700 dark:text-slate-300 transition-colors shrink-0 flex items-center gap-1 font-medium whitespace-nowrap"
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
                      'Summer trip & travel savings',
                      '150'
                    )
                  }
                  className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-700 dark:text-slate-300 transition-colors shrink-0 flex items-center gap-1 font-medium whitespace-nowrap"
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
                      'New ergonomic desk & hardware',
                      '100'
                    )
                  }
                  className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 text-slate-700 dark:text-slate-300 transition-colors shrink-0 flex items-center gap-1 font-medium whitespace-nowrap"
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
                      Starting / Saved Balance
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
                      Combined automatically with tagged ledger savings
                    </p>
                  </div>

                  {/* Link to Existing Budget Tracking */}
                  <div className="sm:col-span-2 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Link to Monthly Budget Tracking
                        </span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={goalLinkedToBudget}
                          onChange={(e) => setGoalLinkedToBudget(e.target.checked)}
                          className="rounded-xs border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>Reserve in budget</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Linked Budget Category
                        </label>
                        <select
                          value={goalCategory}
                          onChange={(e) => setGoalCategory(e.target.value as ExpenseCategory)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const catCap = draftCategoryBudgetsNumeric[goalCategory];
                          const catSpend = monthExpenses
                            .filter((e) => e.category === goalCategory)
                            .reduce((s, e) => s + e.amount, 0);
                          return (
                            <p className="text-[10px] text-slate-500 mt-1 font-mono tabular-nums">
                              {catCap !== undefined
                                ? `Cap: ${formatCurrency(catCap, currency)}/mo · Spent: ${formatCurrency(catSpend, currency)}`
                                : `No monthly cap set · Spent: ${formatCurrency(catSpend, currency)}`}
                            </p>
                          );
                        })()}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            Monthly Contribution Target
                          </label>
                          {(() => {
                            const tgt = parseFloat(goalTargetAmount) || 0;
                            const cur = parseFloat(goalCurrentAmount) || 0;
                            const rem = Math.max(0, tgt - (cur + liveMatching.total));
                            if (goalTargetDate && /^\d{4}-\d{2}/.test(goalTargetDate) && rem > 0) {
                              const [refY, refM] = selectedYearMonth.split('-').map(Number);
                              const [tY, tM] = goalTargetDate.slice(0, 7).split('-').map(Number);
                              const months = Math.max(1, (tY - refY) * 12 + (tM - refM));
                              const pace = Math.ceil(rem / months);
                              return (
                                <button
                                  type="button"
                                  onClick={() => setGoalMonthlyContribution(String(pace))}
                                  className="text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                                >
                                  Use pace ({currencySymbol}{pace}/mo)
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                            {currencySymbol}
                          </span>
                          <input
                            type="number"
                            step="5"
                            min="0"
                            placeholder="150"
                            value={goalMonthlyContribution}
                            onChange={(e) => setGoalMonthlyContribution(e.target.value)}
                            disabled={!goalLinkedToBudget}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-7 pr-10 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-white disabled:opacity-50 focus:outline-none focus:border-emerald-500"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">
                            /mo
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {goalLinkedToBudget
                            ? 'Reserves this monthly amount against your overall budget'
                            : 'Goal tracked independently of monthly budget cap'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tracking Tag */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Ledger Auto-Tracking Tag *
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Matches tagged transactions automatically
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
                            className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                          >
                            #{st}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Live Match Preview */}
                    <div className="mt-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <span className="font-semibold text-emerald-950 dark:text-emerald-200 block">
                          {liveMatching.count > 0
                            ? `${liveMatching.count} matching ledger ${liveMatching.count === 1 ? 'transaction' : 'transactions'}`
                            : 'No matching ledger transactions yet'}
                        </span>
                        <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 block truncate">
                          {liveMatching.count > 0
                            ? `Auto-credited ${formatCurrency(liveMatching.total, currency)} (e.g. "${liveMatching.sampleMerchant}")`
                            : `Tag expenses with #${goalTag.trim() || goalName.trim() || 'tag'} to auto-credit`}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 tabular-nums shrink-0">
                        +{formatCurrency(liveMatching.total, currency)}
                      </span>
                    </div>
                  </div>

                  {/* Target Date (Deadline) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Savings Deadline (Target Date)
                    </label>
                    <input
                      type="date"
                      value={goalTargetDate}
                      onChange={(e) => setGoalTargetDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Notes / Motivation */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Notes &amp; Strategy (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. High-yield reserve; fund from category surplus"
                      value={goalNotes}
                      onChange={(e) => setGoalNotes(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Link to Recurring Contribution Rule */}
                  <div className="sm:col-span-2 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Repeat className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Recurring Contribution Rule
                        </span>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setGoalRecurringMode('none')}
                          className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                            goalRecurringMode === 'none'
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                          }`}
                        >
                          None
                        </button>
                        <button
                          type="button"
                          onClick={() => setGoalRecurringMode('existing')}
                          disabled={recurringRules.length === 0}
                          className={`px-2 py-0.5 rounded-md font-medium transition-colors disabled:opacity-40 ${
                            goalRecurringMode === 'existing'
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-semibold'
                              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                          }`}
                        >
                          Link Existing ({recurringRules.length})
                        </button>
                        {onSaveRecurringRule && (
                          <button
                            type="button"
                            onClick={() => {
                              setGoalRecurringMode('create');
                              if (!newRuleMerchant.trim()) {
                                setNewRuleMerchant(
                                  goalName.trim() ? `${goalName.trim()} Auto-Save` : 'Goal Auto-Save'
                                );
                              }
                              if (!newRuleAmount || parseFloat(newRuleAmount) <= 0) {
                                setNewRuleAmount(goalMonthlyContribution || '150');
                              }
                            }}
                            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                              goalRecurringMode === 'create'
                                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                            }`}
                          >
                            + New Rule
                          </button>
                        )}
                      </div>
                    </div>

                    {goalRecurringMode === 'existing' && (
                      <div className="space-y-1.5">
                        <select
                          value={goalRecurringRuleId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setGoalRecurringRuleId(id);
                            const found = recurringRules.find((r) => r.id === id);
                            if (found) {
                              setGoalMonthlyContribution(
                                String(getRecurringMonthlyEquivalent(found))
                              );
                            }
                          }}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="">Select a recurring rule to link...</option>
                          {recurringRules.map((rule) => (
                            <option key={rule.id} value={rule.id}>
                              {rule.merchant} · {formatCurrency(rule.amount, currency)}/{rule.frequency}{' '}
                              ({rule.isActive ? 'Active' : 'Paused'})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-500">
                          Generated entries from the linked rule automatically add to this goal&apos;s progress.
                        </p>
                      </div>
                    )}

                    {goalRecurringMode === 'create' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Contribution Rule Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Emergency Fund Auto-Transfer"
                            value={newRuleMerchant}
                            onChange={(e) => setNewRuleMerchant(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Amount per Cycle
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                              {currencySymbol}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="1"
                              value={newRuleAmount}
                              onChange={(e) => setNewRuleAmount(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-6 pr-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Frequency
                          </label>
                          <select
                            value={newRuleFrequency}
                            onChange={(e) =>
                              setNewRuleFrequency(e.target.value as RecurrenceFrequency)
                            }
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="monthly">Monthly</option>
                            <option value="weekly">Weekly</option>
                            <option value="daily">Daily</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={newRuleStartDate}
                            onChange={(e) => setNewRuleStartDate(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Source Account / Method
                          </label>
                          <select
                            value={newRulePaymentMethod}
                            onChange={(e) =>
                              setNewRulePaymentMethod(e.target.value as PaymentMethod)
                            }
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                          >
                            {PAYMENT_METHODS.map((pm) => (
                              <option key={pm} value={pm}>
                                {pm}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {goalRecurringMode === 'none' && (
                      <p className="text-[11px] text-slate-500">
                        Optional: link an automated schedule or create a recurring transfer rule to fund this goal continuously.
                      </p>
                    )}
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
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Long-Term Savings Targets
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Track progress bars, tagged contributions, and monthly budget links
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenAddGoal()}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0"
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
                    Create long-term targets like an emergency fund or vacation reserve, and link them to your monthly budget.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenAddGoal('Emergency Fund', 'Emergency Fund', '5000', 'Housing', 'Essential reserve cushion', '250')}
                    className="mt-3 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create an Emergency Fund goal now</span>
                  </button>
                </div>
              ) : (
                savingsGoals.map((goal) => {
                  const savings = calculateGoalSavings(goal, expenses);
                  const budgetLink = calculateGoalBudgetMetrics(
                    goal,
                    expenses,
                    draftCategoryBudgetsNumeric,
                    selectedYearMonth
                  );
                  const isDone = savings.isCompleted;
                  const colors = CATEGORY_COLORS[goal.category];
                  const isExpanded = expandedGoalId === goal.id;
                  const isEditingCap = editingInlineCapGoalId === goal.id;
                  const activeTag = goal.tag || goal.name;

                  const surplusTransferAmount =
                    !isDone && budgetLink.categoryRemaining !== null && budgetLink.categoryRemaining > 0
                      ? Math.min(budgetLink.categoryRemaining, savings.remainingAmount)
                      : 0;
                  const linkedRule = goal.recurringRuleId
                    ? recurringRules.find((r) => r.id === goal.recurringRuleId)
                    : undefined;

                  return (
                    <div
                      key={goal.id}
                      className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {goal.name}
                          </h5>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            <span>{goal.category}</span>
                            <span aria-hidden="true">&middot;</span>
                            <span className="font-mono text-emerald-700 dark:text-emerald-400">#{activeTag}</span>
                            {goal.targetDate && (
                              <>
                                <span aria-hidden="true">&middot;</span>
                                <span className="font-mono tabular-nums">Deadline {goal.targetDate}</span>
                              </>
                            )}
                          </div>
                          {linkedRule && (
                            <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-indigo-700 dark:text-indigo-300">
                              <Repeat className="w-3 h-3 shrink-0" />
                              <span>
                                {linkedRule.merchant} · {formatCurrency(linkedRule.amount, currency)}/
                                {linkedRule.frequency} ({linkedRule.isActive ? 'Active' : 'Paused'})
                              </span>
                            </div>
                          )}
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
                            onClick={() => handleToggleGoalBudgetLink(goal.id)}
                            className={`px-2 py-1 text-[10px] font-semibold rounded-md border transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                              budgetLink.linkedToBudget
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                            title={
                              budgetLink.linkedToBudget
                                ? 'Linked to monthly budget tracking (click to unlink)'
                                : 'Not linked to monthly budget (click to link)'
                            }
                          >
                            {budgetLink.linkedToBudget ? (
                              <>
                                <Link2 className="w-3 h-3" />
                                <span>Linked</span>
                              </>
                            ) : (
                              <>
                                <Unlink className="w-3 h-3" />
                                <span>Unlinked</span>
                              </>
                            )}
                          </button>
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
                            <span className="text-slate-500 font-normal">
                              {' '}/ {formatCurrency(goal.targetAmount, currency)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isDone ? (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-sans">
                                <Check className="w-3 h-3 stroke-[3]" /> Target Met
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">
                                {formatCurrency(savings.remainingAmount, currency)} left
                              </span>
                            )}
                            <span
                              className={`text-xs font-bold ${
                                isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {savings.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Dynamic Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300 bg-emerald-500"
                            style={{
                              width: `${Math.min(100, savings.percentage)}%`,
                              backgroundColor: colors?.bar || undefined,
                            }}
                          />
                        </div>

                        {/* Savings Breakdown: Tagged vs Base */}
                        <div className="mt-1.5 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-emerald-700 dark:text-emerald-400 font-mono tabular-nums font-medium">
                              {formatCurrency(savings.taggedAmount, currency)}
                            </span>
                            <span>
                              from {savings.matchingExpenses.length} tagged{' '}
                              {savings.matchingExpenses.length === 1 ? 'entry' : 'entries'}
                            </span>
                            {savings.baseAmount > 0 && (
                              <span className="text-slate-400 font-mono tabular-nums">
                                (+{formatCurrency(savings.baseAmount, currency)} saved balance)
                              </span>
                            )}
                          </div>

                          {savings.matchingExpenses.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                              className="text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 font-medium ml-auto"
                            >
                              <span>{isExpanded ? 'Hide' : 'Inspect'} entries</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Linked Budget Tracking Strip */}
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                          {isEditingCap ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-sans text-[11px]">{goal.category} cap:</span>
                              <input
                                type="number"
                                min="0"
                                step="10"
                                value={inlineCapValue}
                                onChange={(e) => setInlineCapValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveInlineCategoryCap(goal.category);
                                  } else if (e.key === 'Escape') {
                                    setEditingInlineCapGoalId(null);
                                  }
                                }}
                                placeholder="500"
                                autoFocus
                                className="w-20 bg-white dark:bg-slate-900 border border-emerald-500 rounded px-1.5 py-0.5 text-[11px] text-slate-900 dark:text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveInlineCategoryCap(goal.category)}
                                className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-sans font-semibold text-[10px]"
                              >
                                Set
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingInlineCapGoalId(null)}
                                className="text-slate-400 hover:text-slate-600 font-sans text-[10px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : budgetLink.categoryCap !== undefined ? (
                            <span>
                              {goal.category} cap {formatCurrency(budgetLink.categoryCap, currency)} &middot; Spent{' '}
                              {formatCurrency(budgetLink.categoryMonthSpend, currency)} (
                              <span
                                className={
                                  (budgetLink.categoryRemaining || 0) >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                    : 'text-rose-600 dark:text-rose-400 font-semibold'
                                }
                              >
                                {(budgetLink.categoryRemaining || 0) >= 0
                                  ? `${formatCurrency(budgetLink.categoryRemaining || 0, currency)} headroom`
                                  : `${formatCurrency(Math.abs(budgetLink.categoryRemaining || 0), currency)} over`}
                              </span>
                              )
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingInlineCapGoalId(goal.id);
                                  setInlineCapValue(String(budgetLink.categoryCap ?? ''));
                                }}
                                className="ml-1.5 font-sans text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline"
                              >
                                Edit cap
                              </button>
                            </span>
                          ) : (
                            <span className="font-sans">
                              No {goal.category} monthly cap{' '}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingInlineCapGoalId(goal.id);
                                  setInlineCapValue('');
                                }}
                                className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                              >
                                + Set cap
                              </button>
                            </span>
                          )}

                          {budgetLink.linkedToBudget && budgetLink.monthlyContribution > 0 && (
                            <>
                              <span aria-hidden="true">&middot;</span>
                              <span className="text-slate-700 dark:text-slate-300">
                                {formatCurrency(budgetLink.monthlyContribution, currency)}/mo reserved
                              </span>
                            </>
                          )}

                          {budgetLink.requiredMonthlyPace !== null && !isDone && (
                            <>
                              <span aria-hidden="true">&middot;</span>
                              <span
                                className={
                                  budgetLink.isOnPace
                                    ? 'text-emerald-600 dark:text-emerald-400 font-sans'
                                    : 'text-amber-600 dark:text-amber-400 font-sans'
                                }
                              >
                                {budgetLink.isOnPace
                                  ? 'On pace for target'
                                  : `Pace needs ${formatCurrency(budgetLink.requiredMonthlyPace, currency)}/mo`}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Quick Deposits & Fund from Category Surplus */}
                        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                          {surplusTransferAmount >= 10 && (
                            <button
                              type="button"
                              onClick={() => handleQuickAddSavings(goal.id, surplusTransferAmount)}
                              className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors whitespace-nowrap"
                              title={`Allocate available ${goal.category} monthly budget headroom into this goal`}
                            >
                              + Fund {formatCurrency(surplusTransferAmount, currency)} surplus
                            </button>
                          )}
                          {[50, 100, 250].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => handleQuickAddSavings(goal.id, amt)}
                              className="px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-medium rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            >
                              +{currencySymbol}{amt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Expandable Transaction Drawer */}
                      {isExpanded && savings.matchingExpenses.length > 0 && (
                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 max-h-44 overflow-y-auto">
                          <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                            <span>Tagged Ledger Entries (#{activeTag})</span>
                            <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
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
                                  <span>&middot;</span>
                                  <span>{exp.paymentMethod}</span>
                                  <span>&middot;</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    {exp.tags?.join(', ')}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0 font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                                {formatCurrency(exp.amount, currency)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Bottom Save Action */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {savingsGoals.length} {savingsGoals.length === 1 ? 'goal' : 'goals'} &middot;{' '}
                {portfolioMetrics.linkedCount} linked to budget
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
                  <span>Save All Settings &amp; Goals</span>
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
