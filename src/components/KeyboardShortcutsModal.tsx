import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Quick Actions',
    items: [
      { keys: ['N'], description: 'Add a new expense' },
      { keys: ['/'], description: 'Focus global search bar' },
      { keys: ['Ctrl', 'K'], description: 'Focus global search (anywhere)' },
      { keys: ['B'], description: 'Open budget & savings goals' },
      { keys: ['E'], description: 'Export spending report (PDF)' },
      { keys: ['T'], description: 'Toggle dark / light theme' },
    ],
  },
  {
    title: 'Navigation & Layout',
    items: [
      { keys: ['1'], description: 'Switch to Daily Spend view' },
      { keys: ['2'], description: 'Switch to Monthly Tracking view' },
      { keys: ['3'], description: 'Switch to Expense Ledger view' },
      { keys: ['4'], description: 'Switch to Recurring Schedules' },
      { keys: ['5'], description: 'Switch to AI Insights' },
      { keys: ['['], description: 'Collapse / expand sidebar' },
    ],
  },
  {
    title: 'General',
    items: [
      { keys: ['?'], description: 'Show or hide this shortcuts guide' },
      { keys: ['Esc'], description: 'Close active modal or clear focus' },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-xs transition-colors"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh] transition-colors"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="shortcuts-modal-title"
                className="text-sm font-bold text-slate-900 dark:text-white"
              >
                Keyboard Shortcuts
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Power-user shortcuts active across LedgerPulse views
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close shortcuts guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {group.title}
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/60 dark:bg-slate-950/50">
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-4 text-xs"
                  >
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, idx) => (
                        <React.Fragment key={k}>
                          {idx > 0 && (
                            <span className="text-[10px] text-slate-400">+</span>
                          )}
                          <kbd className="min-w-6 px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded shadow-2xs">
                            {k === 'Ctrl' ? (
                              <span className="inline-flex items-center gap-0.5">
                                <Command className="w-2.5 h-2.5 hidden mac:inline" />
                                <span>Ctrl</span>
                              </span>
                            ) : (
                              k
                            )}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>Single-key shortcuts pause automatically while typing in inputs.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
