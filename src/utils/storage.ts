import { Expense, BudgetSettings, RecurringRule, FrequentExpensePreset } from '../types';
import { SAMPLE_EXPENSES, DEFAULT_BUDGET_SETTINGS } from '../data/sampleExpenses';

const EXPENSES_STORAGE_KEY = 'ledgerpulse_expenses_v1';
const BUDGET_STORAGE_KEY = 'ledgerpulse_budget_settings_v1';
const RECURRING_RULES_STORAGE_KEY = 'ledgerpulse_recurring_rules_v1';
const FREQUENT_EXPENSES_STORAGE_KEY = 'ledgerpulse_frequent_expenses_v1';

export const DEFAULT_FREQUENT_EXPENSES: FrequentExpensePreset[] = [
  {
    id: 'freq-coffee',
    name: 'Morning Coffee',
    amount: 4.75,
    category: 'Dining & Drinks',
    paymentMethod: 'Credit Card',
    tags: ['Personal'],
    notes: 'Artisan roast / espresso',
    iconName: 'Coffee',
  },
  {
    id: 'freq-lunch',
    name: 'Quick Lunch',
    amount: 14.50,
    category: 'Dining & Drinks',
    paymentMethod: 'Credit Card',
    tags: ['Personal', 'Work'],
    notes: 'Midday bowl or salad combo',
    iconName: 'Utensils',
  },
  {
    id: 'freq-transit',
    name: 'Metro / Transit',
    amount: 2.90,
    category: 'Transportation',
    paymentMethod: 'Digital Wallet',
    tags: ['Work', 'Commute'],
    notes: 'Subway tap-and-go fare',
    iconName: 'Bus',
  },
  {
    id: 'freq-groceries',
    name: 'Grocery Grab',
    amount: 24.50,
    category: 'Groceries',
    paymentMethod: 'Debit Card',
    tags: ['Essential'],
    notes: 'Fresh produce & daily essentials',
    iconName: 'ShoppingBag',
  },
  {
    id: 'freq-snack',
    name: 'Snack & Fuel',
    amount: 5.50,
    category: 'Dining & Drinks',
    paymentMethod: 'Credit Card',
    tags: ['Personal'],
    notes: 'Cold brew & protein snack',
    iconName: 'CupSoda',
  },
  {
    id: 'freq-rideshare',
    name: 'Rideshare Trip',
    amount: 18.25,
    category: 'Transportation',
    paymentMethod: 'Credit Card',
    tags: ['Travel'],
    notes: 'Short commute or city hop',
    iconName: 'Car',
  },
];

export const INITIAL_RECURRING_RULES: RecurringRule[] = [
  {
    id: 'rule-rent',
    merchant: 'Highland Park Lofts Rent',
    amount: 1450.00,
    category: 'Housing',
    paymentMethod: 'Bank Transfer',
    frequency: 'monthly',
    startDate: '2026-08-01',
    tags: ['Personal', 'Essential'],
    notes: 'Monthly apartment lease',
    isActive: true,
    lastGeneratedDate: '2026-10-01',
    createdAt: '2026-08-01T08:00:00Z',
  },
  {
    id: 'rule-fiber',
    merchant: 'Fiber Internet Service',
    amount: 72.00,
    category: 'Utilities',
    paymentMethod: 'Credit Card',
    frequency: 'monthly',
    startDate: '2026-08-14',
    tags: ['Work', 'Essential'],
    notes: 'High-speed home office broadband',
    isActive: true,
    lastGeneratedDate: '2026-10-14',
    createdAt: '2026-08-14T09:00:00Z',
  },
  {
    id: 'rule-spotify',
    merchant: 'Spotify & Cloud Backup',
    amount: 19.99,
    category: 'Subscriptions',
    paymentMethod: 'Credit Card',
    frequency: 'monthly',
    startDate: '2026-08-26',
    tags: ['Personal'],
    notes: 'Cloud storage and streaming',
    isActive: true,
    lastGeneratedDate: '2026-10-26',
    createdAt: '2026-08-26T10:00:00Z',
  },
  {
    id: 'rule-transit',
    merchant: 'Metro Transit Card Refill',
    amount: 15.00,
    category: 'Transportation',
    paymentMethod: 'Digital Wallet',
    frequency: 'weekly',
    startDate: '2026-10-07',
    tags: ['Work', 'Commute'],
    notes: 'Weekly transit commute pass',
    isActive: true,
    lastGeneratedDate: '2026-10-28',
    createdAt: '2026-10-07T09:00:00Z',
  },
];

export function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!raw) {
      saveExpenses(SAMPLE_EXPENSES);
      return SAMPLE_EXPENSES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return SAMPLE_EXPENSES;
  } catch (err) {
    console.error('Failed to load expenses from localStorage, fallback to sample data', err);
    return SAMPLE_EXPENSES;
  }
}

export function saveExpenses(expenses: Expense[]): void {
  try {
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
  } catch (err) {
    console.error('Failed to save expenses to localStorage', err);
  }
}

export function loadRecurringRules(): RecurringRule[] {
  try {
    const raw = localStorage.getItem(RECURRING_RULES_STORAGE_KEY);
    if (!raw) {
      saveRecurringRules(INITIAL_RECURRING_RULES);
      return INITIAL_RECURRING_RULES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return INITIAL_RECURRING_RULES;
  } catch (err) {
    console.error('Failed to load recurring rules from localStorage', err);
    return INITIAL_RECURRING_RULES;
  }
}

export function saveRecurringRules(rules: RecurringRule[]): void {
  try {
    localStorage.setItem(RECURRING_RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch (err) {
    console.error('Failed to save recurring rules to localStorage', err);
  }
}

export function loadBudgetSettings(): BudgetSettings {
  try {
    const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (!raw) {
      saveBudgetSettings(DEFAULT_BUDGET_SETTINGS);
      return DEFAULT_BUDGET_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_BUDGET_SETTINGS,
      ...parsed,
    };
  } catch (err) {
    console.error('Failed to load budget settings, fallback to default', err);
    return DEFAULT_BUDGET_SETTINGS;
  }
}

export function saveBudgetSettings(settings: BudgetSettings): void {
  try {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save budget settings', err);
  }
}

export function loadFrequentExpenses(): FrequentExpensePreset[] {
  try {
    const raw = localStorage.getItem(FREQUENT_EXPENSES_STORAGE_KEY);
    if (!raw) {
      saveFrequentExpenses(DEFAULT_FREQUENT_EXPENSES);
      return DEFAULT_FREQUENT_EXPENSES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_FREQUENT_EXPENSES;
  } catch (err) {
    console.error('Failed to load frequent expenses, fallback to defaults', err);
    return DEFAULT_FREQUENT_EXPENSES;
  }
}

export function saveFrequentExpenses(presets: FrequentExpensePreset[]): void {
  try {
    localStorage.setItem(FREQUENT_EXPENSES_STORAGE_KEY, JSON.stringify(presets));
  } catch (err) {
    console.error('Failed to save frequent expenses', err);
  }
}

export function exportToCsv(expenses: Expense[], currency: string = 'USD'): void {
  const headers = ['ID', 'Date', 'Time', 'Merchant', 'Category', 'Amount', 'Currency', 'Payment Method', 'Notes', 'Recurring', 'Frequency', 'Tags'];
  const rows = expenses.map((e) => [
    `"${e.id}"`,
    `"${e.date}"`,
    `"${e.time}"`,
    `"${(e.merchant || '').replace(/"/g, '""')}"`,
    `"${e.category}"`,
    e.amount.toFixed(2),
    `"${currency}"`,
    `"${e.paymentMethod}"`,
    `"${(e.notes || '').replace(/"/g, '""')}"`,
    e.isRecurring ? 'Yes' : 'No',
    `"${e.recurrenceFrequency || 'one-time'}"`,
    `"${(e.tags || []).join(';')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ledgerpulse-expenses-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToJson(expenses: Expense[], settings: BudgetSettings, recurringRules: RecurringRule[] = []): void {
  const data = {
    version: '1.1',
    exportDate: new Date().toISOString(),
    budgetSettings: settings,
    recurringRules,
    expenses,
  };
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ledgerpulse-backup-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
