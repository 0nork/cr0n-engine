// ============================================================
// cr0n-engine — Consensus Engine
// Weighted aggregation of multi-model outputs
// Domain-agnostic consensus logic
// ============================================================

import type {
  ActionBucket,
  ContentBrief,
  ModelId,
  ModelWeights,
  PageData,
} from '../core/types.js'
import type {
  ConsensusResult,
  ModelContribution,
  ModelAdapter,
} from './types.js'

export class ConsensusEngine {
  private consensusThreshold: number

  constructor(consensusThreshold: number = 0.7) {
    this.consensusThreshold = consensusThreshold
  }

  /**
   * Fan out brief generation to multiple models, aggregate results
   */
  async generateConsensus(
    adapters: ModelAdapter[],
    page: PageData,
    bucket: ActionBucket,
    modelWeights: ModelWeights
  ): Promise<ConsensusResult> {
    const bucketWeights = modelWeights[bucket]

    // Single adapter — no consensus needed
    if (adapters.length === 1) {
      const brief = await adapters[0].generateBrief(page, bucket)
      return {
        brief,
        confidence: 1,
        contributions: [{
          modelId: adapters[0].id,
          weight: bucketWeights[adapters[0].id] ?? 1,
          briefHash: this.hashBrief(brief),
          brief,
        }],
        primaryModel: adapters[0].id,
        modelOutputs: new Map([[adapters[0].id, brief]]),
        strategy: 'single',
      }
    }

    // Fan out to all adapters in parallel
    const results = await Promise.allSettled(
      adapters.map(async (adapter) => ({
        modelId: adapter.id,
        brief: await adapter.generateBrief(page, bucket),
      }))
    )

    // Collect successful results
    const modelOutputs = new Map<ModelId, ContentBrief>()
    const contributions: ModelContribution[] = []

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { modelId, brief } = result.value
        modelOutputs.set(modelId, brief)
        contributions.push({
          modelId,
          weight: bucketWeights[modelId] ?? 0,
          briefHash: this.hashBrief(brief),
          brief,
        })
      }
    }

    // No results — should not happen but handle gracefully
    if (contributions.length === 0) {
      throw new Error('All model adapters failed to generate briefs')
    }

    // Single result from failures — return it directly
    if (contributions.length === 1) {
      return {
        brief: contributions[0].brief!,
        confidence: 1,
        contributions,
        primaryModel: contributions[0].modelId,
        modelOutputs,
        strategy: 'single',
      }
    }

    // Calculate agreement/confidence
    const confidence = this.calculateConfidence(contributions)

    // Find primary model (highest weight among successful)
    const primaryModel = contributions
      .sort((a, b) => b.weight - a.weight)[0].modelId

    // Build merged brief
    const mergedBrief = confidence >= this.consensusThreshold
      ? this.mergeBriefs(contributions, bucketWeights, page, bucket)
      : contributions.find(c => c.modelId === primaryModel)!.brief!

    // Tag with federation metadata
    mergedBrief.generatedBy = primaryModel
    mergedBrief.contributingModels = contributions.map(c => c.modelId)
    mergedBrief.consensusConfidence = confidence

    return {
      brief: mergedBrief,
      confidence,
      contributions,
      primaryModel,
      modelOutputs,
      strategy: confidence >= this.consensusThreshold ? 'consensus' : 'primary',
    }
  }

  /**
   * Calculate agreement across model outputs (0-1)
   */
  private calculateConfidence(contributions: ModelContribution[]): number {
    if (contributions.length <= 1) return 1

    let agreementScore = 0
    let comparisons = 0

    for (let i = 0; i < contributions.length; i++) {
      for (let j = i + 1; j < contributions.length; j++) {
        const a = contributions[i].brief!
        const b = contributions[j].brief!

        // Compare key dimensions
        let dimensionAgreement = 0
        let dimensions = 0

        // Word count similarity (within 20%)
        const wcRatio = Math.min(a.targetWordCount, b.targetWordCount) /
                        Math.max(a.targetWordCount, b.targetWordCount)
        dimensionAgreement += wcRatio > 0.8 ? 1 : wcRatio
        dimensions++

        // H2 overlap (Jaccard similarity)
        const aH2s = new Set(a.h2Additions.map(h => h.toLowerCase()))
        const bH2s = new Set(b.h2Additions.map(h => h.toLowerCase()))
        const intersection = new Set([...aH2s].filter(x => bH2s.has(x)))
        const union = new Set([...aH2s, ...bH2s])
        dimensionAgreement += union.size > 0 ? intersection.size / union.size : 1
        dimensions++

        // Schema stack overlap
        const aSchema = new Set(a.schemaStack)
        const bSchema = new Set(b.schemaStack)
        const schemaIntersection = new Set([...aSchema].filter(x => bSchema.has(x)))
        const schemaUnion = new Set([...aSchema, ...bSchema])
        dimensionAgreement += schemaUnion.size > 0 ? schemaIntersection.size / schemaUnion.size : 1
        dimensions++

        // Priority tasks overlap
        const aTasks = new Set(a.priorityTasks.map(t => t.toLowerCase().slice(0, 30)))
        const bTasks = new Set(b.priorityTasks.map(t => t.toLowerCase().slice(0, 30)))
        const taskIntersection = new Set([...aTasks].filter(x => bTasks.has(x)))
        const taskUnion = new Set([...aTasks, ...bTasks])
        dimensionAgreement += taskUnion.size > 0 ? taskIntersection.size / taskUnion.size : 1
        dimensions++

        agreementScore += dimensionAgreement / dimensions
        comparisons++
      }
    }

    return comparisons > 0 ? agreementScore / comparisons : 1
  }

  /**
   * Merge briefs weighted by model performance
   */
  private mergeBriefs(
    contributions: ModelContribution[],
    bucketWeights: Record<ModelId, number>,
    page: PageData,
    bucket: ActionBucket
  ): ContentBrief {
    // Sort by weight
    const sorted = contributions
      .filter(c => c.brief)
      .sort((a, b) => (bucketWeights[b.modelId] ?? 0) - (bucketWeights[a.modelId] ?? 0))

    const primary = sorted[0].brief!

    // Merge title recommendations — take best from each (deduplicated)
    const allTitles: string[] = []
    for (const c of sorted) {
      if (c.brief) allTitles.push(...c.brief.titleRecommendations)
    }
    const uniqueTitles = [...new Set(allTitles)].slice(0, 3)

    // Merge H2s — union of all, deduplicated, ordered by frequency
    const h2Counts = new Map<string, number>()
    for (const c of sorted) {
      if (c.brief) {
        for (const h2 of c.brief.h2Additions) {
          const key = h2.toLowerCase()
          h2Counts.set(key, (h2Counts.get(key) || 0) + 1)
        }
      }
    }
    const mergedH2s = [...h2Counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([h2]) => {
        // Find original casing from first occurrence
        for (const c of sorted) {
          if (c.brief) {
            const found = c.brief.h2Additions.find(h => h.toLowerCase() === h2)
            if (found) return found
          }
        }
        return h2
      })

    // Merge priority tasks — union, deduplicated
    const allTasks: string[] = []
    for (const c of sorted) {
      if (c.brief) allTasks.push(...c.brief.priorityTasks)
    }
    const uniqueTasks = [...new Set(allTasks)]

    // Merge schema stacks — union
    const allSchema: string[] = []
    for (const c of sorted) {
      if (c.brief) allSchema.push(...c.brief.schemaStack)
    }
    const uniqueSchema = [...new Set(allSchema)]

    // Weighted word count average
    let totalWeight = 0
    let weightedWordCount = 0
    for (const c of sorted) {
      if (c.brief) {
        const w = bucketWeights[c.modelId] ?? 0
        weightedWordCount += c.brief.targetWordCount * w
        totalWeight += w
      }
    }
    const avgWordCount = totalWeight > 0
      ? Math.round(weightedWordCount / totalWeight)
      : primary.targetWordCount

    return {
      url: page.url,
      targetKeyword: page.primaryKeyword,
      bucket,
      titleRecommendations: uniqueTitles,
      h1Recommendation: primary.h1Recommendation,
      metaDescription: primary.metaDescription,
      targetWordCount: avgWordCount,
      h2Additions: mergedH2s,
      internalLinks: primary.internalLinks,
      priorityTasks: uniqueTasks,
      schemaStack: uniqueSchema,
      keywordDensityTarget: primary.keywordDensityTarget,
      mandatoryPlacements: primary.mandatoryPlacements,
      metricsSnapshot: primary.metricsSnapshot,
      status: 'draft',
    }
  }

  /**
   * Simple hash for brief comparison
   */
  private hashBrief(brief: ContentBrief): string {
    const key = [
      brief.targetKeyword,
      brief.targetWordCount,
      brief.h2Additions.length,
      brief.priorityTasks.length,
    ].join('|')
    return key
  }
}
