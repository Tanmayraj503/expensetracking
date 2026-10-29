import React, { useState } from 'react';
import { X, Check, DollarSign, Calculator, HelpCircle } from 'lucide-react';
import { BudgetSettings, ExpenseCategory } from '../types';
import { CATEGORIES } from '../data/sampleExpenses';
import { CURRENCY_SYMBOLS } from '../utils/formatters';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgetSettings: BudgetSettings;
  onSaveSettings: (newSettings: BudgetSettings) => void;
}

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD'];

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  budgetSettings,
  onSaveSettings,
}) => {
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
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
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs transition-colors">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Budget & Spending Targets
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Set your monthly spend limit, daily run-rate targets, and category caps
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

        {/* Modal Form */}
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
              <span>Save Budget Targets</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
