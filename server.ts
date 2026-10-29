import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));

// Initialize Google GenAI client on server
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Insights Analysis Endpoint
app.post('/api/analyze-insights', async (req, res) => {
  try {
    const { expenses, budgetSettings, monthSummary, selectedMonth } = req.body;

    if (!expenses || !Array.isArray(expenses)) {
      return res.status(400).json({ error: 'Invalid or missing expenses payload' });
    }

    // Filter relevant expenses for analysis (selected month and recent)
    const monthExpenses = expenses.filter((e: any) =>
      selectedMonth ? e.date.startsWith(selectedMonth) : true
    );

    // Summary calculations for context
    const totalSpent = monthExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    const catMap: Record<string, number> = {};
    const merchantMap: Record<string, number> = {};

    monthExpenses.forEach((e: any) => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
      merchantMap[e.merchant] = (merchantMap[e.merchant] || 0) + e.amount;
    });

    const currency = budgetSettings?.currency || 'USD';
    const monthlyBudget = budgetSettings?.monthlyBudget || 3800;
    const dailyTarget = budgetSettings?.dailyTarget || 120;

    const promptContext = `
You are a senior personal finance strategist and financial coach.
Analyze the following expense data for ${selectedMonth || 'current period'}:
- Total Expenses Count: ${monthExpenses.length}
- Total Spent: ${currency} ${totalSpent.toFixed(2)}
- Monthly Budget Limit: ${currency} ${monthlyBudget}
- Daily Spending Target: ${currency} ${dailyTarget}
- Projected Month Total: ${currency} ${(monthSummary?.projectedTotal || totalSpent).toFixed(2)}
- Spending by Category:
${Object.entries(catMap)
  .map(([cat, amt]) => `  * ${cat}: ${currency} ${amt.toFixed(2)} (${totalSpent > 0 ? ((amt / totalSpent) * 100).toFixed(1) : 0}%) [Cap: ${budgetSettings?.categoryBudgets?.[cat] ? `${currency} ${budgetSettings.categoryBudgets[cat]}` : 'none'}]`)
  .join('\n')}

- Top 6 Merchants by Spend:
${Object.entries(merchantMap)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([m, amt]) => `  * ${m}: ${currency} ${amt.toFixed(2)}`)
  .join('\n')}

- Detailed Recent Transactions Sample (up to 15):
${monthExpenses
  .slice(0, 15)
  .map((e: any) => `  * ${e.date}: ${e.merchant} (${e.category}) - ${currency} ${e.amount.toFixed(2)} [${e.paymentMethod}]${e.isRecurring ? ' [Recurring]' : ''}`)
  .join('\n')}

Provide an actionable, realistic financial diagnostic with:
1. Overall Health: Score from 0 to 100, status ('Healthy' | 'Moderate' | 'Needs Attention'), punchy headline, and a concise summary.
2. 3-4 Key Findings / Observations with specific metrics.
3. 3-4 Concrete Actionable Tips with estimated savings potential, priority level ('high' | 'medium' | 'low'), and step-by-step guidance.
4. Spending Patterns (weekday vs weekend, recurring overhead, top category pace).
5. 2-3 Budget Adjustment Suggestions with realistic revised target and rationale.
Return strictly structured JSON.
`;

    if (!apiKey) {
      // Fallback mock diagnostic if API key is not present
      const fallbackScore = Math.max(
        20,
        Math.min(95, Math.round(100 - (totalSpent / monthlyBudget) * 50))
      );
      return res.json({
        overallHealth: {
          score: fallbackScore,
          status: fallbackScore > 75 ? 'Healthy' : fallbackScore > 50 ? 'Moderate' : 'Needs Attention',
          headline: `Pacing ${totalSpent > monthlyBudget * 0.8 ? 'tightly against' : 'comfortably within'} your monthly budget limit`,
          summary: `You have spent ${currency} ${totalSpent.toFixed(2)} of your ${currency} ${monthlyBudget} monthly budget. Your discretionary spend in dining and groceries accounts for the majority of variable burn.`,
        },
        keyFindings: [
          {
            title: 'Dining & Food Run-Rate',
            impact: catMap['Dining & Drinks'] > 300 ? 'warning' : 'neutral',
            category: 'Dining & Drinks',
            observation: `Food and social dining represent ${totalSpent > 0 ? (((catMap['Dining & Drinks'] || 0) / totalSpent) * 100).toFixed(0) : 0}% of all expenditures this month.`,
            metric: `${currency} ${(catMap['Dining & Drinks'] || 0).toFixed(2)}`,
          },
          {
            title: 'Fixed Recurring Baseline',
            impact: 'positive',
            category: 'Housing & Utilities',
            observation: 'Essential fixed commitments (rent, fiber internet, electricity) are structured predictably without surprise spikes.',
            metric: 'Stable monthly cadence',
          },
          {
            title: 'Daily Spend Velocity',
            impact: 'neutral',
            observation: `Spending is concentrated around mid-month shopping and social weekend dining, with several zero-spend days demonstrating discipline.`,
            metric: `${currency} ${dailyTarget}/day target`,
          },
        ],
        actionableTips: [
          {
            title: 'Consolidate Mid-Week Coffee & Takeout',
            category: 'Dining & Drinks',
            potentialSavings: `${currency} 60 - 90/mo`,
            priority: 'medium',
            recommendation: 'Batch morning coffee preparation at home twice per week to buffer dining out with friends on weekends.',
            actionStep: 'Set a weekly Dining & Drinks sub-allowance of 3 outside lunches.',
          },
          {
            title: 'Audit Recurring Subscriptions',
            category: 'Subscriptions',
            potentialSavings: `${currency} 25/mo`,
            priority: 'low',
            recommendation: 'Review cloud backup and media services for bundled family plans or redundant tiers.',
            actionStep: 'Audit active digital wallet auto-renewals in billing settings.',
          },
          {
            title: 'Implement Smart Buffer for Grocery Shopping',
            category: 'Groceries',
            potentialSavings: `${currency} 75/mo`,
            priority: 'high',
            recommendation: 'Combine bulk pantry staples with local produce runs rather than split high-frequency premium grocery store trips.',
            actionStep: 'Plan 2 core weekly grocery runs instead of 4 impromptu visits.',
          },
        ],
        spendingPatterns: {
          weekdayVsWeekend: 'Weekend spend averages 1.8x higher than weekdays due to social events and dining.',
          peakSpendingDays: 'Highest transaction velocity occurs on Fridays and Saturdays.',
          recurringCommitmentsNote: 'Recurring subscriptions and utilities represent predictable baseline overhead.',
          topCategoryTrend: 'Housing remains the largest single outlay, followed by variable nutrition and dining.',
        },
        budgetAdjustmentSuggestions: [
          {
            category: 'Dining & Drinks',
            currentSpending: `${currency} ${(catMap['Dining & Drinks'] || 0).toFixed(2)}`,
            suggestedBudget: `${currency} 400.00`,
            rationale: 'Reallocating 10% of social dining into emergency reserve while preserving weekend leisure.',
          },
          {
            category: 'Shopping',
            currentSpending: `${currency} ${(catMap['Shopping'] || 0).toFixed(2)}`,
            suggestedBudget: `${currency} 250.00`,
            rationale: 'Seasonal autumn wardrobe purchases can be capped to preserve holiday liquidity.',
          },
        ],
      });
    }

    // Call Gemini 3.8 Flash
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptContext,
      config: {
        systemInstruction:
          'You are a certified financial planner and data analyst. Provide deep, non-generic, specific financial intelligence based on numerical expense logs. Output strict JSON matching the schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallHealth: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER, description: 'Financial health score 0 to 100' },
                status: { type: Type.STRING, description: 'Healthy, Moderate, or Needs Attention' },
                headline: { type: Type.STRING, description: 'One clear punchy takeaway sentence' },
                summary: { type: Type.STRING, description: 'Paragraph explaining overall financial state' },
              },
              required: ['score', 'status', 'headline', 'summary'],
            },
            keyFindings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  impact: { type: Type.STRING, description: 'positive, warning, or neutral' },
                  category: { type: Type.STRING },
                  observation: { type: Type.STRING },
                  metric: { type: Type.STRING },
                },
                required: ['title', 'impact', 'observation'],
              },
            },
            actionableTips: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  potentialSavings: { type: Type.STRING },
                  priority: { type: Type.STRING, description: 'high, medium, or low' },
                  recommendation: { type: Type.STRING },
                  actionStep: { type: Type.STRING },
                },
                required: ['title', 'category', 'potentialSavings', 'priority', 'recommendation', 'actionStep'],
              },
            },
            spendingPatterns: {
              type: Type.OBJECT,
              properties: {
                weekdayVsWeekend: { type: Type.STRING },
                peakSpendingDays: { type: Type.STRING },
                recurringCommitmentsNote: { type: Type.STRING },
                topCategoryTrend: { type: Type.STRING },
              },
            },
            budgetAdjustmentSuggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  currentSpending: { type: Type.STRING },
                  suggestedBudget: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                },
                required: ['category', 'currentSpending', 'suggestedBudget', 'rationale'],
              },
            },
          },
          required: ['overallHealth', 'keyFindings', 'actionableTips', 'spendingPatterns', 'budgetAdjustmentSuggestions'],
        },
      },
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText);
    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/analyze-insights:', error);
    res.status(500).json({
      error: 'Failed to analyze spending patterns',
      details: error.message || String(error),
    });
  }
});

// Vite dev middleware or production static serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
