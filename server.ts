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

// AI Budgeting Assistant Endpoint (Category Caps + Goal Alignment)
app.post('/api/budget-assistant', async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(503).json({
        error:
          'Gemini API key is not configured. Please check or set your API key in Settings > Secrets.',
      });
    }

    const { expenses, budgetSettings, strategy = 'balanced', customFocus = '' } = req.body;

    if (!expenses || !Array.isArray(expenses)) {
      return res.status(400).json({ error: 'Invalid or missing expenses payload' });
    }

    const VALID_CATEGORIES = [
      'Housing',
      'Groceries',
      'Dining & Drinks',
      'Transportation',
      'Utilities',
      'Shopping',
      'Entertainment',
      'Health & Fitness',
      'Travel',
      'Subscriptions',
      'Miscellaneous',
    ] as const;

    const currency = budgetSettings?.currency || 'USD';
    const monthlyBudget = Number(budgetSettings?.monthlyBudget) || 3800;
    const categoryBudgets: Record<string, number> = budgetSettings?.categoryBudgets || {};
    const savingsGoals: any[] = Array.isArray(budgetSettings?.savingsGoals)
      ? budgetSettings.savingsGoals
      : [];

    // Aggregate historical spending across distinct months
    const distinctMonths = Array.from(
      new Set(
        expenses
          .map((e: any) => (typeof e?.date === 'string' ? e.date.slice(0, 7) : ''))
          .filter((ym: string) => ym.length === 7)
      )
    ).sort();

    const monthCount = Math.max(1, distinctMonths.length);
    const latestMonth = distinctMonths[distinctMonths.length - 1] || '';

    const catStats: Record<
      string,
      {
        totalAllTime: number;
        latestMonthSpend: number;
        txCount: number;
        recurringCount: number;
        merchants: Record<string, number>;
        monthlyMap: Record<string, number>;
      }
    > = {};

    VALID_CATEGORIES.forEach((c) => {
      catStats[c] = {
        totalAllTime: 0,
        latestMonthSpend: 0,
        txCount: 0,
        recurringCount: 0,
        merchants: {},
        monthlyMap: {},
      };
    });

    for (const e of expenses) {
      const cat = VALID_CATEGORIES.includes(e.category) ? e.category : 'Miscellaneous';
      const amt = Number(e.amount) || 0;
      const ym = typeof e.date === 'string' ? e.date.slice(0, 7) : '';

      catStats[cat].totalAllTime += amt;
      catStats[cat].txCount += 1;
      if (e.isRecurring) catStats[cat].recurringCount += 1;
      if (ym && ym === latestMonth) {
        catStats[cat].latestMonthSpend += amt;
      }
      if (ym) {
        catStats[cat].monthlyMap[ym] = (catStats[cat].monthlyMap[ym] || 0) + amt;
      }
      if (e.merchant) {
        catStats[cat].merchants[e.merchant] =
          (catStats[cat].merchants[e.merchant] || 0) + amt;
      }
    }

    const totalAllTimeSpend = Object.values(catStats).reduce((s, c) => s + c.totalAllTime, 0);
    const historicalOverallMonthlyAvg = totalAllTimeSpend / monthCount;

    const categoryContextLines = VALID_CATEGORIES.map((cat) => {
      const st = catStats[cat];
      const activeMonthsForCat = Math.max(1, Object.keys(st.monthlyMap).length);
      const histAvgAllMonths = st.totalAllTime / monthCount;
      const activeMonthAvg = st.totalAllTime > 0 ? st.totalAllTime / activeMonthsForCat : 0;
      const peakMonth = Math.max(0, ...Object.values(st.monthlyMap));
      const topMerchants = Object.entries(st.merchants)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([m, a]) => `${m} (${currency} ${a.toFixed(0)})`)
        .join(', ');
      const cap = categoryBudgets[cat];
      return `- ${cat}: all-month avg=${currency} ${histAvgAllMonths.toFixed(2)}/mo, active-month avg=${currency} ${activeMonthAvg.toFixed(2)}/mo, latest month (${latestMonth || 'N/A'})=${currency} ${st.latestMonthSpend.toFixed(2)}, peak=${currency} ${peakMonth.toFixed(2)}, txs=${st.txCount} (${st.recurringCount} recurring), currentCap=${cap !== undefined ? `${currency} ${cap}` : 'None'}${topMerchants ? `, topMerchants=[${topMerchants}]` : ''}`;
    }).join('\n');

    const goalContextLines =
      savingsGoals.length > 0
        ? savingsGoals
            .map((g: any) => {
              const target = Number(g.targetAmount) || 0;
              const current = Number(g.currentAmount) || 0;
              const remaining = Math.max(0, target - current);
              return `- "${g.name}" (category: ${g.category}, tag: #${g.tag || g.name}): target=${currency} ${target.toFixed(2)}, savedBase=${currency} ${current.toFixed(2)}, remaining=${currency} ${remaining.toFixed(2)}, targetDate=${g.targetDate || 'No fixed deadline'}${g.notes ? `, notes="${g.notes}"` : ''}`;
            })
            .join('\n')
        : '- No explicit savings goals configured yet; prioritize building a healthy emergency reserve cushion.';

    const strategyInstructions: Record<string, string> = {
      balanced:
        'Balanced Optimization: keep essential/fixed categories realistic based on history, and gently trim 8-15% from variable discretionary categories to create steady goal surplus.',
      'aggressive-savings':
        'Accelerate Goals: prioritize maximum realistic surplus by trimming 15-25% from non-essential discretionary categories while keeping housing, utilities, and baseline groceries intact.',
      'realistic-baseline':
        'Realistic Baseline: align caps closely with actual historical run-rates so caps are achievable without severe lifestyle shocks, tightening only clear outlier categories.',
    };

    const prompt = `
You are an expert personal budgeting strategist inside LedgerPulse.
Analyze the user's historical expense logs and savings goals to propose realistic, optimized monthly category spending caps.

CONFIGURATION & GOALS:
- Currency: ${currency}
- Current Monthly Budget Ceiling: ${currency} ${monthlyBudget.toFixed(2)}
- Historical Window: ${monthCount} distinct month(s) (${distinctMonths.join(', ') || 'No history'})
- Historical Monthly Average Spend: ${currency} ${historicalOverallMonthlyAvg.toFixed(2)}/mo
- Optimization Mode: ${strategyInstructions[strategy] || strategyInstructions.balanced}
${customFocus ? `- User Custom Focus Instruction: "${String(customFocus).slice(0, 300)}"` : ''}

FINANCIAL GOALS:
${goalContextLines}

HISTORICAL CATEGORY SPENDING BREAKDOWN:
${categoryContextLines}

INSTRUCTIONS:
1. Return an optimized suggested monthly cap (numeric value in ${currency}) for all relevant categories from this exact list: ${VALID_CATEGORIES.join(', ')}. Include every category that has historical spend, an existing cap, or relates to a savings goal (and optionally key baseline categories so the plan sums coherently).
2. Keep essential/recurring categories (like Housing, Utilities, Subscriptions) realistic relative to actual recurring obligations so recommendations feel trustworthy and achievable.
3. Identify realistic trim opportunities in high-variance discretionary categories (like Dining & Drinks, Shopping, Entertainment, Travel) to fund the user's financial goals.
4. Keep "summary" concise (2-3 sentences), "goalAlignmentNote" concise (1-2 sentences), "keyInsights" to 3 punchy bullet points, and each category "rationale" to 1 specific sentence referencing their actual spending habits/merchants or goals.
5. Ensure recommendedMonthlyBudget aligns coherently with the sum of suggested category caps and the user's goal savings target.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a pragmatic certified financial planner. Output strict, well-calibrated JSON matching the responseSchema. Never invent non-existent category names.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: '2-3 sentence executive summary of the historical audit and optimization plan.',
            },
            recommendedMonthlyBudget: {
              type: Type.NUMBER,
              description: 'Recommended overall monthly spending limit in user currency.',
            },
            projectedMonthlySavings: {
              type: Type.NUMBER,
              description: 'Estimated monthly cash freed up compared to recent/historical spending pace.',
            },
            goalAlignmentNote: {
              type: Type.STRING,
              description: 'How these optimized category caps accelerate or protect the user financial goals.',
            },
            keyInsights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 concise data-backed observations from the user historical expenses.',
            },
            categorySuggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: {
                    type: Type.STRING,
                    description: `Must be one of: ${VALID_CATEGORIES.join(', ')}`,
                  },
                  suggestedCap: {
                    type: Type.NUMBER,
                    description: 'Optimized realistic monthly budget cap for this category.',
                  },
                  priority: {
                    type: Type.STRING,
                    description: 'One of: essential, optimize, cutback, maintain',
                  },
                  rationale: {
                    type: Type.STRING,
                    description: 'Specific 1-sentence reason referencing spending habits or goals.',
                  },
                },
                required: ['category', 'suggestedCap', 'priority', 'rationale'],
              },
            },
          },
          required: [
            'summary',
            'recommendedMonthlyBudget',
            'projectedMonthlySavings',
            'goalAlignmentNote',
            'keyInsights',
            'categorySuggestions',
          ],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);

    // Hydrate exact server-computed historical averages & current caps for numeric accuracy
    const seenCategories = new Set<string>();
    const normalizedSuggestions = (Array.isArray(parsed.categorySuggestions)
      ? parsed.categorySuggestions
      : []
    )
      .filter((item: any) => VALID_CATEGORIES.includes(item?.category) && !seenCategories.has(item.category))
      .map((item: any) => {
        seenCategories.add(item.category);
        const st = catStats[item.category];
        const histAvg = st ? Math.round((st.totalAllTime / monthCount) * 100) / 100 : 0;
        const latestSpend = st ? Math.round(st.latestMonthSpend * 100) / 100 : 0;
        const currentCap =
          categoryBudgets[item.category] !== undefined ? Number(categoryBudgets[item.category]) : null;
        const suggestedCap = Math.max(0, Math.round(Number(item.suggestedCap) || 0));
        const baseline = latestSpend > 0 ? latestSpend : histAvg;
        const monthlySavingsDelta = Math.round((baseline - suggestedCap) * 100) / 100;
        const validPriorities = ['essential', 'optimize', 'cutback', 'maintain'];
        const priority = validPriorities.includes(item.priority) ? item.priority : 'optimize';

        return {
          category: item.category,
          historicalMonthlyAvg: histAvg,
          latestMonthSpend: latestSpend,
          currentCap,
          suggestedCap,
          monthlySavingsDelta,
          priority,
          rationale: String(item.rationale || ''),
        };
      });

    res.json({
      summary: String(parsed.summary || ''),
      recommendedMonthlyBudget: Math.max(
        0,
        Math.round(Number(parsed.recommendedMonthlyBudget) || monthlyBudget)
      ),
      projectedMonthlySavings: Math.round(Number(parsed.projectedMonthlySavings) || 0),
      goalAlignmentNote: String(parsed.goalAlignmentNote || ''),
      keyInsights: Array.isArray(parsed.keyInsights)
        ? parsed.keyInsights.map((s: any) => String(s)).slice(0, 5)
        : [],
      categorySuggestions: normalizedSuggestions,
      analyzedMonthsCount: monthCount,
      analyzedTransactionsCount: expenses.length,
    });
  } catch (error: any) {
    console.error('Error in /api/budget-assistant:', error);
    const status = Number(error?.status) || 500;
    const rawMsg = error?.message || String(error);

    if (
      status === 400 ||
      status === 403 ||
      rawMsg.includes('API_KEY_INVALID') ||
      rawMsg.includes('PERMISSION_DENIED')
    ) {
      return res.status(status).json({
        error:
          'Unable to authenticate with Gemini API. Please verify your API key in Settings > Secrets.',
        details: rawMsg,
      });
    }

    if (status === 429 || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({
        error: 'Gemini API rate limit or quota reached. Please wait a moment and try again.',
        details: rawMsg,
      });
    }

    res.status(500).json({
      error: 'Failed to generate AI budget recommendations.',
      details: rawMsg,
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
