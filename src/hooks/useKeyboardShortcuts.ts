import { useEffect, useRef } from 'react';
import { AppTab } from '../components/Sidebar';

export interface KeyboardShortcutHandlers {
  onNewExpense: () => void;
  onFocusSearch: () => void;
  onOpenBudget: () => void;
  onOpenPdfExport: () => void;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onSwitchTab: (tab: AppTab) => void;
  onToggleShortcutsHelp: () => void;
  onEscape: () => void;
  isAnyModalOpen: boolean;
}

/**
 * Checks whether keyboard focus is inside an editable form field
 * so single-character shortcuts never interfere with typing.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return Boolean(target.closest('[contenteditable="true"]'));
}

/**
 * Global keyboard shortcut listener for LedgerPulse power-user workflows.
 *
 * Supported shortcuts:
 * - `n`: Open New Expense modal
 * - `/` or `Ctrl/Cmd + K`: Focus Global Search bar
 * - `Esc`: Close active modal / blur search / clear mobile drawer
 * - `1`–`5`: Switch views (Daily, Monthly, Ledger, Recurring, Insights)
 * - `b`: Open Budget & Goals modal
 * - `e`: Open PDF Export modal
 * - `t`: Toggle Dark / Light theme
 * - `[`: Collapse / Expand sidebar
 * - `?`: Toggle Keyboard Shortcuts cheat sheet
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  // Store latest handlers in a ref so the window listener stays stable
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const current = handlersRef.current;

      // Ignore IME composition events
      if (e.isComposing) return;

      const key = e.key;
      const lowerKey = key.toLowerCase();
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

      // Always support Cmd+K / Ctrl+K to jump straight to global search
      if ((e.metaKey || e.ctrlKey) && lowerKey === 'k') {
        e.preventDefault();
        if (!current.isAnyModalOpen) {
          current.onFocusSearch();
        }
        return;
      }

      // Escape: close active modal or dismiss search focus
      if (key === 'Escape') {
        current.onEscape();
        return;
      }

      // Skip all single-key shortcuts if user is typing or holding modifier keys
      if (hasModifier || isEditableTarget(e.target)) {
        return;
      }

      // Help modal toggle ('?') works anytime outside inputs
      if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        current.onToggleShortcutsHelp();
        return;
      }

      // Suppress navigation/creation shortcuts while a modal dialog is open
      if (current.isAnyModalOpen) {
        return;
      }

      switch (lowerKey) {
        case 'n':
          e.preventDefault();
          current.onNewExpense();
          break;
        case '/':
          e.preventDefault();
          current.onFocusSearch();
          break;
        case 'b':
          e.preventDefault();
          current.onOpenBudget();
          break;
        case 'e':
          e.preventDefault();
          current.onOpenPdfExport();
          break;
        case 't':
          e.preventDefault();
          current.onToggleTheme();
          break;
        case '[':
          e.preventDefault();
          current.onToggleSidebar();
          break;
        case '1':
          e.preventDefault();
          current.onSwitchTab('daily');
          break;
        case '2':
          e.preventDefault();
          current.onSwitchTab('monthly');
          break;
        case '3':
          e.preventDefault();
          current.onSwitchTab('ledger');
          break;
        case '4':
          e.preventDefault();
          current.onSwitchTab('recurring');
          break;
        case '5':
          e.preventDefault();
          current.onSwitchTab('insights');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
