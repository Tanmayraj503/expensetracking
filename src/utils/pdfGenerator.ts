import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Expense, ExpenseCategory } from '../types';

export type PdfReportPeriod = 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface PdfExportConfig {
  period: PdfReportPeriod;
  title: string;
  subtitle: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  currency: string;
  includeCategoryBreakdown?: boolean;
  includeNotes?: boolean;
  sortBy?: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
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

  switch (currency) {
    case 'USD':
      return `${prefix}$${num}`;
    case 'EUR':
      return `${prefix}EUR ${num}`;
    case 'GBP':
      return `${prefix}GBP ${num}`;
    case 'JPY':
      return `${prefix}JPY ${num}`;
    case 'INR':
      return `${prefix}INR ${num}`;
    case 'CAD':
      return `${prefix}CAD ${num}`;
    case 'AUD':
      return `${prefix}AUD ${num}`;
    default:
      return `${prefix}${currency} ${num}`;
  }
}

/**
 * Generates and downloads a beautifully formatted, fully paginated, vector-sharp PDF
 * spending report with zero text clipping, clean wrapping, and comprehensive statistics.
 */
export function generateSpendingsPdf(
  allExpenses: Expense[],
  config: PdfExportConfig
): { success: boolean; filename: string; transactionCount: number; totalSpend: number } {
  // 1. Filter expenses strictly within selected date range
  const filtered = allExpenses.filter((e) => {
    return e.date >= config.startDate && e.date <= config.endDate;
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

  // Calculate unique days elapsed in the range
  const [startY, startM, startD] = config.startDate.split('-').map(Number);
  const [endY, endM, endD] = config.endDate.split('-').map(Number);
  const sDate = new Date(startY, startM - 1, startD);
  const eDate = new Date(endY, endM - 1, endD);
  const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
  const dailyAverage = totalSpend / diffDays;

  // Category Breakdown calculations
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

  // 5. Draw Header & Branding
  // Top green accent bar
  doc.setFillColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Company Brand / Logo text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text('LedgerPulse', leftMargin, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('PERSONAL FINANCIAL INTELLIGENCE & EXPENSE TRACKING', leftMargin, 20.5);

  // Report Title Badge (Right-aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(primaryEmerald[0], primaryEmerald[1], primaryEmerald[2]);
  doc.text(config.title.toUpperCase(), pageWidth - rightMargin, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text(`Period: ${config.startDate} to ${config.endDate} (${diffDays} days)`, pageWidth - rightMargin, 20, {
    align: 'right',
  });
  doc.text(`Generated: ${new Date().toISOString().slice(0, 10)} ${new Date().toTimeString().slice(0, 5)} UTC`, pageWidth - rightMargin, 24, {
    align: 'right',
  });

  // Divider Line
  doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
  doc.setLineWidth(0.4);
  doc.line(leftMargin, 27, pageWidth - rightMargin, 27);

  // 6. Draw Executive KPI Cards (4 summary tiles across the page)
  const cardY = 32;
  const cardHeight = 18;
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
      sub: `Across ${diffDays} active days`,
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
      sub: `${config.currency} currency`,
      highlight: false,
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = leftMargin + idx * (cardWidth + cardGap);

    // Card background
    doc.setFillColor(bgSlate[0], bgSlate[1], bgSlate[2]);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.5, 1.5, 'F');

    // Card border
    doc.setDrawColor(kpi.highlight ? primaryEmerald[0] : borderSlate[0], kpi.highlight ? primaryEmerald[1] : borderSlate[1], kpi.highlight ? primaryEmerald[2] : borderSlate[2]);
    doc.setLineWidth(kpi.highlight ? 0.4 : 0.2);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.5, 1.5, 'S');

    // KPI Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text(kpi.label, x + 2.5, cardY + 5);

    // KPI Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(kpi.highlight ? 5 : darkSlate[0], kpi.highlight ? 150 : darkSlate[1], kpi.highlight ? 105 : darkSlate[2]);
    // Truncate long value if needed
    const truncatedValue = doc.splitTextToSize(kpi.value, cardWidth - 5)[0] || kpi.value;
    doc.text(truncatedValue, x + 2.5, cardY + 11);

    // KPI Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text(kpi.sub, x + 2.5, cardY + 15.5);
  });

  let currentY = cardY + cardHeight + 7;

  // 7. Optional Category Breakdown Summary Table
  if (config.includeCategoryBreakdown !== false && categoryBreakdown.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text('Category Allocation Summary', leftMargin, currentY);
    currentY += 2;

    const catRows = categoryBreakdown.map((c) => [
      c.category,
      c.count.toString(),
      formatPdfCurrency(c.total, config.currency),
      `${c.percentage.toFixed(1)}%`,
      formatPdfCurrency(c.total / diffDays, config.currency),
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: leftMargin, right: rightMargin },
      head: [['Expense Category', 'Transactions', 'Subtotal', '% of Portfolio', 'Daily Run-Rate']],
      body: catRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59], // slate-800
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

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // 8. Itemized Ledger Transactions Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
  doc.text(`Itemized Transaction Ledger (${transactionCount} records)`, leftMargin, currentY);
  currentY += 2;

  if (filtered.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text('No expense records found within this date period.', leftMargin, currentY + 6);
  } else {
    // Build row data with safe wrapping for notes & tags
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

    // Column widths strictly calibrated to 182mm printable width:
    // 22 + 38 + 28 + 24 + 46 + 24 = 182mm
    autoTable(doc, {
      startY: currentY,
      margin: { top: 25, bottom: 20, left: leftMargin, right: rightMargin },
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
        fillColor: [15, 23, 42], // slate-900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2.2,
      },
      footStyles: {
        fillColor: [241, 245, 249], // slate-100
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
        4: { cellWidth: 46 }, // Wraps lines smoothly without clipping
        5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didDrawPage: (data) => {
        // Running header on pages 2 and onwards
        if (data.pageNumber > 1) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
          doc.text(
            `LedgerPulse Spending Report • ${config.title} (${config.startDate} to ${config.endDate})`,
            leftMargin,
            14
          );
          doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
          doc.setLineWidth(0.2);
          doc.line(leftMargin, 16, pageWidth - rightMargin, 16);
        }
      },
    });
  }

  // 9. Running Footer with two-pass total page numbers
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);

    // Bottom border rule
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.setLineWidth(0.2);
    doc.line(leftMargin, pageHeight - 12, pageWidth - rightMargin, pageHeight - 12);

    // Left metadata footer
    doc.text(
      'CONFIDENTIAL • Generated by LedgerPulse Expense Intelligence • Valid Financial Document',
      leftMargin,
      pageHeight - 7.5
    );

    // Right page numbering
    doc.text(
      `Page ${page} of ${totalPages}`,
      pageWidth - rightMargin,
      pageHeight - 7.5,
      { align: 'right' }
    );
  }

  // 10. Generate Filename & Trigger Download
  const cleanTitle = config.period.toLowerCase();
  const filename = `LedgerPulse-${cleanTitle}-spendings-${config.startDate}_to_${config.endDate}.pdf`;
  doc.save(filename);

  return {
    success: true,
    filename,
    transactionCount,
    totalSpend,
  };
}
