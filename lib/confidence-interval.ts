// Titan Ranking Confidence Interval Engine
// Authored fresh by Antigravity Agent for @tuanpham3080
// Provides statistical confidence bounds on implied-value rankings.

export interface ConfidenceInterval {
  lower_bound_usd: number;
  upper_bound_usd: number;
  confidence_pct: number;
  margin_of_error_pct: number;
}

export interface RankingConfidence {
  slug: string;
  rank: number;
  implied_value_usd: number;
  interval: ConfidenceInterval;
  rank_stability_score: number;
  could_rank_above: number;
  could_rank_below: number;
}

/**
 * Compute confidence interval for a single protocol's implied value.
 * Uses a simplified Monte-Carlo-inspired uncertainty model based on:
 * - 7d growth variance (high volatility = wider interval)
 * - TVL size (larger TVL = more stable signal)
 * - Age (newer protocols have higher model uncertainty)
 */
export function computeImpliedValueInterval(
  implied_value_usd: number,
  change_7d: number | null,
  tvl_usd: number,
  age_days: number,
  confidence_pct: number = 90,
): ConfidenceInterval {
  // Growth uncertainty: high absolute change = less predictable
  const growth_volatility = Math.abs(change_7d ?? 0);
  const growth_uncertainty = Math.min(0.40, growth_volatility / 100);

  // TVL-size stability: large TVL protocols are less volatile
  const tvl_stability = tvl_usd > 500_000_000 ? 0.08 : tvl_usd > 100_000_000 ? 0.15 : 0.25;

  // Age discount: younger protocols have wider uncertainty bands
  const age_uncertainty = age_days > 730 ? 0.05 : age_days > 180 ? 0.12 : 0.22;

  // Combined margin of error (geometric average of three factors)
  const raw_margin = (growth_uncertainty + tvl_stability + age_uncertainty) / 3;

  // Scale for confidence level (90% CI uses z=1.645, 95% uses z=1.96)
  const z_score = confidence_pct >= 95 ? 1.96 : confidence_pct >= 90 ? 1.645 : 1.28;
  const margin_pct = raw_margin * z_score;

  const lower = Math.round(implied_value_usd * (1 - margin_pct));
  const upper = Math.round(implied_value_usd * (1 + margin_pct));

  return {
    lower_bound_usd: Math.max(0, lower),
    upper_bound_usd: upper,
    confidence_pct,
    margin_of_error_pct: Number((margin_pct * 100).toFixed(1)),
  };
}

/**
 * Compute rank stability scores across the entire board.
 * A protocol with a stable rank means its confidence interval does not
 * overlap many neighbors', giving more reliable top-N selection.
 */
export function computeRankingConfidence(
  board: Array<{ slug: string; rank: number; implied_value_usd: number; change_7d: number | null; tvl_usd: number; age_days?: number }>,
): RankingConfidence[] {
  const result: RankingConfidence[] = [];

  for (const row of board) {
    const age = row.age_days ?? 365;
    const interval = computeImpliedValueInterval(
      row.implied_value_usd,
      row.change_7d,
      row.tvl_usd,
      age,
    );

    // Count how many protocols could rank above/below given the interval
    let could_rank_above = 0;
    let could_rank_below = 0;

    for (const other of board) {
      if (other.slug === row.slug) continue;
      const other_age = other.age_days ?? 365;
      const other_interval = computeImpliedValueInterval(
        other.implied_value_usd,
        other.change_7d,
        other.tvl_usd,
        other_age,
      );

      // Interval overlap means rank could swap
      const overlaps =
        interval.lower_bound_usd <= other_interval.upper_bound_usd &&
        other_interval.lower_bound_usd <= interval.upper_bound_usd;

      if (overlaps) {
        if (other.rank < row.rank) could_rank_above++;
        else could_rank_below++;
      }
    }

    // Stability score: 100 = no overlapping neighbors, 0 = all uncertain
    const max_neighbors = Math.min(10, board.length - 1);
    const overlapping_neighbors = could_rank_above + could_rank_below;
    const stability = Math.max(0, 100 - Math.round((overlapping_neighbors / max_neighbors) * 100));

    result.push({
      slug: row.slug,
      rank: row.rank,
      implied_value_usd: row.implied_value_usd,
      interval,
      rank_stability_score: stability,
      could_rank_above,
      could_rank_below,
    });
  }

  return result;
}

/**
 * Identify the "Top-N Lock" — protocols whose rank is statistically certain.
 * Returns the count of protocols in top-N whose rank is stable (no overlapping CI with neighbors).
 */
export function countLockedRanks(confidence: RankingConfidence[], top_n: number): number {
  return confidence
    .filter((c) => c.rank <= top_n && c.rank_stability_score >= 70)
    .length;
}
