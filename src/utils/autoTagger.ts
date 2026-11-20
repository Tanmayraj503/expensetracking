import { Expense, ExpenseCategory } from '../types';

export interface TagPrediction {
  tag: string;
  confidence: number; // 0..1
  reason: string;
  source: 'learned' | 'semantic' | 'hybrid';
}

interface TagModelStats {
  tag: string;
  canonicalTag: string;
  docCount: number;
  tokenCounts: Map<string, number>;
  totalTokens: number;
  trigramCounts: Map<string, number>;
  totalTrigrams: number;
  categoryCounts: Map<ExpenseCategory, number>;
  logAmounts: number[];
  logAmountMean: number;
  logAmountStd: number;
  avgAmount: number;
}

export interface ExpenseAutoTagModel {
  totalLabeledDocs: number;
  vocabSize: number;
  trigramVocabSize: number;
  tags: Map<string, TagModelStats>;
  merchantIndex: Map<string, Map<string, number>>; // normalized merchant -> tagKey -> count
  categoryAvgAmounts: Map<ExpenseCategory, number>;
  globalAvgAmount: number;
  canonicalCaseMap: Map<string, string>; // lowercase tag -> preferred casing
}

interface SemanticRule {
  tag: string;
  keywords: string[];
  strongKeywords?: string[];
  categories?: ExpenseCategory[];
  minAmount?: number;
  highAmountBoost?: number;
  amountRange?: [number, number];
  reasonLabel: string;
}

const SEMANTIC_TAG_RULES: SemanticRule[] = [
  {
    tag: 'urgent',
    keywords: [
      'urgent',
      'emergency',
      'express',
      'overnight',
      'same day',
      'sameday',
      'rush',
      'priority',
      'er',
      'clinic',
      'hospital',
      'ambulance',
      'locksmith',
      'tow',
      'towing',
      'repair',
      'plumber',
      'plumbing',
      'electrician',
      'pharmacy',
      'cvs',
      'walgreens',
      'late fee',
      'penalty',
      'instant',
    ],
    strongKeywords: ['urgent', 'emergency', 'locksmith', 'towing', 'ambulance', 'rush', 'overnight', 'er'],
    minAmount: 180,
    highAmountBoost: 0.22,
    reasonLabel: 'Urgency & priority signal',
  },
  {
    tag: 'business',
    keywords: [
      'business',
      'client',
      'office',
      'coworking',
      'wework',
      'regus',
      'fedex',
      'ups',
      'dhl',
      'print',
      'staples',
      'aws',
      'google cloud',
      'azure',
      'github',
      'figma',
      'notion',
      'slack',
      'zoom',
      'adobe',
      'linkedin',
      'domain',
      'hosting',
      'conference',
      'consulting',
      'corporate',
      'invoice',
      'b2b',
      'software',
      'saas',
    ],
    strongKeywords: ['client', 'wework', 'coworking', 'aws', 'figma', 'slack', 'zoom', 'conference', 'consulting', 'fedex'],
    categories: ['Subscriptions', 'Travel'],
    minAmount: 35,
    reasonLabel: 'Business & client expense pattern',
  },
  {
    tag: 'travel',
    keywords: [
      'airline',
      'airlines',
      'airways',
      'flight',
      'delta',
      'united',
      'american airlines',
      'southwest',
      'jetblue',
      'lufthansa',
      'emirates',
      'hotel',
      'marriott',
      'hilton',
      'hyatt',
      'airbnb',
      'vrbo',
      'expedia',
      'booking',
      'kayak',
      'airport',
      'luggage',
      'baggage',
      'amtrak',
      'rail',
      'eurostar',
      'hertz',
      'avis',
      'enterprise',
      'rental car',
      'passport',
      'visa',
      'resort',
      'hostel',
      'uber airport',
    ],
    strongKeywords: ['airline', 'airlines', 'flight', 'delta', 'united', 'hotel', 'marriott', 'hilton', 'airbnb', 'airport', 'expedia', 'amtrak'],
    categories: ['Travel'],
    minAmount: 60,
    reasonLabel: 'Travel & lodging classifier',
  },
  {
    tag: 'Work',
    keywords: [
      'commute',
      'metro',
      'transit',
      'bart',
      'caltrain',
      'subway',
      'parking',
      'toll',
      'desk',
      'monitor',
      'ergonomic',
      'laptop',
      'keyboard',
      'office',
      'workspace',
      'internet',
      'fiber',
    ],
    strongKeywords: ['commute', 'metro', 'transit', 'workspace', 'coworking'],
    categories: ['Transportation'],
    reasonLabel: 'Work & commute pattern',
  },
  {
    tag: 'Essential',
    keywords: [
      'grocery',
      'groceries',
      'market',
      'trader joe',
      'whole foods',
      'safeway',
      'kroger',
      'costco',
      'aldi',
      'sprouts',
      'rent',
      'lease',
      'mortgage',
      'electric',
      'water',
      'gas',
      'utility',
      'utilities',
      'internet',
      'pg&e',
      'insurance',
      'medical',
    ],
    strongKeywords: ['grocery', 'trader joe', 'whole foods', 'rent', 'mortgage', 'pg&e', 'electric', 'water'],
    categories: ['Groceries', 'Housing', 'Utilities'],
    reasonLabel: 'Essential living expense',
  },
  {
    tag: 'Personal',
    keywords: [
      'coffee',
      'cafe',
      'latte',
      'bistro',
      'restaurant',
      'ramen',
      'sushi',
      'pizza',
      'bakery',
      'cinema',
      'movie',
      'concert',
      'uniqlo',
      'zara',
      'nike',
      'spotify',
      'netflix',
      'gym',
      'climbing',
      'yoga',
      'salon',
      'barber',
    ],
    categories: ['Dining & Drinks', 'Entertainment', 'Shopping', 'Health & Fitness'],
    amountRange: [5, 160],
    reasonLabel: 'Personal lifestyle spend',
  },
  {
    tag: 'Tax',
    keywords: [
      'tax',
      'irs',
      'turbotax',
      'cpa',
      'accountant',
      'accounting',
      'donation',
      'charity',
      'receipt',
      'deductible',
      'equipment',
    ],
    strongKeywords: ['tax', 'irs', 'turbotax', 'cpa', 'accountant', 'donation'],
    minAmount: 50,
    reasonLabel: 'Potential tax-deductible record',
  },
  {
    tag: 'Wellness',
    keywords: [
      'gym',
      'fitness',
      'climbing',
      'yoga',
      'pilates',
      'equinox',
      'peloton',
      'spa',
      'massage',
      'therapy',
      'dental',
      'dentist',
      'optometry',
      'vitamin',
      'supplement',
    ],
    strongKeywords: ['gym', 'fitness', 'yoga', 'pilates', 'equinox', 'peloton', 'dentist'],
    categories: ['Health & Fitness'],
    reasonLabel: 'Health & wellness activity',
  },
  {
    tag: 'Savings',
    keywords: ['savings', 'deposit', 'stash', 'reserve', 'transfer', 'high-yield', 'investment', 'vanguard', 'fidelity'],
    strongKeywords: ['savings', 'deposit', 'stash', 'reserve', 'high-yield'],
    minAmount: 100,
    reasonLabel: 'Savings & reserve transfer',
  },
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  const norm = normalizeText(text);
  if (!norm) return [];
  return norm.split(' ').filter((w) => w.length >= 2);
}

function extractTrigrams(text: string): string[] {
  const norm = normalizeText(text).replace(/\s+/g, '_');
  if (norm.length < 3) return norm ? [norm] : [];
  const grams: string[] = [];
  for (let i = 0; i <= norm.length - 3; i++) {
    grams.push(norm.slice(i, i + 3));
  }
  return grams;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasKeywordMatch(normMerchant: string, keyword: string): boolean {
  const normKw = normalizeText(keyword);
  if (!normKw) return false;
  const pattern = new RegExp(`(?:^|\\s)${escapeRegex(normKw)}(?:$|\\s)`);
  return pattern.test(normMerchant);
}

/**
 * Trains an in-memory multi-label ML model (Multinomial Naive Bayes over word & char-trigram
 * features + Gaussian log-amount likelihood + category conditional priors + merchant memory)
 * directly from the user's historical labeled expense records.
 */
export function trainExpenseTagModel(expenses: Expense[]): ExpenseAutoTagModel {
  const tags = new Map<string, TagModelStats>();
  const merchantIndex = new Map<string, Map<string, number>>();
  const canonicalCaseMap = new Map<string, string>();
  const vocabSet = new Set<string>();
  const trigramSet = new Set<string>();

  const catTotals = new Map<ExpenseCategory, { sum: number; count: number }>();
  let globalSum = 0;
  let globalCount = 0;
  let totalLabeledDocs = 0;

  for (const exp of expenses) {
    const amt = Number(exp.amount) || 0;
    if (amt > 0) {
      globalSum += amt;
      globalCount += 1;
      const cs = catTotals.get(exp.category) || { sum: 0, count: 0 };
      catTotals.set(exp.category, { sum: cs.sum + amt, count: cs.count + 1 });
    }

    if (!exp.tags || exp.tags.length === 0) continue;
    totalLabeledDocs += 1;

    const normMerchant = normalizeText(exp.merchant || '');
    const tokens = tokenize(`${exp.merchant || ''} ${exp.notes || ''}`);
    const trigrams = extractTrigrams(exp.merchant || '');
    const logAmt = Math.log1p(Math.max(0, amt));

    for (const rawTag of exp.tags) {
      const clean = rawTag.trim().replace(/^#/, '');
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!canonicalCaseMap.has(key)) {
        canonicalCaseMap.set(key, clean);
      }

      let st = tags.get(key);
      if (!st) {
        st = {
          tag: key,
          canonicalTag: canonicalCaseMap.get(key) || clean,
          docCount: 0,
          tokenCounts: new Map(),
          totalTokens: 0,
          trigramCounts: new Map(),
          totalTrigrams: 0,
          categoryCounts: new Map(),
          logAmounts: [],
          logAmountMean: 0,
          logAmountStd: 1,
          avgAmount: 0,
        };
        tags.set(key, st);
      }

      st.docCount += 1;
      st.categoryCounts.set(exp.category, (st.categoryCounts.get(exp.category) || 0) + 1);
      st.logAmounts.push(logAmt);
      st.avgAmount += amt;

      for (const tok of tokens) {
        vocabSet.add(tok);
        st.tokenCounts.set(tok, (st.tokenCounts.get(tok) || 0) + 1);
        st.totalTokens += 1;
      }

      for (const tri of trigrams) {
        trigramSet.add(tri);
        st.trigramCounts.set(tri, (st.trigramCounts.get(tri) || 0) + 1);
        st.totalTrigrams += 1;
      }

      if (normMerchant) {
        const mTags = merchantIndex.get(normMerchant) || new Map<string, number>();
        mTags.set(key, (mTags.get(key) || 0) + 1);
        merchantIndex.set(normMerchant, mTags);
      }
    }
  }

  // Finalize Gaussian log-amount parameters per tag
  for (const st of tags.values()) {
    const n = st.logAmounts.length || 1;
    st.avgAmount = st.avgAmount / n;
    const mean = st.logAmounts.reduce((s, v) => s + v, 0) / n;
    const variance =
      st.logAmounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / Math.max(1, n);
    st.logAmountMean = mean;
    // Floor std dev to avoid over-penalizing tags with identical sample amounts
    st.logAmountStd = Math.max(0.45, Math.sqrt(variance));
  }

  const categoryAvgAmounts = new Map<ExpenseCategory, number>();
  for (const [cat, stats] of catTotals.entries()) {
    categoryAvgAmounts.set(cat, stats.count > 0 ? stats.sum / stats.count : 0);
  }

  return {
    totalLabeledDocs,
    vocabSize: Math.max(1, vocabSet.size),
    trigramVocabSize: Math.max(1, trigramSet.size),
    tags,
    merchantIndex,
    categoryAvgAmounts,
    globalAvgAmount: globalCount > 0 ? globalSum / globalCount : 65,
    canonicalCaseMap,
  };
}

/**
 * Predicts relevant expense tags with calibrated confidence scores based on
 * merchant name, amount, and category using both learned historical Naive Bayes +
 * Gaussian amount distributions and semantic domain classifiers.
 */
export function predictExpenseTags(
  model: ExpenseAutoTagModel,
  input: {
    merchant: string;
    amount: number | string;
    category?: ExpenseCategory;
    existingTags?: string[];
  },
  limit: number = 5
): TagPrediction[] {
  const rawMerchant = input.merchant || '';
  const normMerchant = normalizeText(rawMerchant);
  const parsedAmount =
    typeof input.amount === 'number' ? input.amount : parseFloat(String(input.amount || '0')) || 0;

  if (normMerchant.length < 2 && parsedAmount <= 0) {
    return [];
  }

  const existingSet = new Set(
    (input.existingTags || []).map((t) => t.trim().replace(/^#/, '').toLowerCase())
  );

  const tokens = tokenize(rawMerchant);
  const trigrams = extractTrigrams(rawMerchant);
  const logAmt = parsedAmount > 0 ? Math.log1p(parsedAmount) : null;

  const candidateScores = new Map<
    string,
    {
      displayTag: string;
      learnedScore: number;
      semanticScore: number;
      reasons: string[];
    }
  >();

  const upsertCandidate = (
    key: string,
    displayTag: string,
    learnedDelta: number,
    semanticDelta: number,
    reason?: string
  ) => {
    const preferred = model.canonicalCaseMap.get(key) || displayTag;
    const prev = candidateScores.get(key) || {
      displayTag: preferred,
      learnedScore: 0,
      semanticScore: 0,
      reasons: [],
    };
    prev.learnedScore = Math.max(prev.learnedScore, learnedDelta);
    prev.semanticScore = Math.max(prev.semanticScore, semanticDelta);
    if (reason && !prev.reasons.includes(reason)) {
      prev.reasons.push(reason);
    }
    candidateScores.set(key, prev);
  };

  // --------------------------------------------------------------------------
  // 1. Learned Statistical / ML Model Scoring (Naive Bayes + Amount Gaussian)
  // --------------------------------------------------------------------------
  if (model.totalLabeledDocs > 0) {
    const exactMerchantMatches = normMerchant ? model.merchantIndex.get(normMerchant) : undefined;

    for (const [tagKey, stats] of model.tags.entries()) {
      let score = 0;
      const reasons: string[] = [];

      // Exact historical merchant memory boost
      if (exactMerchantMatches && exactMerchantMatches.has(tagKey)) {
        const hitCount = exactMerchantMatches.get(tagKey) || 0;
        const totalForMerchant = Array.from(exactMerchantMatches.values()).reduce((a, b) => a + b, 0);
        const ratio = hitCount / Math.max(1, totalForMerchant);
        score += 0.55 + 0.35 * ratio;
        reasons.push('Exact merchant history');
      } else if (normMerchant.length >= 2) {
        // Multinomial Naive Bayes over word tokens + character trigrams
        let tokenHits = 0;
        let nbTokenScore = 0;
        for (const tok of tokens) {
          const count = stats.tokenCounts.get(tok) || 0;
          if (count > 0) tokenHits++;
          const likelihood = (count + 0.5) / (stats.totalTokens + 0.5 * model.vocabSize);
          const baseline = 0.5 / (model.totalLabeledDocs * 3 + 0.5 * model.vocabSize);
          nbTokenScore += Math.max(0, Math.log(likelihood / baseline)) * 0.14;
        }

        // Character trigram overlap for partial/fuzzy merchant matching
        let triOverlap = 0;
        if (trigrams.length > 0 && stats.totalTrigrams > 0) {
          for (const tri of trigrams) {
            if (stats.trigramCounts.has(tri)) triOverlap++;
          }
          const triRatio = triOverlap / trigrams.length;
          if (triRatio >= 0.35) {
            score += Math.min(0.45, triRatio * 0.55);
            reasons.push('Similar merchant name');
          }
        }

        if (tokenHits > 0) {
          score += Math.min(0.62, nbTokenScore + tokenHits * 0.12);
          if (!reasons.includes('Similar merchant name')) {
            reasons.push('Merchant keyword match');
          }
        }
      }

      // Gaussian log-amount likelihood (requires merchant or category signal or strong amount fit)
      if (logAmt !== null && stats.logAmounts.length > 0) {
        const z = Math.abs(logAmt - stats.logAmountMean) / stats.logAmountStd;
        const gaussianFit = Math.exp(-0.5 * z * z); // 0..1
        // Weight amount likelihood stronger when merchant/category also aligns, or for clear amount tiers
        if (score > 0.15) {
          score += gaussianFit * 0.18;
          if (gaussianFit >= 0.65) reasons.push('Matches spend amount');
        } else if (gaussianFit >= 0.8 && stats.docCount >= 2 && parsedAmount >= 80) {
          score += gaussianFit * 0.25;
          reasons.push('Amount tier match');
        }
      }

      // Category conditional probability P(tag | category)
      if (input.category && stats.categoryCounts.has(input.category)) {
        const catCount = stats.categoryCounts.get(input.category) || 0;
        const catRatio = catCount / stats.docCount;
        if (score > 0 || normMerchant.length >= 2) {
          score += Math.min(0.24, catRatio * 0.26);
        }
      }

      // Prior dampening for overly generic tags unless reinforced
      const prior = stats.docCount / Math.max(1, model.totalLabeledDocs);
      if (score > 0.25) {
        score += Math.min(0.08, prior * 0.1);
      }

      if (score >= 0.36) {
        upsertCandidate(tagKey, stats.canonicalTag, Math.min(0.97, score), 0, reasons[0] || 'Learned pattern');
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. Semantic Lexical + Amount-Anomaly Feature Layer (Cold-Start & Explicit Tags)
  // --------------------------------------------------------------------------
  for (const rule of SEMANTIC_TAG_RULES) {
    const key = rule.tag.toLowerCase();
    let semScore = 0;
    const reasons: string[] = [];

    if (normMerchant.length >= 2) {
      let keywordHits = 0;
      let strongHit = false;

      for (const kw of rule.keywords) {
        if (hasKeywordMatch(normMerchant, kw)) {
          keywordHits++;
          if (rule.strongKeywords?.some((sk) => normalizeText(sk) === normalizeText(kw))) {
            strongHit = true;
          }
        }
      }

      if (keywordHits > 0) {
        semScore += strongHit ? 0.72 : 0.48;
        semScore += Math.min(0.18, (keywordHits - 1) * 0.1);
        reasons.push(rule.reasonLabel);
      }
    }

    // Category hint
    if (input.category && rule.categories?.includes(input.category)) {
      if (semScore > 0 || normMerchant.length >= 2) {
        semScore += semScore > 0 ? 0.12 : 0.34;
        if (reasons.length === 0) reasons.push(`${input.category} category pattern`);
      }
    }

    // Amount-based feature signals (e.g., high-value urgent spend, travel ticket size, business spend)
    if (parsedAmount > 0) {
      if (rule.minAmount && parsedAmount >= rule.minAmount) {
        if (semScore > 0) {
          semScore += rule.highAmountBoost || 0.12;
          reasons.push('Amount threshold fit');
        } else if (key === 'urgent') {
          const catAvg = input.category
            ? model.categoryAvgAmounts.get(input.category) || model.globalAvgAmount
            : model.globalAvgAmount;
          const isUnusuallyHigh = parsedAmount >= Math.max(220, catAvg * 2.2);
          if (isUnusuallyHigh) {
            semScore += 0.52;
            reasons.push('Unusually high amount');
          }
        }
      }

      if (
        rule.amountRange &&
        parsedAmount >= rule.amountRange[0] &&
        parsedAmount <= rule.amountRange[1] &&
        semScore > 0
      ) {
        semScore += 0.08;
      }
    }

    if (semScore >= 0.4) {
      const existing = candidateScores.get(key);
      upsertCandidate(
        key,
        rule.tag,
        existing?.learnedScore || 0,
        Math.min(0.96, semScore),
        reasons[0] || rule.reasonLabel
      );
    }
  }

  // Extra amount-anomaly rule: high-ticket transaction marker
  if (parsedAmount >= 250) {
    const catAvg = input.category
      ? model.categoryAvgAmounts.get(input.category) || model.globalAvgAmount
      : model.globalAvgAmount;
    if (parsedAmount >= Math.max(250, catAvg * 2.0) && !candidateScores.has('urgent')) {
      upsertCandidate('urgent', 'urgent', 0, 0.56, 'High-value transaction');
    }
  }

  // --------------------------------------------------------------------------
  // 3. Fuse Hybrid Scores, Filter Existing Tags, & Rank
  // --------------------------------------------------------------------------
  const predictions: TagPrediction[] = [];
  for (const [key, entry] of candidateScores.entries()) {
    if (existingSet.has(key)) continue;

    let finalConf = 0;
    let source: TagPrediction['source'] = 'semantic';

    if (entry.learnedScore > 0 && entry.semanticScore > 0) {
      finalConf = Math.min(0.98, Math.max(entry.learnedScore, entry.semanticScore) + 0.08);
      source = 'hybrid';
    } else if (entry.learnedScore > 0) {
      finalConf = entry.learnedScore;
      source = 'learned';
    } else {
      finalConf = entry.semanticScore;
      source = 'semantic';
    }

    if (finalConf >= 0.42) {
      predictions.push({
        tag: entry.displayTag,
        confidence: Math.round(finalConf * 100) / 100,
        reason: entry.reasons[0] || 'Predicted from merchant & amount',
        source,
      });
    }
  }

  return predictions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}
