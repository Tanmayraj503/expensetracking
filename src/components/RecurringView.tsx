import React, { useState } from 'react';
import {
  Repeat,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  CreditCard,
  Tag as TagIcon,
  X,
  Check,
} from 'lucide-react';
import { RecurringRule, ExpenseCategory, PaymentMethod, BudgetSettings, RecurrenceFrequency } from '../types';
import { CATEGORIES, PAYMENT_METHODS, CATEGORY_COLORS } from '../data/sampleExpenses';
import { formatCurrency, formatFullDate, formatDateLabel } from '../utils/formatters';
import { getUpcomingDueDate } from '../utils/recurring';

interface RecurringViewProps {
  recurringRules: RecurringRule[];
  onSaveRule: (rule: Omit<RecurringRule, 'id' | 'createdAt'>, existingId?: string) => void;
  onDeleteRule: (id: string) => void;
  onToggleActive: (id: string) => void;
  onTriggerGenerate: () => void;
  budgetSettings: BudgetSettings;
  availableTags: string[];
}

export const RecurringView: React.FC<RecurringViewProps> = ({
  recurringRules,
  onSaveRule,
  onDeleteRule,
  onToggleActive,
  onTriggerGenerate,
  budgetSettings,
  availableTags,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);

  // Form State
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Housing');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [startDate, setStartDate] = useState('2026-10-01');
  const [endDate, setEndDate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currency = budgetSettings.currency;

  const handleOpenAdd = () => {
    setEditingRule(null);
    setMerchant('');
    setAmount('');
    setCategory('Housing');
    setPaymentMethod('Bank Transfer');
    setFrequency('monthly');
    setStartDate('2026-10-01');
    setEndDate('');
    setTags(['Personal']);
    setTagInput('');
    setNotes('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rule: RecurringRule) => {
    setEditingRule(rule);
    setMerchant(rule.merchant);
    setAmount(rule.amount.toString());
    setCategory(rule.category);
    setPaymentMethod(rule.paymentMethod);
    setFrequency(rule.frequency);
    setStartDate(rule.startDate);
    setEndDate(rule.endDate || '');
    setTags(rule.tags ? [...rule.tags] : []);
    setTagInput('');
    setNotes(rule.notes || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!merchant.trim()) {
      setError('Please enter a merchant name.');
      return;
    }
    if (!startDate) {
      setError('Please select a starting date.');
      return;
    }

    onSaveRule(
      {
        merchant: merchant.trim(),
        amount: Math.round(parsedAmount * 100) / 100,
        category,
        paymentMethod,
        frequency,
        startDate,
        endDate: endDate ? endDate : undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined,
        isActive: editingRule ? editingRule.isActive : true,
        lastGeneratedDate: editingRule?.lastGeneratedDate,
      },
      editingRule ? editingRule.id : undefined
    );

    setIsModalOpen(false);
  };

  // Calculations
  const activeRules = recurringRules.filter((r) => r.isActive);
  const totalMonthlyCommitment = activeRules.reduce((sum, r) => {
    if (r.frequency === 'monthly') return sum + r.amount;
    if (r.frequency === 'weekly') return sum + r.amount * 4.33;
    if (r.frequency === 'daily') return sum + r.amount * 30;
    return sum;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Trigger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
              <Repeat className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Recurring Schedules Engine
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Define daily, weekly, or monthly repeating expenses that automatically generate in your ledger
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTriggerGenerate}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs"
            title="Scan active rules and generate entries due up to today"
          >
            <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 fill-emerald-600 dark:fill-emerald-400" />
            <span>Generate Due Now</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Recurring Rule</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Repeating Rules</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white my-2">
            {activeRules.length}{' '}
            <span className="text-xs font-normal text-slate-500">
              of {recurringRules.length} rules
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Automating recurring overheads
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Monthly Committed Baseline</div>
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 my-2">
            {formatCurrency(totalMonthlyCommitment, currency)}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            ~{((totalMonthlyCommitment / budgetSettings.monthlyBudget) * 100).toFixed(0)}% of monthly budget
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Auto-Generation Status</div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white my-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Up to Date</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Missing occurrences automatically checked on load
          </div>
        </div>
      </div>

      {/* List of Recurring Rules */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition-colors">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Active & Paused Repeating Rules ({recurringRules.length})
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Repeats daily, weekly, or monthly
          </span>
        </div>

        {recurringRules.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {recurringRules.map((rule) => {
              const catColor = CATEGORY_COLORS[rule.category] || { text: 'text-slate-500 dark:text-slate-400' };
              const nextDue = getUpcomingDueDate(rule);

              return (
                <div
                  key={rule.id}
                  className={`p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    rule.isActive ? 'hover:bg-slate-50 dark:hover:bg-slate-800/30' : 'opacity-60 bg-slate-50/50 dark:bg-slate-950/20'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                      <Repeat className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                          {rule.merchant}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                          {rule.frequency}
                        </span>
                        {!rule.isActive && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                            (Paused)
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className={`${catColor.text} font-medium`}>
                          {rule.category}
                        </span>
                        <span>·</span>
                        <span>{rule.paymentMethod}</span>
                        <span>·</span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          Next: {formatDateLabel(nextDue)} ({nextDue})
                        </span>
                      </div>

                      {/* Tags */}
                      {rule.tags && rule.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {rule.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/70 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700/60"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {rule.notes && (
                        <p className="text-[11px] text-slate-500 italic truncate">
                          "{rule.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side: Amount & Controls */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800/60">
                    <div className="text-right">
                      <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(rule.amount, currency)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        per {rule.frequency === 'daily' ? 'day' : rule.frequency === 'weekly' ? 'week' : 'month'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Active/Pause toggle */}
                      <button
                        type="button"
                        onClick={() => onToggleActive(rule.id)}
                        className={`p-1.5 rounded transition-colors ${
                          rule.isActive
                            ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={rule.isActive ? 'Pause rule' : 'Resume rule'}
                      >
                        {rule.isActive ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(rule)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Edit Rule"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => onDeleteRule(rule.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-10 text-center text-xs text-slate-500">
            No recurring rules defined yet. Create a recurring rule above to automate repeated expenses.
          </div>
        )}
      </div>

      {/* Add / Edit Recurring Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs transition-colors">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors"
            role="dialog"
            aria-modal="true"
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingRule ? 'Edit Recurring Schedule' : 'Create Recurring Schedule'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto">
              {error && (
                <div className="p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg">
                  {error}
                </div>
              )}

              {/* Amount & Frequency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Amount ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 capitalize transition-colors"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              {/* Merchant */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Merchant / Payee
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rent, Fiber Internet, Gym Membership"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Category & Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start & End Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="Ongoing"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Tags Section */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tags & Labels
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type tag (e.g. Work, Personal, Project X) and press enter"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Add
                  </button>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 px-2 py-0.5 rounded"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="hover:text-emerald-900 dark:hover:text-white ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly rent check auto-debit"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save Schedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
