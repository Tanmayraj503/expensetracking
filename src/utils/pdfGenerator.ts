import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BudgetSettings, Expense, ExpenseCategory } from '../types';
import { CATEGORY_COLORS } from '../data/sampleExpenses';

export type PdfReportPeriod = 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface PdfExportConfig {
  period: PdfReportPeriod;
  title: string;
  subtitle: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  currency: string;
  budgetSettings?: BudgetSettings;
  includeCharts?: boolean;
  includeCategoryBreakdown?: boolean;
  includeNotes?: boolean;
  sortBy?: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
}

interface TimeBucket {
  key: string;
  startDate: string;
  endDate: string;
  label: string;
  shortLabel: string;
  daysCount: number;
  spend: number;
  txCount: number;
  rollingAvg: number;
  cumulativeSpend: number;
  target: number;
  cumulativePlanned: number;
}

interface DonutSlice {
  name: string;
  amount: number;
  count: number;
  percentage: number;
  color: [number, number, number];
}

const CHART_PALETTE: [number, number, number][] = [
  [16, 185, 129],  // emerald-500
  [99, 102, 241],  // indigo-500
  [245, 158, 11],  // amber-500
  [14, 165, 233],  // sky-500
  [168, 85, 247],  // purple-500
  [244, 63, 94],   // rose-500
  [20, 184, 166],  // teal-500
  [59, 130, 246],  // blue-500
  [139, 92, 246],  // violet-500
  [6, 182, 212],   // cyan-500
  [100, 116, 139], // slate-500
];

const PAYMENT_COLORS: Record<string, [number, number, number]> = {
  'Credit Card': [99, 102, 241],
  'Debit Card': [16, 185, 129],
  'Digital Wallet': [14, 165, 233],
  'Bank Transfer': [245, 158, 11],
  'Cash': [20, 184, 166],
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [16, 185, 129];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return [16, 185, 129];
  return [r, g, b];
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getDaysInCalendarMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function formatShortDay(ymd: string): string {
  const dt = parseYmd(ymd);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatShortMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, 1);
  return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function fitText(doc: jsPDF, text: string, maxWidthMm: number): string {
  if (doc.getTextWidth(text) <= maxWidthMm) return text;
  const ellipsis = '...';
  let trimmed = text;
  while (trimmed.length > 1 && doc.getTextWidth(trimmed + ellipsis) > maxWidthMm) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed + ellipsis;
}

function computeNiceMax(rawMax: number): number {
  if (rawMax <= 0) return 100;
  const exp = Math.floor(Math.log10(rawMax));
  const pow10 = Math.pow(10, exp);
  const norm = rawMax / pow10;
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const nice = steps.find((s) => s >= norm) || 10;
  return nice * pow10;
}

function getCurrencyPrefix(currency: string): string {
  switch (currency) {
    case 'USD':
      return '$';
    case 'EUR':
      return 'EUR ';
    case 'GBP':
      return 'GBP ';
    case 'JPY':
      return 'JPY ';
    case 'INR':
      return 'INR ';
    case 'CAD':
      return 'CAD ';
    case 'AUD':
      return 'AUD ';
    default:
      return `${currency} `;
  }
}

function formatAxisCurrency(amount: number, currency: string): string {
  const prefix = getCurrencyPrefix(currency);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1000000) {
    return `${sign}${prefix}${(abs / 1000000).toFixed(1)}M`;
  }
  if (abs >= 1000) {
    const val = abs / 1000;
    return `${sign}${prefix}${val >= 10 ? val.toFixed(0) : val.toFixed(1)}k`;
  }
  return `${sign}${prefix}${Math.round(abs)}`;
}

/**
 * Format currency safely for standard PDF Helvetica font without encoding artifacts.
 */
export function formatPdfCurrency(amount: number, currency: string = 'USD'): string {
  const decimals = currency === 'JPY' ? 0 : 2;
  const num = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const prefix = amount < 0 ? '-' : '';
  return `${prefix}${getCurrencyPrefix(currency)}${num}`;
}

/**
 * Builds time-series buckets strictly bounded within [startDate, endDate].
 * Never reads or projects data before startDate or after endDate.
 */
function buildPeriodBuckets(
  filteredExpenses: Expense[],
  startDate: string,
  endDate: string,
  budgetSettings?: BudgetSettings
): {
  buckets: TimeBucket[];
  granularity: 'daily' | 'weekly' | 'monthly';
  granularityLabel: string;
  rollingWindowLabel: string;
  periodBudget: number;
} {
  const sDate = parseYmd(startDate);
  const eDate = parseYmd(endDate);
  const diffDays = Math.max(
    1,
    Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  const monthlyBudget = budgetSettings?.monthlyBudget ?? 3800;
  const dailyTarget = budgetSettings?.dailyTarget ?? Math.round(monthlyBudget / 30);

  // Determine exact period budget matching the selected span
  const isFullSingleMonth =
    startDate.slice(0, 7) === endDate.slice(0, 7) &&
    startDate.endsWith('-01') &&
    parseYmd(endDate).getDate() === getDaysInCalendarMonth(eDate.getFullYear(), eDate.getMonth());

  const isFullSingleYear =
    startDate.slice(0, 4) === endDate.slice(0, 4) &&
    startDate.endsWith('-01-01') &&
    endDate.endsWith('-12-31');

  let periodBudget = 0;
  if (isFullSingleMonth) {
    periodBudget = monthlyBudget;
  } else if (isFullSingleYear) {
    periodBudget = monthlyBudget * 12;
  } else {
    periodBudget = dailyTarget > 0 ? dailyTarget * diffDays : (monthlyBudget / 30) * diffDays;
  }

  let granularity: 'daily' | 'weekly' | 'monthly' = 'daily';
  let granularityLabel = 'Daily';
  let rollingWindowLabel = '7-Day Avg';

  if (diffDays > 140) {
    granularity = 'monthly';
    granularityLabel = 'Monthly';
    rollingWindowLabel = '3-Mo Avg';
  } else if (diffDays > 45) {
    granularity = 'weekly';
    granularityLabel = 'Weekly';
    rollingWindowLabel = '4-Wk Avg';
  }

  const rawBuckets: Array<{
    key: string;
    startDate: string;
    endDate: string;
    label: string;
    shortLabel: string;
    daysCount: number;
    target: number;
  }> = [];

  if (granularity === 'daily') {
    const useDayNumberOnly = diffDays > 14 && startDate.slice(0, 7) === endDate.slice(0, 7);
    for (let i = 0; i < diffDays; i++) {
      const dObj = addDays(sDate, i);
      const ymd = formatYmd(dObj);
      const shortDay = formatShortDay(ymd);
      rawBuckets.push({
        key: ymd,
        startDate: ymd,
        endDate: ymd,
        label: shortDay,
        shortLabel: useDayNumberOnly ? String(dObj.getDate()) : shortDay,
        daysCount: 1,
        target: isFullSingleMonth ? monthlyBudget / diffDays : dailyTarget,
      });
    }
  } else if (granularity === 'weekly') {
    let cursor = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate());
    let wkIdx = 1;
    while (cursor.getTime() <= eDate.getTime()) {
      const candidateEnd = addDays(cursor, 6);
      const bucketEnd = candidateEnd.getTime() <= eDate.getTime() ? candidateEnd : eDate;
      const bStartYmd = formatYmd(cursor);
      const bEndYmd = formatYmd(bucketEnd);
      const daysCount =
        Math.round((bucketEnd.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      rawBuckets.push({
        key: `${bStartYmd}_${bEndYmd}`,
        startDate: bStartYmd,
        endDate: bEndYmd,
        label: `${formatShortDay(bStartYmd)}–${formatShortDay(bEndYmd)}`,
        shortLabel: `W${wkIdx} (${formatShortDay(bStartYmd)})`,
        daysCount,
        target: dailyTarget * daysCount,
      });
      cursor = addDays(bucketEnd, 1);
      wkIdx++;
    }
  } else {
    // Monthly buckets strictly from startDate's month through endDate's month
    let curY = sDate.getFullYear();
    let curM = sDate.getMonth();
    const endY = eDate.getFullYear();
    const endM = eDate.getMonth();

    while (curY < endY || (curY === endY && curM <= endM)) {
      const ym = `${curY}-${String(curM + 1).padStart(2, '0')}`;
      const daysInCalMonth = getDaysInCalendarMonth(curY, curM);
      const monthFirst = `${ym}-01`;
      const monthLast = `${ym}-${String(daysInCalMonth).padStart(2, '0')}`;
      const bStart = monthFirst < startDate ? startDate : monthFirst;
      const bEnd = monthLast > endDate ? endDate : monthLast;

      const bStartObj = parseYmd(bStart);
      const bEndObj = parseYmd(bEnd);
      const daysCovered =
        Math.round((bEndObj.getTime() - bStartObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      rawBuckets.push({
        key: ym,
        startDate: bStart,
        endDate: bEnd,
        label: formatShortMonth(ym),
        shortLabel: formatShortMonth(ym),
        daysCount: daysCovered,
        target: monthlyBudget * (daysCovered / daysInCalMonth),
      });

      curM += 1;
      if (curM > 11) {
        curM = 0;
        curY += 1;
      }
    }
  }

  // Aggregate strictly filtered expenses into buckets
  const spendByBucket = new Map<string, { spend: number; count: number }>();
  for (const exp of filteredExpenses) {
    if (exp.date < startDate || exp.date > endDate) continue;
    if (granularity === 'daily') {
      const prev = spendByBucket.get(exp.date) || { spend: 0, count: 0 };
      spendByBucket.set(exp.date, { spend: prev.spend + exp.amount, count: prev.count + 1 });
    } else if (granularity === 'monthly') {
      const ym = exp.date.slice(0, 7);
      const prev = spendByBucket.get(ym) || { spend: 0, count: 0 };
      spendByBucket.set(ym, { spend: prev.spend + exp.amount, count: prev.count + 1 });
    } else {
      const match = rawBuckets.find((b) => exp.date >= b.startDate && exp.date <= b.endDate);
      if (match) {
        const prev = spendByBucket.get(match.key) || { spend: 0, count: 0 };
        spendByBucket.set(match.key, { spend: prev.spend + exp.amount, count: prev.count + 1 });
      }
    }
  }

  const windowSize = granularity === 'daily' ? 7 : granularity === 'weekly' ? 4 : 3;
  let runningSpend = 0;
  let runningPlanned = 0;

  const buckets: TimeBucket[] = rawBuckets.map((rb, idx) => {
    const agg = spendByBucket.get(rb.key) || { spend: 0, count: 0 };
    runningSpend += agg.spend;
    runningPlanned += rb.target;

    return {
      ...rb,
      spend: Math.round(agg.spend * 100) / 100,
      txCount: agg.count,
      rollingAvg: 0,
      cumulativeSpend: Math.round(runningSpend * 100) / 100,
      cumulativePlanned: Math.round(runningPlanned * 100) / 100,
    };
  });

  // Compute trailing moving average strictly within [startDate, endDate]
  for (let i = 0; i < buckets.length; i++) {
    const startIdx = Math.max(0, i - (windowSize - 1));
    const slice = buckets.slice(startIdx, i + 1);
    const avg = slice.reduce((acc, b) => acc + b.spend, 0) / slice.length;
    buckets[i].rollingAvg = Math.round(avg * 100) / 100;
  }

  return {
    buckets,
    granularity,
    granularityLabel,
    rollingWindowLabel,
    periodBudget: Math.round(periodBudget * 100) / 100,
  };
}

/**
 * Picks clean X-axis tick indices that always include index 0 (startDate) and n-1 (endDate)
 * without label collisions.
 */
function pickTickIndices(n: number, maxTicks: number = 7): number[] {
  if (n <= 1) return [0];
  if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i);

  const step = Math.ceil((n - 1) / (maxTicks - 1));
  const indices: number[] = [];
  for (let i = 0; i < n - 1; i += step) {
    if (n - 1 - i >= Math.max(2, Math.floor(step * 0.55))) {
      indices.push(i);
    }
  }
  if (indices[0] !== 0) indices.unshift(0);
  if (indices[indices.length - 1] !== n - 1) indices.push(n - 1);
  return indices;
}

function drawChartCardFrame(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  subtitle: string,
  badge?: { text: string; bg: [number, number, number]; fg: [number, number, number] }
) {
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');

  // Header divider subtle tint
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x + 0.2, y + 0.2, w - 0.4, 11.5, 1.8, 1.8, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(x, y + 11.8, x + w, y + 11.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const titleMaxW = badge ? w - 58 : w - 10;
  doc.text(fitText(doc, title, titleMaxW), x + 4, y + 5.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(fitText(doc, subtitle, w - 8), x + 4, y + 9.4);

  if (badge) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    const badgeW = Math.min(50, doc.getTextWidth(badge.text) + 5);
    const bx = x + w - badgeW - 3.5;
    const by = y + 2.5;
    doc.setFillColor(badge.bg[0], badge.bg[1], badge.bg[2]);
    doc.roundedRect(bx, by, badgeW, 5.2, 1, 1, 'F');
    doc.setTextColor(badge.fg[0], badge.fg[1], badge.fg[2]);
    doc.text(fitText(doc, badge.text, badgeW - 3), bx + badgeW / 2, by + 3.6, { align: 'center' });
  }
}

/**
 * 1. Spend Trajectory Bar Chart (mirrors DailyTracker bar chart, scoped strictly to [startDate, endDate])
 */
function drawSpendBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  buckets: TimeBucket[],
  granularityLabel: string,
  currency: string,
  startDate: string,
  endDate: string
) {
  const avgTarget =
    buckets.length > 0 ? buckets.reduce((s, b) => s + b.target, 0) / buckets.length : 0;

  drawChartCardFrame(
    doc,
    x,
    y,
    w,
    h,
    `${granularityLabel} Spend Trajectory (Bar Chart)`,
    `Exact period: ${startDate} to ${endDate} • Target vs actual spend per ${granularityLabel.toLowerCase()} bucket`
  );

  const plotLeft = x + 20;
  const plotRight = x + w - 6;
  const plotTop = y + 19.5;
  const plotBottom = y + h - 9.5;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  // Dedicated legend strip below header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  const legY = y + 15.6;
  // Within target
  doc.setFillColor(16, 185, 129);
  doc.rect(plotLeft, legY - 2.1, 2.5, 2.5, 'F');
  doc.setTextColor(71, 85, 105);
  doc.text('Within target', plotLeft + 3.5, legY);
  // Over target
  doc.setFillColor(244, 63, 94);
  doc.rect(plotLeft + 24, legY - 2.1, 2.5, 2.5, 'F');
  doc.text('Over target', plotLeft + 27.5, legY);
  // Target line
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.4);
  doc.setLineDashPattern([1.2, 1], 0);
  doc.line(plotLeft + 46, legY - 0.8, plotLeft + 52, legY - 0.8);
  doc.setLineDashPattern([], 0);
  doc.text('Target limit', plotLeft + 53.5, legY);

  const maxSpend = Math.max(...buckets.map((b) => b.spend), avgTarget, 10);
  const niceMax = computeNiceMax(maxSpend * 1.08);

  // Horizontal grid lines + Y-axis labels
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  for (let t = 0; t <= 4; t++) {
    const frac = t / 4;
    const gy = plotBottom - frac * plotH;
    const val = niceMax * frac;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(plotLeft, gy, plotRight, gy);

    doc.setTextColor(100, 116, 139);
    doc.text(formatAxisCurrency(val, currency), plotLeft - 2, gy + 1.5, { align: 'right' });
  }

  // Draw bars
  const n = buckets.length;
  const slotW = plotW / Math.max(1, n);
  const barW = n === 1 ? 14 : Math.max(1.2, Math.min(10, slotW * 0.68));

  buckets.forEach((b, i) => {
    const cx = n === 1 ? plotLeft + plotW / 2 : plotLeft + i * slotW + slotW / 2;
    const bx = cx - barW / 2;
    const barH = b.spend > 0 ? Math.max(0.8, (b.spend / niceMax) * plotH) : 0.4;
    const by = plotBottom - barH;

    if (b.spend <= 0) {
      doc.setFillColor(226, 232, 240);
    } else if (b.target > 0 && b.spend > b.target) {
      doc.setFillColor(244, 63, 94);
    } else {
      doc.setFillColor(16, 185, 129);
    }

    doc.rect(bx, by, barW, barH, 'F');
  });

  // Target dashed reference line (if within chart range)
  if (avgTarget > 0 && avgTarget <= niceMax) {
    const ty = plotBottom - (avgTarget / niceMax) * plotH;
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.45);
    doc.setLineDashPattern([1.5, 1.2], 0);
    doc.line(plotLeft, ty, plotRight, ty);
    doc.setLineDashPattern([], 0);

    // Subtle target badge at right edge
    const tLabel = `Target: ${formatAxisCurrency(avgTarget, currency)}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    const tw = doc.getTextWidth(tLabel) + 3;
    const labelY = Math.max(plotTop + 3.5, ty - 1.2);
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(plotRight - tw, labelY - 3.2, tw, 3.8, 0.8, 0.8, 'F');
    doc.setTextColor(180, 83, 9);
    doc.text(tLabel, plotRight - tw / 2, labelY - 0.6, { align: 'center' });
  }

  // X-axis baseline & strictly bounded tick labels
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.line(plotLeft, plotBottom, plotRight, plotBottom);

  const ticks = pickTickIndices(n, n <= 12 ? n : 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  ticks.forEach((idx) => {
    const cx = n === 1 ? plotLeft + plotW / 2 : plotLeft + idx * slotW + slotW / 2;
    const align: 'left' | 'center' | 'right' =
      n > 1 && idx === 0 ? 'left' : n > 1 && idx === n - 1 ? 'right' : 'center';
    const tx =
      align === 'left' ? Math.max(plotLeft, cx - 2) : align === 'right' ? Math.min(plotRight, cx + 2) : cx;
    doc.text(buckets[idx].shortLabel, tx, plotBottom + 4.5, { align });
  });
}

/**
 * 2. Spending Trend & Moving Average Line Chart (mirrors InsightsView Spending Trend LineChart)
 */
function drawSpendingTrendLineChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  buckets: TimeBucket[],
  granularityLabel: string,
  rollingWindowLabel: string,
  currency: string,
  startDate: string,
  endDate: string
) {
  drawChartCardFrame(
    doc,
    x,
    y,
    w,
    h,
    `Spending Trend & ${rollingWindowLabel} (Line Chart)`,
    `${granularityLabel} spending trajectory from ${startDate} to ${endDate} with trailing moving average`
  );

  const plotLeft = x + 20;
  const plotRight = x + w - 6;
  const plotTop = y + 19.5;
  const plotBottom = y + h - 9.5;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  // Dedicated legend strip below header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  const legY = y + 15.6;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.6);
  doc.line(plotLeft, legY - 0.8, plotLeft + 6, legY - 0.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Actual Spend', plotLeft + 7.5, legY);

  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([1.5, 1.2], 0);
  doc.line(plotLeft + 29, legY - 0.8, plotLeft + 35, legY - 0.8);
  doc.setLineDashPattern([], 0);
  doc.text(rollingWindowLabel, plotLeft + 36.5, legY);

  const maxVal = Math.max(...buckets.map((b) => Math.max(b.spend, b.rollingAvg)), 10);
  const niceMax = computeNiceMax(maxVal * 1.12);

  // Grid & Y-axis
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  for (let t = 0; t <= 4; t++) {
    const frac = t / 4;
    const gy = plotBottom - frac * plotH;
    const val = niceMax * frac;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(plotLeft, gy, plotRight, gy);
    doc.setTextColor(100, 116, 139);
    doc.text(formatAxisCurrency(val, currency), plotLeft - 2, gy + 1.5, { align: 'right' });
  }

  const n = buckets.length;
  const xFor = (i: number) =>
    n <= 1 ? plotLeft + plotW / 2 : plotLeft + (i / (n - 1)) * plotW;
  const yFor = (val: number) => plotBottom - (val / niceMax) * plotH;

  // Moving average dashed indigo line
  if (n > 1) {
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([1.6, 1.2], 0);
    for (let i = 0; i < n - 1; i++) {
      doc.line(
        xFor(i),
        yFor(buckets[i].rollingAvg),
        xFor(i + 1),
        yFor(buckets[i + 1].rollingAvg)
      );
    }
    doc.setLineDashPattern([], 0);
  }

  // Actual spend solid emerald line
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.65);
  for (let i = 0; i < n - 1; i++) {
    doc.line(xFor(i), yFor(buckets[i].spend), xFor(i + 1), yFor(buckets[i + 1].spend));
  }

  // Data dots
  if (n <= 35) {
    buckets.forEach((b, i) => {
      doc.setFillColor(16, 185, 129);
      doc.circle(xFor(i), yFor(b.spend), 0.75, 'F');
    });
  }

  // Peak spend callout
  let peakIdx = 0;
  buckets.forEach((b, i) => {
    if (b.spend > buckets[peakIdx].spend) peakIdx = i;
  });
  if (buckets[peakIdx] && buckets[peakIdx].spend > 0) {
    const px = xFor(peakIdx);
    const py = yFor(buckets[peakIdx].spend);
    doc.setFillColor(244, 63, 94);
    doc.circle(px, py, 1.1, 'F');

    const peakText = `Peak ${buckets[peakIdx].label}: ${formatAxisCurrency(buckets[peakIdx].spend, currency)}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    const pw = doc.getTextWidth(peakText) + 3;
    let lx = px - pw / 2;
    if (lx < plotLeft) lx = plotLeft;
    if (lx + pw > plotRight) lx = plotRight - pw;
    const ly = py - 5.2 < plotTop ? py + 2.2 : py - 5.2;
    doc.setFillColor(255, 241, 242);
    doc.roundedRect(lx, ly, pw, 3.8, 0.8, 0.8, 'F');
    doc.setTextColor(190, 18, 60);
    doc.text(peakText, lx + pw / 2, ly + 2.7, { align: 'center' });
  }

  // X-axis baseline & ticks
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.line(plotLeft, plotBottom, plotRight, plotBottom);

  const ticks = pickTickIndices(n, n <= 12 ? n : 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  ticks.forEach((idx) => {
    const align: 'left' | 'center' | 'right' =
      n > 1 && idx === 0 ? 'left' : n > 1 && idx === n - 1 ? 'right' : 'center';
    doc.text(buckets[idx].shortLabel, xFor(idx), plotBottom + 4.5, { align });
  });
}

/**
 * 3. Cumulative Spend Pacing vs Planned Budget Area/Line Chart (mirrors MonthlyTracker & InsightsView Forecast/Pacing)
 */
function drawCumulativePacingAreaChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  buckets: TimeBucket[],
  periodBudget: number,
  currency: string,
  startDate: string,
  endDate: string
) {
  const actualFinal = buckets.length > 0 ? buckets[buckets.length - 1].cumulativeSpend : 0;
  const plannedFinal = buckets.length > 0 ? buckets[buckets.length - 1].cumulativePlanned : periodBudget;
  const variance = actualFinal - plannedFinal;
  const isOver = variance > 0.01;

  drawChartCardFrame(
    doc,
    x,
    y,
    w,
    h,
    'Cumulative Spend Pacing vs Planned Budget (Area Chart)',
    `Cumulative expenditure within ${startDate} to ${endDate} against prorated budget (${formatPdfCurrency(plannedFinal, currency)})`,
    {
      text: isOver
        ? `+${formatAxisCurrency(variance, currency)} Over Pace`
        : `${formatAxisCurrency(Math.abs(variance), currency)} Under Pace`,
      bg: isOver ? [255, 228, 230] : [209, 250, 229],
      fg: isOver ? [190, 18, 60] : [4, 120, 87],
    }
  );

  const plotLeft = x + 20;
  const plotRight = x + w - 6;
  const plotTop = y + 16;
  const plotBottom = y + h - 10;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  const maxVal = Math.max(actualFinal, plannedFinal, 10);
  const niceMax = computeNiceMax(maxVal * 1.08);

  // Grid & Y-axis
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  for (let t = 0; t <= 4; t++) {
    const frac = t / 4;
    const gy = plotBottom - frac * plotH;
    const val = niceMax * frac;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(plotLeft, gy, plotRight, gy);
    doc.setTextColor(100, 116, 139);
    doc.text(formatAxisCurrency(val, currency), plotLeft - 2, gy + 1.5, { align: 'right' });
  }

  const n = buckets.length;
  const xFor = (i: number) =>
    n <= 1 ? plotLeft + plotW / 2 : plotLeft + (i / (n - 1)) * plotW;
  const yFor = (val: number) => plotBottom - (val / niceMax) * plotH;

  // Translucent area under cumulative actual curve
  if (n > 1) {
    doc.saveGraphicsState();
    doc.setGState(doc.GState({ opacity: 0.16 }));
    doc.setFillColor(16, 185, 129);
    doc.moveTo(xFor(0), plotBottom);
    buckets.forEach((b, i) => {
      doc.lineTo(xFor(i), yFor(b.cumulativeSpend));
    });
    doc.lineTo(xFor(n - 1), plotBottom);
    doc.close();
    doc.fill();
    doc.restoreGraphicsState();
  }

  // Planned linear pace dashed line
  if (n > 1) {
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.45);
    doc.setLineDashPattern([1.6, 1.2], 0);
    for (let i = 0; i < n - 1; i++) {
      doc.line(
        xFor(i),
        yFor(buckets[i].cumulativePlanned),
        xFor(i + 1),
        yFor(buckets[i + 1].cumulativePlanned)
      );
    }
    doc.setLineDashPattern([], 0);
  }

  // Actual cumulative curve solid emerald line
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.7);
  for (let i = 0; i < n - 1; i++) {
    doc.line(
      xFor(i),
      yFor(buckets[i].cumulativeSpend),
      xFor(i + 1),
      yFor(buckets[i + 1].cumulativeSpend)
    );
  }

  // End marker dots
  if (n >= 1) {
    const lastIdx = n - 1;
    doc.setFillColor(16, 185, 129);
    doc.circle(xFor(lastIdx), yFor(actualFinal), 1.0, 'F');
    doc.setFillColor(100, 116, 139);
    doc.circle(xFor(lastIdx), yFor(plannedFinal), 0.85, 'F');
  }

  // Compact inline legend in top-left of plot
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.6);
  doc.line(plotLeft + 2, plotTop + 2, plotLeft + 7, plotTop + 2);
  doc.setTextColor(51, 65, 85);
  doc.text(`Actual (${formatAxisCurrency(actualFinal, currency)})`, plotLeft + 8.5, plotTop + 2.8);

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.45);
  doc.setLineDashPattern([1.4, 1], 0);
  doc.line(plotLeft + 36, plotTop + 2, plotLeft + 41, plotTop + 2);
  doc.setLineDashPattern([], 0);
  doc.text(`Planned (${formatAxisCurrency(plannedFinal, currency)})`, plotLeft + 42.5, plotTop + 2.8);

  // X-axis baseline & ticks
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.line(plotLeft, plotBottom, plotRight, plotBottom);

  const ticks = pickTickIndices(n, n <= 12 ? n : 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  ticks.forEach((idx) => {
    const align: 'left' | 'center' | 'right' =
      n > 1 && idx === 0 ? 'left' : n > 1 && idx === n - 1 ? 'right' : 'center';
    doc.text(buckets[idx].shortLabel, xFor(idx), plotBottom + 4.5, { align });
  });
}

/**
 * 4 & 5. Vector Donut Chart Card (mirrors MonthlyTracker Category Donut & InsightsView Label Donut)
 */
function drawDonutChartCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  subtitle: string,
  slices: DonutSlice[],
  totalAmount: number,
  centerLabel: string,
  currency: string
) {
  drawChartCardFrame(doc, x, y, w, h, title, subtitle);

  if (slices.length === 0 || totalAmount <= 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('No expenses recorded within the selected period.', x + w / 2, y + h / 2 + 4, {
      align: 'center',
    });
    return;
  }

  // Group tail slices beyond 7 so the legend never clips or overflows
  const maxVisibleSlices = 7;
  let displaySlices = slices;
  if (slices.length > maxVisibleSlices) {
    const top = slices.slice(0, maxVisibleSlices - 1);
    const rest = slices.slice(maxVisibleSlices - 1);
    const restAmount = rest.reduce((s, r) => s + r.amount, 0);
    const restCount = rest.reduce((s, r) => s + r.count, 0);
    displaySlices = [
      ...top,
      {
        name: `Other (${rest.length})`,
        amount: restAmount,
        count: restCount,
        percentage: totalAmount > 0 ? (restAmount / totalAmount) * 100 : 0,
        color: [148, 163, 184],
      },
    ];
  }

  // Draw crisp vector donut on left side of card
  const cx = x + 28;
  const cy = y + 12 + (h - 12) / 2;
  const rOuter = 19;
  const rInner = 10.8;

  if (displaySlices.length === 1) {
    const [r, g, b] = displaySlices[0].color;
    doc.setFillColor(r, g, b);
    doc.circle(cx, cy, rOuter, 'F');
  } else {
    let currentAngle = -Math.PI / 2;
    displaySlices.forEach((slice) => {
      const sweep = (slice.percentage / 100) * Math.PI * 2;
      if (sweep <= 0.002) return;
      const endAngle = currentAngle + sweep;
      const steps = Math.max(8, Math.ceil(sweep / 0.06));

      doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.45);
      doc.moveTo(cx, cy);
      for (let i = 0; i <= steps; i++) {
        const a = currentAngle + (endAngle - currentAngle) * (i / steps);
        doc.lineTo(cx + Math.cos(a) * rOuter, cy + Math.sin(a) * rOuter);
      }
      doc.close();
      doc.fillStroke();
      currentAngle = endAngle;
    });
  }

  // Punch crisp circular inner hole
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, rInner, 'F');

  // Center text inside donut hole
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text(centerLabel, cx, cy - 1.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(fitText(doc, formatAxisCurrency(totalAmount, currency), rInner * 1.8), cx, cy + 2.8, {
    align: 'center',
  });

  // Right-side spacious legend with mini share bar
  const legX = x + 56;
  const legW = w - 62; // ~120mm
  const startY = y + 16.5;
  const rowH = 6.6;

  displaySlices.forEach((slice, idx) => {
    const ry = startY + idx * rowH;

    // Color swatch
    doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
    doc.roundedRect(legX, ry - 2.3, 2.6, 2.6, 0.5, 0.5, 'F');

    // Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(30, 41, 59);
    doc.text(fitText(doc, slice.name, 42), legX + 4.2, ry);

    // Mini share bar
    const barX = legX + 48;
    const barMaxW = 32;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(barX, ry - 2.0, barMaxW, 2.0, 0.5, 0.5, 'F');
    const fillW = Math.max(0.8, (slice.percentage / 100) * barMaxW);
    doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
    doc.roundedRect(barX, ry - 2.0, fillW, 2.0, 0.5, 0.5, 'F');

    // Percentage
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${slice.percentage.toFixed(1)}%`, barX + barMaxW + 11, ry, { align: 'right' });

    // Formatted amount
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(formatPdfCurrency(slice.amount, currency), legX + legW, ry, { align: 'right' });
  });
}

/**
 * 6. Payment Method Distribution Horizontal Bar Chart
 */
function drawPaymentMethodBarChartCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  rows: Array<{ method: string; amount: number; count: number; percentage: number }>,
  currency: string,
  startDate: string,
  endDate: string
) {
  drawChartCardFrame(
    doc,
    x,
    y,
    w,
    h,
    'Payment Method Breakdown (Horizontal Bar Chart)',
    `Expenditure distribution by payment channel from ${startDate} to ${endDate}`
  );

  if (rows.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('No payment records in selected period.', x + w / 2, y + h / 2 + 4, { align: 'center' });
    return;
  }

  const visibleRows = rows.slice(0, 5);
  const startY = y + 17.5;
  const rowH = 6.2;
  const labelX = x + 5;
  const barX = x + 38;
  const barMaxW = w - 92; // ~90mm

  visibleRows.forEach((row, idx) => {
    const ry = startY + idx * rowH;
    const color = PAYMENT_COLORS[row.method] || CHART_PALETTE[idx % CHART_PALETTE.length];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(30, 41, 59);
    doc.text(fitText(doc, row.method, 31), labelX, ry);

    // Track
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(barX, ry - 2.6, barMaxW, 3.0, 0.8, 0.8, 'F');

    // Fill bar
    const fillW = Math.max(1.2, (row.percentage / 100) * barMaxW);
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(barX, ry - 2.6, fillW, 3.0, 0.8, 0.8, 'F');

    // Count + % + Amount
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(100, 116, 139);
    doc.text(`${row.count} tx • ${row.percentage.toFixed(1)}%`, x + w - 31, ry, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(formatPdfCurrency(row.amount, currency), x + w - 5, ry, { align: 'right' });
  });
}

/**
 * Generates and downloads a beautifully formatted, fully paginated, vector-sharp PDF
 * spending report including all chart types supported by the app, strictly scoped to
 * the user's selected [startDate, endDate] period.
 */
export function generateSpendingsPdf(
  allExpenses: Expense[],
  config: PdfExportConfig
): { success: boolean; filename: string; transactionCount: number; totalSpend: number } {
  // Normalize date bounds safely
  const startDate = config.startDate <= config.endDate ? config.startDate : config.endDate;
  const endDate = config.startDate <= config.endDate ? config.endDate : config.startDate;

  // 1. Filter expenses strictly within selected date range
  const filtered = allExpenses.filter((e) => {
    return e.date >= startDate && e.date <= endDate;
  });

  // 2. Sort expenses as requested
  const sortBy = config.sortBy || 'date-desc';
  filtered.sort((a, b) => {
    if (sortBy === 'date-desc') {
      const cmp = b.date.localeCompare(a.date);
      return cmp !== 0 ? cmp : (b.time || '').localeCompare(a.time || '');
    }
    if (sortBy === 'date-asc') {
      const cmp = a.date.localeCompare(b.date);
      return cmp !== 0 ? cmp : (a.time || '').localeCompare(b.time || '');
    }
    if (sortBy === 'amount-desc') {
      return b.amount - a.amount;
    }
    if (sortBy === 'amount-asc') {
      return a.amount - b.amount;
    }
    return 0;
  });

  // 3. Compute Executive Summary Metrics
  const totalSpend = filtered.reduce((sum, e) => sum + e.amount, 0);
  const transactionCount = filtered.length;

  const sDate = parseYmd(startDate);
  const eDate = parseYmd(endDate);
  const diffDays = Math.max(
    1,
    Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const dailyAverage = totalSpend / diffDays;

  // Category Breakdown strictly within [startDate, endDate]
  const categoryMap = new Map<ExpenseCategory, { total: number; count: number }>();
  filtered.forEach((e) => {
    const prev = categoryMap.get(e.category) || { total: 0, count: 0 };
    categoryMap.set(e.category, {
      total: prev.total + e.amount,
      count: prev.count + 1,
    });
  });

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      total: stats.total,
      count: stats.count,
      percentage: totalSpend > 0 ? (stats.total / totalSpend) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const topCategory = categoryBreakdown[0] || null;

  // Label / Tag Breakdown strictly within [startDate, endDate] (mirrors InsightsView split logic)
  const labelMap = new Map<string, { total: number; count: number }>();
  filtered.forEach((exp) => {
    const tags = exp.tags && exp.tags.length > 0 ? exp.tags : ['Unlabeled'];
    const splitAmount = exp.amount / tags.length;
    tags.forEach((tag) => {
      const clean = tag.trim().replace(/^#/, '') || 'Unlabeled';
      const prev = labelMap.get(clean) || { total: 0, count: 0 };
      labelMap.set(clean, {
        total: prev.total + splitAmount,
        count: prev.count + 1,
      });
    });
  });

  const labelSlices: DonutSlice[] = Array.from(labelMap.entries())
    .map(([name, stats]) => ({
      name: name === 'Unlabeled' ? 'Unlabeled' : `#${name}`,
      amount: Math.round(stats.total * 100) / 100,
      count: stats.count,
      percentage: totalSpend > 0 ? (stats.total / totalSpend) * 100 : 0,
      color: [16, 185, 129] as [number, number, number],
    }))
    .sort((a, b) => b.amount - a.amount)
    .map((item, idx) => ({
      ...item,
      color:
        item.name === 'Unlabeled'
          ? ([148, 163, 184] as [number, number, number])
          : CHART_PALETTE[idx % CHART_PALETTE.length],
    }));

  const categorySlices: DonutSlice[] = categoryBreakdown.map((c, idx) => ({
    name: c.category,
    amount: Math.round(c.total * 100) / 100,
    count: c.count,
    percentage: c.percentage,
    color: CATEGORY_COLORS[c.category]?.bar
      ? hexToRgb(CATEGORY_COLORS[c.category].bar)
      : CHART_PALETTE[idx % CHART_PALETTE.length],
  }));

  // Payment Method Breakdown strictly within [startDate, endDate]
  const payMap = new Map<string, { amount: number; count: number }>();
  filtered.forEach((e) => {
    const method = e.paymentMethod || 'Other';
    const prev = payMap.get(method) || { amount: 0, count: 0 };
    payMap.set(method, { amount: prev.amount + e.amount, count: prev.count + 1 });
  });
  const paymentRows = Array.from(payMap.entries())
    .map(([method, stats]) => ({
      method,
      amount: Math.round(stats.amount * 100) / 100,
      count: stats.count,
      percentage: totalSpend > 0 ? (stats.amount / totalSpend) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Build period-exact time-series buckets
  const { buckets, granularityLabel, rollingWindowLabel, periodBudget } = buildPeriodBuckets(
    filtered,
    startDate,
    endDate,
    config.budgetSettings
  );

  // 4. Initialize PDF Document (A4 Portrait: 210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const leftMargin = 14;
  const rightMargin = 14;
  const printableWidth = pageWidth - leftMargin - rightMargin; // 182mm

  // Helper colors
  const primaryEmerald = [16, 185, 129]; // #10b981
  const darkSlate = [15, 23, 42]; // #0f172a
  const borderSlate = [226, 232, 240]; // #e2e8f0
  const bgSlate = [248, 250, 252]; // #f8fafc
  const mutedText = [100, 116, 139]; // #64748b

  // 5. Draw Page 1 Header & Branding
  doc.setFillColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
  doc.rect(0, 0, pageWidth, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('LedgerPulse', leftMargin, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('PERSONAL FINANCIAL INTELLIGENCE & EXPENSE TRACKING', leftMargin, 20.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
  doc.text(fitText(doc, config.title.toUpperCase(), 105), pageWidth - rightMargin, 15, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text(`Period: ${startDate} to ${endDate} (${diffDays} days)`, pageWidth - rightMargin, 20, {
    align: 'right',
  });
  doc.text(
    `Generated: ${new Date().toISOString().slice(0, 10)} ${new Date().toTimeString().slice(0, 5)} UTC`,
    pageWidth - rightMargin,
    24,
    { align: 'right' }
  );

  doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
  doc.setLineWidth(0.4);
  doc.line(leftMargin, 27, pageWidth - rightMargin, 27);

  // 6. Draw Executive KPI Cards
  const cardY = 31;
  const cardHeight = 17.5;
  const cardGap = 3.5;
  const cardWidth = (printableWidth - cardGap * 3) / 4; // ~42.8mm each

  const kpis = [
    {
      label: 'TOTAL EXPENDITURE',
      value: formatPdfCurrency(totalSpend, config.currency),
      sub: `${transactionCount} transactions`,
      highlight: true,
    },
    {
      label: 'DAILY RUN-RATE',
      value: formatPdfCurrency(dailyAverage, config.currency),
      sub: `Across ${diffDays} selected days`,
      highlight: false,
    },
    {
      label: 'TOP EXPENSE CATEGORY',
      value: topCategory ? topCategory.category : 'N/A',
      sub: topCategory ? `${topCategory.percentage.toFixed(1)}% of total` : 'No expenses',
      highlight: false,
    },
    {
      label: 'REPORT SCOPE',
      value: config.period.toUpperCase(),
      sub: `${config.currency} • ${granularityLabel} charts`,
      highlight: false,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = leftMargin + idx * (cardWidth + cardGap);

    doc.setFillColor(bgSlate[0], bgSlate[1], bgSlate[2]);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.5, 1.5, 'F');

    doc.setDrawColor(
      kpi.highlight ? primaryEmerald[0] : borderSlate[0],
      kpi.highlight ? primaryEmerald[1] : borderSlate[1],
      kpi.highlight ? primaryEmerald[2] : borderSlate[2]
    );
    doc.setLineWidth(kpi.highlight ? 0.4 : 0.2);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text(kpi.label, x + 2.5, cardY + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(
      kpi.highlight ? 5 : darkSlate[0],
      kpi.highlight ? 150 : darkSlate[1],
      kpi.highlight ? 105 : darkSlate[2]
    );
    doc.text(fitText(doc, kpi.value, cardWidth - 5), x + 2.5, cardY + 10.6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text(fitText(doc, kpi.sub, cardWidth - 5), x + 2.5, cardY + 15);
  });

  let currentY = cardY + cardHeight + 6;

  // 7. Visual Analytics Charts (All chart types supported by the app, strictly matching [startDate, endDate])
  if (config.includeCharts !== false) {
    // Page 1 Charts: Time-Series Charts aligned identically over [startDate .. endDate]
    const chartH = 68;
    const chartGap = 4.5;

    // Chart 1: Bar Chart (Spend Trajectory)
    drawSpendBarChart(
      doc,
      leftMargin,
      currentY,
      printableWidth,
      chartH,
      buckets,
      granularityLabel,
      config.currency,
      startDate,
      endDate
    );
    currentY += chartH + chartGap;

    // Chart 2: Line Chart (Spending Trend & Moving Average)
    drawSpendingTrendLineChart(
      doc,
      leftMargin,
      currentY,
      printableWidth,
      chartH,
      buckets,
      granularityLabel,
      rollingWindowLabel,
      config.currency,
      startDate,
      endDate
    );
    currentY += chartH + chartGap;

    // Chart 3: Area / Pacing Chart (Cumulative Spend Pacing vs Planned Pace)
    drawCumulativePacingAreaChart(
      doc,
      leftMargin,
      currentY,
      printableWidth,
      chartH,
      buckets,
      periodBudget,
      config.currency,
      startDate,
      endDate
    );

    // Page 2 Charts: Breakdown Charts (Category Donut, Assigned Labels Donut, Payment Method Bars)
    doc.addPage();
    currentY = 21;

    const donutH = 65;
    // Chart 4: Category Allocation Donut Chart
    drawDonutChartCard(
      doc,
      leftMargin,
      currentY,
      printableWidth,
      donutH,
      'Category Allocation Breakdown (Donut Chart)',
      `Share of total expenditure across categories (${startDate} to ${endDate})`,
      categorySlices,
      totalSpend,
      `${categorySlices.length} Categories`,
      config.currency
    );
    currentY += donutH + 5;

    // Chart 5: Assigned Labels / Tags Donut Chart
    drawDonutChartCard(
      doc,
      leftMargin,
      currentY,
      printableWidth,
      donutH,
      'Budget Allocation by Assigned Labels (Donut Chart)',
      `Expenses grouped by assigned #tags with multi-tag equal split (${startDate} to ${endDate})`,
      labelSlices,
      totalSpend,
      `${labelSlices.length} Labels`,
      config.currency
    );
    currentY += donutH + 5;

    // Chart 6: Payment Method Horizontal Bar Chart
    const paymentChartH = 51;
    drawPaymentMethodBarChartCard(
      doc,
      leftMargin,
      currentY,
      printableWidth,
      paymentChartH,
      paymentRows,
      config.currency,
      startDate,
      endDate
    );
    currentY += paymentChartH + 8;
  }

  // 8. Optional Category Breakdown Summary Table
  if (config.includeCategoryBreakdown !== false && categoryBreakdown.length > 0) {
    if (currentY > 235) {
      doc.addPage();
      currentY = 22;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text('Category Allocation Summary', leftMargin, currentY);
    currentY += 2.5;

    const catRows = categoryBreakdown.map((c) => [
      c.category,
      c.count.toString(),
      formatPdfCurrency(c.total, config.currency),
      `${c.percentage.toFixed(1)}%`,
      formatPdfCurrency(c.total / diffDays, config.currency),
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { top: 22, bottom: 20, left: leftMargin, right: rightMargin },
      head: [['Expense Category', 'Transactions', 'Subtotal', '% of Portfolio', 'Daily Run-Rate']],
      body: catRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 1.8,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        overflow: 'linebreak',
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 32, halign: 'center' },
        4: { cellWidth: 35, halign: 'right' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // 9. Itemized Ledger Transactions Table
  if (currentY > 240) {
    doc.addPage();
    currentY = 22;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`Itemized Transaction Ledger (${transactionCount} records)`, leftMargin, currentY);
  currentY += 2.5;

  if (filtered.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text('No expense records found within this date period.', leftMargin, currentY + 6);
  } else {
    const showNotesCol = config.includeNotes !== false;

    if (showNotesCol) {
      const tableRows = filtered.map((e) => {
        let notesAndTags = '';
        if (e.tags && e.tags.length > 0) {
          notesAndTags += e.tags.map((t) => `#${t}`).join(' ');
        }
        if (e.notes) {
          notesAndTags += notesAndTags ? ` • ${e.notes}` : e.notes;
        }
        if (!notesAndTags) {
          notesAndTags = '—';
        }

        return [
          e.date,
          e.merchant,
          e.category,
          e.paymentMethod,
          notesAndTags,
          formatPdfCurrency(e.amount, config.currency),
        ];
      });

      // 22 + 38 + 28 + 24 + 46 + 24 = 182mm
      autoTable(doc, {
        startY: currentY,
        margin: { top: 22, bottom: 20, left: leftMargin, right: rightMargin },
        head: [['Date', 'Merchant / Entity', 'Category', 'Payment Method', 'Tags & Notes', 'Amount']],
        body: tableRows,
        foot: [
          [
            '',
            'TOTAL EXPENDITURE',
            '',
            '',
            `${transactionCount} total records across ${diffDays} days`,
            formatPdfCurrency(totalSpend, config.currency),
          ],
        ],
        showHead: 'everyPage',
        showFoot: 'lastPage',
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: 2.2,
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: 2.5,
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2.0,
          overflow: 'linebreak',
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
        },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },
          1: { cellWidth: 38, fontStyle: 'bold' },
          2: { cellWidth: 28 },
          3: { cellWidth: 24 },
          4: { cellWidth: 46 },
          5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
      });
    } else {
      const tableRows = filtered.map((e) => [
        e.date,
        e.merchant,
        e.category,
        e.paymentMethod,
        formatPdfCurrency(e.amount, config.currency),
      ]);

      // 24 + 58 + 38 + 34 + 28 = 182mm
      autoTable(doc, {
        startY: currentY,
        margin: { top: 22, bottom: 20, left: leftMargin, right: rightMargin },
        head: [['Date', 'Merchant / Entity', 'Category', 'Payment Method', 'Amount']],
        body: tableRows,
        foot: [
          [
            '',
            'TOTAL EXPENDITURE',
            '',
            `${transactionCount} records (${diffDays} days)`,
            formatPdfCurrency(totalSpend, config.currency),
          ],
        ],
        showHead: 'everyPage',
        showFoot: 'lastPage',
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: 2.2,
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: 2.5,
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2.0,
          overflow: 'linebreak',
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
        },
        columnStyles: {
          0: { cellWidth: 24, halign: 'center' },
          1: { cellWidth: 58, fontStyle: 'bold' },
          2: { cellWidth: 38 },
          3: { cellWidth: 34 },
          4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
      });
    }
  }

  // 10. Running Header (Pages 2+) & Footer (All Pages)
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);

    if (page > 1) {
      doc.setFillColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
      doc.rect(0, 0, pageWidth, 2, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
      doc.text(
        `LedgerPulse Spending Report • ${config.title} (${startDate} to ${endDate})`,
        leftMargin,
        13.5
      );
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.setLineWidth(0.2);
      doc.line(leftMargin, 16, pageWidth - rightMargin, 16);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);

    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.2);
    doc.line(leftMargin, pageHeight - 12, pageWidth - rightMargin, pageHeight - 12);

    doc.text(
      'CONFIDENTIAL • Generated by LedgerPulse Expense Intelligence • Valid Financial Document',
      leftMargin,
      pageHeight - 7.5
    );

    doc.text(`Page ${page} of ${totalPages}`, pageWidth - rightMargin, pageHeight - 7.5, {
      align: 'right',
    });
  }

  // 11. Generate Filename & Trigger Download
  const cleanTitle = config.period.toLowerCase();
  const filename = `LedgerPulse-${cleanTitle}-spendings-${startDate}_to_${endDate}.pdf`;
  doc.save(filename);

  return {
    success: true,
    filename,
    transactionCount,
    totalSpend,
  };
}
