import React, { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  DollarSign,
  Clock,
  CreditCard,
  Repeat,
  Coffee,
  Utensils,
  Bus,
  ShoppingBag,
  CupSoda,
  Car,
  Zap,
  Check,
  RotateCcw,
  Tag,
  X,
} from 'lucide-react';
import { Expense, BudgetSettings, DaySummary, FrequentExpensePreset, ExpenseCategory, PaymentMethod } from '../types';
import {
  formatCurrency,
  formatDateLabel,
  formatFullDate,
  calculateDailySummaries,
  getDaysInMonth,
} from '../utils/formatters';
import { CATEGORIES, CATEGORY_COLORS, PAYMENT_METHODS } from '../data/sampleExpenses';
import { loadFrequentExpenses, saveFrequentExpenses, DEFAULT_FREQUENT_EXPENSES } from '../utils/storage';

interface DailyTrackerProps {
  expenses: Expense[];
  selectedYearMonth: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  budgetSettings: BudgetSettings;
  onAddExpenseForDate: (date: string) => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onQuickLogExpense?: (expense: Omit<Expense, 'id'>) => void;
}

export const DailyTracker: React.FC<DailyTrackerProps> = ({
  expenses,
  selectedYearMonth,
  selectedDate,
  onSelectDate,
  budgetSettings,
  onAddExpenseForDate,
  onEditExpense,
  onDeleteExpense,
  onQuickLogExpense,
}) => {
  const [hoveredDay, setHoveredDay] = useState<DaySummary | null>(null);
  const [frequentPresets, setFrequentPresets] = useState<FrequentExpensePreset[]>(() => loadFrequentExpenses());
  const [justLoggedId, setJustLoggedId] = useState<string | null>(null);
  const [isAddPresetModalOpen, setIsAddPresetModalOpen] = useState(false);

  // New Preset form state
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetAmount, setNewPresetAmount] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState<ExpenseCategory>('Dining & Drinks');
  const [newPresetPaymentMethod, setNewPresetPaymentMethod] = useState<PaymentMethod>('Credit Card');
  const [newPresetTags, setNewPresetTags] = useState('Personal');
  const [newPresetIcon, setNewPresetIcon] = useState<'Coffee' | 'Utensils' | 'Bus' | 'ShoppingBag' | 'CupSoda' | 'Car' | 'Zap'>('Coffee');

  const handleQuickLog = (preset: FrequentExpensePreset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMins = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHours}:${currentMins}`;

    if (onQuickLogExpense) {
      onQuickLogExpense({
        amount: preset.amount,
        merchant: preset.name,
        date: selectedDate,
        time: currentTime,
        category: preset.category,
        paymentMethod: preset.paymentMethod,
        tags: preset.tags,
        notes: preset.notes,
        isRecurring: false,
      });
    }

    setJustLoggedId(preset.id);
    setTimeout(() => {
      setJustLoggedId(null);
    }, 1400);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = frequentPresets.filter((p) => p.id !== id);
    setFrequentPresets(updated);
    saveFrequentExpenses(updated);
  };

  const handleResetPresets = () => {
    setFrequentPresets(DEFAULT_FREQUENT_EXPENSES);
    saveFrequentExpenses(DEFAULT_FREQUENT_EXPENSES);
  };

  const handleSaveNewPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(newPresetAmount);
    if (isNaN(parsed) || parsed <= 0 || !newPresetName.trim()) return;

    const parsedTags = newPresetTags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const newPreset: FrequentExpensePreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: newPresetName.trim(),
      amount: Math.round(parsed * 100) / 100,
      category: newPresetCategory,
      paymentMethod: newPresetPaymentMethod,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      iconName: newPresetIcon,
    };

    const updated = [...frequentPresets, newPreset];
    setFrequentPresets(updated);
    saveFrequentExpenses(updated);

    setIsAddPresetModalOpen(false);
    setNewPresetName('');
    setNewPresetAmount('');
    setNewPresetTags('Personal');
  };

  const renderPresetIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Coffee':
        return <Coffee className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'Utensils':
        return <Utensils className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      case 'Bus':
        return <Bus className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
      case 'ShoppingBag':
        return <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'CupSoda':
        return <CupSoda className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'Car':
        return <Car className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'Zap':
        return <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Coffee className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  const getPresetIconBg = (iconName?: string) => {
    switch (iconName) {
      case 'Coffee':
        return 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60';
      case 'Utensils':
        return 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800/60';
      case 'Bus':
        return 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800/60';
      case 'ShoppingBag':
        return 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60';
      case 'CupSoda':
        return 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800/60';
      case 'Car':
        return 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800/60';
      default:
        return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
    }
  };

  const dailyTarget = budgetSettings.dailyTarget;
  const currency = budgetSettings.currency;

  const dailySummaries = calculateDailySummaries(expenses, selectedYearMonth, dailyTarget);
  const maxDaySpend = Math.max(
    dailyTarget * 1.5,
    ...dailySummaries.map((d) => d.total)
  );

  // Selected day's data
  const selectedDaySummary = dailySummaries.find((d) => d.date === selectedDate) || {
    date: selectedDate,
    dayOfMonth: parseInt(selectedDate.split('-')[2] || '1', 10),
    total: 0,
    count: 0,
    isToday: selectedDate === '2026-10-29',
    isPastOrToday: true,
    isFuture: false,
    isOverTarget: false,
  };

  const selectedDayExpenses = expenses
    .filter((e) => e.date === selectedDate)
    .sort((a, b) => b.time.localeCompare(a.time));

  // Current today metrics
  const todayDateStr = '2026-10-29';
  const todaySummary = dailySummaries.find((d) => d.date === todayDateStr);
  const todayTotal = todaySummary ? todaySummary.total : 0;
  const todayRemaining = dailyTarget - todayTotal;

  // Month-to-date average
  const pastDaysWithSpend = dailySummaries.filter((d) => d.isPastOrToday);
  const totalMonthSpentSoFar = pastDaysWithSpend.reduce((sum, d) => sum + d.total, 0);
  const daysElapsed = Math.max(1, pastDaysWithSpend.length);
  const dailyAverageThisMonth = totalMonthSpentSoFar / daysElapsed;

  // Zero-spend days
  const zeroSpendDaysCount = pastDaysWithSpend.filter((d) => d.total === 0).length;

  // Peak spend day
  const peakDay = [...dailySummaries]
    .filter((d) => d.isPastOrToday)
    .sort((a, b) => b.total - a.total)[0];

  // Navigation handlers for selected day
  const handlePrevDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    currentDate.setDate(currentDate.getDate() - 1);
    const prevDateStr = `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    if (prevDateStr.startsWith(selectedYearMonth)) {
      onSelectDate(prevDateStr);
    }
  };

  const handleNextDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    currentDate.setDate(currentDate.getDate() + 1);
    const nextDateStr = `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    if (nextDateStr.startsWith(selectedYearMonth)) {
      onSelectDate(nextDateStr);
    }
  };

  // SVG Chart Dimensions
  const chartHeight = 180;
  const targetY = chartHeight - (dailyTarget / maxDaySpend) * chartHeight;

  return (
    <div className="space-y-6">
      {/* 4-Item Daily KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today's Spend */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Today's Spend</span>
            <span>{formatDateLabel(todayDateStr)}</span>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
              {formatCurrency(todayTotal, currency)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span>Target:</span>
              <span className="font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">
                {formatCurrency(dailyTarget, currency)}/day
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            {todayRemaining >= 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {formatCurrency(todayRemaining, currency)} buffer remaining
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 font-mono tabular-nums flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {formatCurrency(Math.abs(todayRemaining), currency)} over target
              </span>
            )}
          </div>
        </div>

        {/* KPI 2: Daily Run Rate / Average */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Daily Average (MTD)</span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
              {formatCurrency(dailyAverageThisMonth, currency)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Across {daysElapsed} active {daysElapsed === 1 ? 'day' : 'days'}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {dailyAverageThisMonth <= dailyTarget ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {(dailyTarget - dailyAverageThisMonth).toFixed(2)} under daily pace
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {(dailyAverageThisMonth - dailyTarget).toFixed(2)} above daily pace
              </span>
            )}
          </div>
        </div>

        {/* KPI 3: Peak Spend Day */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Peak Spend Day</span>
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {peakDay ? `Day ${peakDay.dayOfMonth}` : '—'}
            </span>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
              {peakDay ? formatCurrency(peakDay.total, currency) : '$0.00'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {peakDay && peakDay.total > 0
                ? `${peakDay.count} transactions logged`
                : 'No expenses recorded'}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 truncate">
            {peakDay ? formatDateLabel(peakDay.date) : '—'}
          </div>
        </div>

        {/* KPI 4: Zero-Spend Discipline */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">No-Spend Days</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
              {zeroSpendDaysCount} <span className="text-sm font-normal text-slate-500">days</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Zero expenditure recorded
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {((zeroSpendDaysCount / daysElapsed) * 100).toFixed(0)}% of days disciplined
          </div>
        </div>
      </div>

      {/* Frequent Expenses Quick-Log Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shrink-0">
              <Zap className="w-4 h-4 fill-emerald-600/20 dark:fill-emerald-400/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Frequent Expenses
                </h3>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded font-semibold">
                  1-Click Log
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Quickly record common daily purchases onto{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDateLabel(selectedDate)}
                </span>{' '}
                ({selectedDaySummary.isToday ? 'Today' : selectedDate})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {frequentPresets.length !== DEFAULT_FREQUENT_EXPENSES.length && (
              <button
                type="button"
                onClick={handleResetPresets}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1 rounded transition-colors"
                title="Restore default presets"
              >
                Reset Defaults
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsAddPresetModalOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Preset</span>
            </button>
          </div>
        </div>

        {/* Preset Cards Grid */}
        {frequentPresets.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            {frequentPresets.map((preset) => {
              const isLogged = justLoggedId === preset.id;
              const iconBg = getPresetIconBg(preset.iconName);

              return (
                <div
                  key={preset.id}
                  className="group relative flex flex-col justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 hover:bg-white dark:hover:bg-slate-800/70 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 hover:shadow-sm transition-all"
                >
                  {/* Delete button on hover */}
                  <button
                    type="button"
                    onClick={(e) => handleDeletePreset(preset.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    title={`Remove "${preset.name}" preset`}
                    aria-label={`Remove "${preset.name}" preset`}
                  >
                    <X className="w-3 h-3" />
                  </button>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-lg border ${iconBg} shrink-0`}>
                        {renderPresetIcon(preset.iconName)}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate" title={preset.name}>
                        {preset.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {preset.category}
                        {preset.tags && preset.tags.length > 0 && ` · #${preset.tags[0]}`}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-1">
                    <div className="font-mono tabular-nums font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {formatCurrency(preset.amount, currency)}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleQuickLog(preset, e)}
                      disabled={isLogged}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 shadow-2xs ${
                        isLogged
                          ? 'bg-emerald-600 text-white animate-pulse'
                          : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 hover:shadow-xs active:scale-95'
                      }`}
                      title={`Quick-log ${preset.name} (${formatCurrency(preset.amount, currency)})`}
                    >
                      {isLogged ? (
                        <>
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Logged!</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3 stroke-[2.5]" />
                          <span>Log</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            <span>No frequent expense presets available.</span>
            <button
              type="button"
              onClick={handleResetPresets}
              className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Restore default presets
            </button>
          </div>
        )}
      </div>

      {/* Interactive 31-Day Spend Bar Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Daily Spend Trajectory
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any bar to inspect date details and log expenses
            </p>
          </div>

          {/* Legend & Target Marker */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="w-3 h-0.5 border-t border-dashed border-emerald-500"></span>
              <span>Target: <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(dailyTarget, currency)}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/80"></span>
              <span>Over target</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 dark:bg-slate-700"></span>
              <span>Within budget</span>
            </div>
          </div>
        </div>

        {/* Hover Tooltip Overlay (when hovering a bar) */}
        <div className="h-6 mt-2 flex items-center text-xs">
          {hoveredDay ? (
            <div className="text-slate-700 dark:text-slate-300 flex items-center gap-2 font-mono tabular-nums">
              <span className="text-slate-900 dark:text-white font-semibold">
                {formatFullDate(hoveredDay.date)}:
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {formatCurrency(hoveredDay.total, currency)}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 dark:text-slate-400">
                {hoveredDay.count} {hoveredDay.count === 1 ? 'transaction' : 'transactions'}
              </span>
              {hoveredDay.isOverTarget && (
                <span className="text-rose-600 dark:text-rose-400 ml-1 font-semibold">
                  (+{formatCurrency(hoveredDay.total - dailyTarget, currency)} over target)
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-500 text-xs">
              Hover over a day to view totals · Target line shows daily spend ceiling
            </span>
          )}
        </div>

        {/* Chart Viewport */}
        <div className="relative mt-3 overflow-x-auto pb-2">
          <div className="min-w-[640px]">
            {/* SVG Graphic */}
            <div className="relative h-[180px] w-full">
              {/* Daily Target Dashed Line */}
              {targetY >= 0 && targetY <= chartHeight && (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-emerald-500/60 pointer-events-none z-10"
                  style={{ top: `${targetY}px` }}
                >
                  <span className="absolute -top-4 right-0 text-[10px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400 bg-white/90 dark:bg-slate-900/90 px-1 rounded border border-emerald-200 dark:border-emerald-800">
                    target {formatCurrency(dailyTarget, currency)}
                  </span>
                </div>
              )}

              {/* Bars container */}
              <div className="h-full flex items-end gap-1 sm:gap-1.5">
                {dailySummaries.map((day) => {
                  const barHeightPercent = maxDaySpend > 0
                    ? Math.max(day.total > 0 ? 6 : 0, (day.total / maxDaySpend) * 100)
                    : 0;

                  const isSelected = day.date === selectedDate;

                  // Bar color logic
                  let barBg = 'bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-600';
                  if (day.isOverTarget) {
                    barBg = 'bg-rose-500/85 hover:bg-rose-500';
                  } else if (day.isToday) {
                    barBg = 'bg-emerald-500 hover:bg-emerald-400';
                  } else if (day.total > 0) {
                    barBg = 'bg-teal-600 hover:bg-teal-500';
                  } else if (day.isFuture) {
                    barBg = 'bg-slate-100 dark:bg-slate-800/20';
                  }

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => onSelectDate(day.date)}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`flex-1 flex flex-col items-center justify-end h-full group focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 rounded-t transition-all ${
                        isSelected ? 'ring-2 ring-emerald-500 bg-slate-100/60 dark:bg-slate-800/40' : ''
                      }`}
                    >
                      <div
                        className={`w-full rounded-t-sm transition-all ${barBg} ${
                          isSelected ? 'shadow-sm' : ''
                        }`}
                        style={{ height: `${barHeightPercent}%` }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* X-Axis Day Numbers */}
            <div className="flex gap-1 sm:gap-1.5 mt-2 border-t border-slate-100 dark:border-slate-800 pt-2 text-[10px] font-mono text-slate-500 select-none">
              {dailySummaries.map((day) => {
                const isSelected = day.date === selectedDate;
                const isToday = day.isToday;
                return (
                  <div
                    key={`lbl-${day.date}`}
                    onClick={() => onSelectDate(day.date)}
                    className={`flex-1 text-center cursor-pointer hover:text-slate-900 dark:hover:text-slate-300 transition-colors ${
                      isSelected
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                        : isToday
                        ? 'text-slate-900 dark:text-white font-semibold underline underline-offset-2'
                        : ''
                    }`}
                  >
                    {day.dayOfMonth}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Day Detail Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {/* Selected Day Header & Controls */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={handlePrevDay}
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextDay}
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {formatFullDate(selectedDate)}
                </h3>
                {selectedDaySummary.isToday && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                    (Today)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {selectedDayExpenses.length}{' '}
                {selectedDayExpenses.length === 1 ? 'expense' : 'expenses'} logged
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">Day Total</div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-950 dark:text-white">
                {formatCurrency(selectedDaySummary.total, currency)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onAddExpenseForDate(selectedDate)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add on this day</span>
            </button>
          </div>
        </div>

        {/* Selected Day Transaction Rows */}
        {selectedDayExpenses.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {selectedDayExpenses.map((expense) => {
              const catColor = CATEGORY_COLORS[expense.category] || {
                bg: 'bg-slate-100 dark:bg-slate-800/40',
                text: 'text-slate-700 dark:text-slate-400',
                border: 'border-slate-300 dark:border-slate-700',
              };

              return (
                <div
                  key={expense.id}
                  className="p-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white truncate text-sm">
                          {expense.merchant}
                        </span>
                        {expense.isRecurring && (
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700 font-mono capitalize">
                            {expense.recurrenceFrequency || 'recurring'}
                          </span>
                        )}
                        {expense.isAutoGenerated && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                            (Auto)
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className={`${catColor.text} font-medium`}>
                          {expense.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{expense.paymentMethod}</span>
                        {expense.time && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{expense.time}</span>
                          </>
                        )}
                      </div>

                      {/* Tags */}
                      {expense.tags && expense.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {expense.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/70 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700/60"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {expense.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic truncate">
                          "{expense.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/60">
                    <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-950 dark:text-white">
                      {formatCurrency(expense.amount, currency)}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Edit Expense"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(expense.id)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No expenses on this day
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Zero dollars spent on {formatFullDate(selectedDate)}. Keep up the discipline or log an expense below.
            </p>
            <button
              type="button"
              onClick={() => onAddExpenseForDate(selectedDate)}
              className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Expense for {formatDateLabel(selectedDate)}</span>
            </button>
          </div>
        )}
      </div>

      {/* Add Custom Frequent Preset Modal */}
      {isAddPresetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative"
            role="dialog"
            aria-modal="true"
            aria-labelledby="frequent-preset-title"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="frequent-preset-title" className="text-base font-semibold text-slate-900 dark:text-white">
                    New Frequent Preset
                  </h3>
                  <p className="text-xs text-slate-500">Quick-log repeated everyday transactions in 1 tap</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPresetModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPreset} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Preset Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Morning Espresso, Afternoon Boba, Subway Pass"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount ({currency}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={newPresetAmount}
                    onChange={(e) => setNewPresetAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Icon
                  </label>
                  <div className="flex items-center gap-1.5 pt-1">
                    {(['Coffee', 'Utensils', 'Bus', 'ShoppingBag', 'CupSoda', 'Car', 'Zap'] as const).map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setNewPresetIcon(ic)}
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                          newPresetIcon === ic
                            ? 'bg-emerald-500 text-white shadow-xs ring-2 ring-emerald-500/40'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                        title={ic}
                      >
                        {renderPresetIcon(ic)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newPresetCategory}
                    onChange={(e) => setNewPresetCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="Dining & Drinks">Dining & Drinks</option>
                    <option value="Groceries">Groceries</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Housing & Utilities">Housing & Utilities</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Travel">Travel</option>
                    <option value="Education">Education</option>
                    <option value="Personal Care">Personal Care</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={newPresetPaymentMethod}
                    onChange={(e) => setNewPresetPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  >
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Mobile Payment">Mobile Payment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Tags (comma separated)
                </label>
                <div className="relative">
                  <Tag className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Personal, Work, Routine"
                    value={newPresetTags}
                    onChange={(e) => setNewPresetTags(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddPresetModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Preset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
