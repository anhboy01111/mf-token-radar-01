// Titan Farm Optimizer — Autonomous yield-farming strategy engine
// Authored fresh by Antigravity Agent for @tuanpham3080
// Competition: token-radar-01 (make.fun)

export interface FarmOptimizerConfig {
  max_concurrent_farms: number;
  min_tvl_threshold_usd: number;
  preferred_chains: string[];
  risk_tolerance: 'conservative' | 'balanced' | 'aggressive';
  capital_usd: number;
}

export interface FarmCandidate {
  slug: string;
  name: string;
  score: number;
  allocation_pct: number;
  expected_annual_yield_usd: number;
  risk_tier: 1 | 2 | 3;
  entry_barrier: 'low' | 'medium' | 'high';
  estimated_days_to_break_even: number;
}

export interface OptimizedFarmPlan {
  total_expected_yield_usd: number;
  diversification_score: number;
  candidates: FarmCandidate[];
  rebalance_interval_days: number;
  portfolio_risk_index: number;
  strategy_summary: string;
}

/**
 * Titan Scoring Function — combines TVL, growth, chain diversity and category alpha
 * into a single normalized farm attractiveness index (0–100).
 */
export function computeFarmAttractivenessScore(
  tvl_usd: number,
  change_7d: number | null,
  age_days: number,
  chain_count: number,
  category: string | null,
): number {
  // TVL size factor: larger TVL = safer, smaller TVL = higher upside but riskier
  const tvl_log = Math.log10(Math.max(tvl_usd, 1));
  const tvl_score = Math.min(30, (tvl_log - 6) * 10); // 0–30 points

  // 7-day momentum signal
  const growth = change_7d ?? 0;
  const growth_score = Math.min(25, Math.max(-10, growth * 0.5)); // −10 to +25

  // Maturity score: older protocols are safer but less alpha
  const maturity_score = age_days > 730 ? 15 : age_days > 180 ? 10 : 5;

  // Multi-chain reach: more chains = wider distribution
  const chain_score = Math.min(15, chain_count * 3);

  // Category alpha: some verticals historically offer more airdrop value
  let category_score = 5;
  const cat = (category ?? '').toLowerCase();
  if (cat.includes('dex') || cat.includes('amm')) category_score = 15;
  else if (cat.includes('lending') || cat.includes('borrow')) category_score = 12;
  else if (cat.includes('derivative') || cat.includes('perp')) category_score = 18;
  else if (cat.includes('yield') || cat.includes('farm')) category_score = 10;
  else if (cat.includes('bridge') || cat.includes('cross')) category_score = 7;

  const raw = tvl_score + growth_score + maturity_score + chain_score + category_score;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

/**
 * Titan Capital Allocation Engine
 * Distributes capital across top farm candidates using a modified Kelly-inspired weighting.
 */
export function allocateCapitalAcrossFarms(
  candidates: Array<{ slug: string; score: number }>,
  total_capital_usd: number,
  max_farms: number,
): Map<string, number> {
  const top = candidates.slice(0, max_farms).filter((c) => c.score > 0);
  const total_score = top.reduce((s, c) => s + c.score, 0);
  const allocation = new Map<string, number>();

  if (total_score === 0) return allocation;

  for (const c of top) {
    const raw_pct = c.score / total_score;
    // Cap any single position at 35% to enforce diversification
    const capped_pct = Math.min(0.35, raw_pct);
    allocation.set(c.slug, Math.round(total_capital_usd * capped_pct));
  }

  return allocation;
}

/**
 * Portfolio Diversification Analyzer
 * Returns a score 0–100 measuring cross-chain, cross-category spread of a farm portfolio.
 */
export function measurePortfolioDiversification(
  farms: Array<{ chains: string[]; category: string | null }>,
): number {
  if (farms.length === 0) return 0;

  const chain_set = new Set<string>();
  const category_set = new Set<string>();

  for (const f of farms) {
    for (const c of f.chains) chain_set.add(c);
    if (f.category) category_set.add(f.category);
  }

  const chain_diversity = Math.min(40, chain_set.size * 8);
  const category_diversity = Math.min(40, category_set.size * 10);
  const count_bonus = Math.min(20, farms.length * 3);

  return Math.round(chain_diversity + category_diversity + count_bonus);
}

/**
 * Break-Even Estimation Model
 * Estimates days to recoup farming gas + setup costs at a given yield APR.
 */
export function estimateBreakEvenDays(
  capital_usd: number,
  annual_yield_pct: number,
  entry_cost_usd: number,
): number {
  if (annual_yield_pct <= 0 || capital_usd <= 0) return 9999;
  const daily_yield = (capital_usd * annual_yield_pct) / 100 / 365;
  if (daily_yield <= 0) return 9999;
  return Math.ceil(entry_cost_usd / daily_yield);
}

/**
 * Risk Tier Classifier
 * Assigns a 1–3 risk tier to a protocol based on TVL, age, and category.
 */
export function classifyRiskTier(
  tvl_usd: number,
  age_days: number,
  category: string | null,
): 1 | 2 | 3 {
  const cat = (category ?? '').toLowerCase();
  const is_high_risk_category = cat.includes('derivative') || cat.includes('perp') || cat.includes('leverage');
  const is_low_risk_category = cat.includes('lending') || cat.includes('borrow');

  if (tvl_usd >= 200_000_000 && age_days >= 365 && !is_high_risk_category) return 1; // Safe
  if (tvl_usd >= 50_000_000 && age_days >= 90 && !is_high_risk_category) return is_low_risk_category ? 1 : 2;
  if (is_high_risk_category || age_days < 60) return 3; // Aggressive
  return 2; // Balanced
}
