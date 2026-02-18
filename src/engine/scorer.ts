// ============================================================
// cr0n-engine — Opportunity Scorer
// Calculates 0-1 opportunity scores based on adaptive weights
// ============================================================

import type {
  PageData,
  WeightConfig,
  NormalizedScores,
  OpportunityScore,
  CTRCurve,
  ActionBucket,
} from '../core/types.js'
import { DEFAULT_WEIGHTS, DEFAULT_CTR_CURVE, getExpectedCTR } from '../core/constants.js'

export class OpportunityScorer {
  private weights: WeightConfig
  private ctrCurve: CTRCurve

  constructor(weights?: Partial<WeightConfig>, ctrCurve?: CTRCurve) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights }
    this.ctrCurve = ctrCurve || DEFAULT_CTR_CURVE
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  private normalizeImpressions(impressions: number): number {
    return this.clamp(Math.log10(impressions + 1) / 5.0, 0, 1)
  }

  private normalizePosition(position: number): number {
    return this.clamp((50 - position) / 50.0, 0, 1)
  }

  private normalizeCTRGap(position: number, actualCtr: number): number {
    const expectedCtr = getExpectedCTR(position, this.ctrCurve)
    if (expectedCtr <= 0) return 0
    const gap = (expectedCtr - actualCtr) / expectedCtr
    return this.clamp(gap, 0, 1)
  }

  private normalizeConversions(conversions: number): number {
    return this.clamp(Math.log10(conversions + 1) / 2.0, 0, 1)
  }

  private normalizeFreshness(freshnessScore: number): number {
    return this.clamp(freshnessScore, 0, 1)
  }

  getNormalizedScores(page: PageData): NormalizedScores {
    return {
      impressions: this.normalizeImpressions(page.impressions),
      position: this.normalizePosition(page.position),
      ctrGap: this.normalizeCTRGap(page.position, page.ctr),
      conversions: this.normalizeConversions(page.conversions),
      freshness: this.normalizeFreshness(page.freshnessScore),
    }
  }

  calculateScore(page: PageData): number {
    const normalized = this.getNormalizedScores(page)

    const score = (
      this.weights.impressions * normalized.impressions +
      this.weights.position * normalized.position +
      this.weights.ctrGap * normalized.ctrGap +
      this.weights.conversions * normalized.conversions +
      this.weights.freshness * normalized.freshness
    )

    return Math.round(score * 10000) / 10000
  }

  calculateOpportunityScore(page: PageData, bucket: ActionBucket): OpportunityScore {
    const normalized = this.getNormalizedScores(page)
    const total = this.calculateScore(page)

    return {
      total,
      breakdown: normalized,
      bucket,
    }
  }

  getWeights(): WeightConfig {
    return { ...this.weights }
  }

  setWeights(weights: Partial<WeightConfig>): void {
    this.weights = { ...this.weights, ...weights }
  }

  getCTRCurve(): CTRCurve {
    return { ...this.ctrCurve }
  }

  setCTRCurve(curve: Partial<CTRCurve>): void {
    this.ctrCurve = { ...this.ctrCurve, ...curve }
  }
}

export function createScorer(
  weights?: Partial<WeightConfig>,
  ctrCurve?: CTRCurve
): OpportunityScorer {
  return new OpportunityScorer(weights, ctrCurve)
}

export function calculateOpportunityScore(
  page: PageData,
  weights?: Partial<WeightConfig>,
  ctrCurve?: CTRCurve
): number {
  const scorer = new OpportunityScorer(weights, ctrCurve)
  return scorer.calculateScore(page)
}

export function sortByOpportunity(
  pages: PageData[],
  weights?: Partial<WeightConfig>,
  ctrCurve?: CTRCurve
): Array<PageData & { opportunityScore: number }> {
  const scorer = new OpportunityScorer(weights, ctrCurve)

  return pages
    .map(page => ({
      ...page,
      opportunityScore: scorer.calculateScore(page),
    }))
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
}
