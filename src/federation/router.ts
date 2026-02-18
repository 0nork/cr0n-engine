// ============================================================
// cr0n-engine — Task Router
// Routes tasks to optimal model(s) based on weights
// Domain-agnostic routing logic
// ============================================================

import type { ActionBucket, ModelId, ModelWeights } from '../core/types.js'
import type { RouteDecision } from './types.js'
import { ModelRegistry } from './registry.js'

export class TaskRouter {
  private registry: ModelRegistry
  private modelWeights: ModelWeights

  constructor(registry: ModelRegistry, modelWeights: ModelWeights) {
    this.registry = registry
    this.modelWeights = modelWeights
  }

  /**
   * Determine which models to query for a given bucket.
   * More available models = broader analysis.
   */
  route(bucket: ActionBucket): RouteDecision {
    const availableIds = this.registry.getAvailableIds()
    const bucketWeights = this.modelWeights[bucket]

    if (availableIds.length === 0) {
      throw new Error('No models available. Provide at least one API key.')
    }

    // Single model — no choice
    if (availableIds.length === 1) {
      return {
        models: availableIds,
        primary: availableIds[0],
        strategy: 'primary_only',
        reason: `Only 1 model available (${availableIds[0]})`,
      }
    }

    // Sort available models by weight for this bucket (descending)
    const sorted = availableIds
      .map(id => ({ id, weight: bucketWeights[id] ?? 0 }))
      .sort((a, b) => b.weight - a.weight)

    const primary = sorted[0].id

    // 2 models — use both
    if (availableIds.length === 2) {
      return {
        models: availableIds,
        primary,
        strategy: 'top2',
        reason: `2 models available, using both. Primary: ${primary} (${(sorted[0].weight * 100).toFixed(0)}%)`,
      }
    }

    // 3+ models — use all for maximum learning
    return {
      models: availableIds,
      primary,
      strategy: 'all',
      reason: `${availableIds.length} models available. Primary: ${primary} (${(sorted[0].weight * 100).toFixed(0)}%)`,
    }
  }

  /**
   * Get the highest-weighted model for a bucket
   */
  getPrimaryModel(bucket: ActionBucket): ModelId {
    const available = this.registry.getAvailableIds()
    const bucketWeights = this.modelWeights[bucket]

    let bestModel = available[0]
    let bestWeight = -1

    for (const id of available) {
      const weight = bucketWeights[id] ?? 0
      if (weight > bestWeight) {
        bestWeight = weight
        bestModel = id
      }
    }

    return bestModel
  }

  /**
   * Update model weights reference
   */
  setModelWeights(weights: ModelWeights): void {
    this.modelWeights = weights
  }
}
