// ============================================================
// cr0n-engine — Model Weight State Manager
// Tracks per-bucket model performance weights
// ============================================================

import type {
  ActionBucket,
  ModelId,
  ModelWeights,
  ModelStats,
  ACTION_BUCKETS,
  MODEL_IDS,
} from '../core/types.js'
import { DEFAULT_MODEL_WEIGHTS } from '../core/constants.js'

export class ModelWeightManager {
  private weights: ModelWeights

  constructor(weights?: Partial<ModelWeights>) {
    this.weights = { ...DEFAULT_MODEL_WEIGHTS }
    if (weights) {
      for (const bucket of Object.keys(this.weights) as ActionBucket[]) {
        if (weights[bucket]) {
          this.weights[bucket] = { ...this.weights[bucket], ...weights[bucket] }
        }
      }
    }
  }

  /**
   * Get current weights
   */
  getWeights(): ModelWeights {
    return JSON.parse(JSON.stringify(this.weights))
  }

  /**
   * Get weight for a specific model in a specific bucket
   */
  getWeight(bucket: ActionBucket, modelId: ModelId): number {
    return this.weights[bucket][modelId] ?? 0
  }

  /**
   * Get the top model for a bucket
   */
  getTopModel(bucket: ActionBucket): ModelId {
    const bucketWeights = this.weights[bucket]
    let best: ModelId = 'claude'
    let bestWeight = -1

    for (const [id, weight] of Object.entries(bucketWeights)) {
      if (weight > bestWeight) {
        bestWeight = weight
        best = id as ModelId
      }
    }

    return best
  }

  /**
   * Set weights directly (e.g. from saved state)
   */
  setWeights(weights: ModelWeights): void {
    this.weights = JSON.parse(JSON.stringify(weights))
  }

  /**
   * Adjust a specific model's weight for a bucket
   */
  adjustWeight(
    bucket: ActionBucket,
    modelId: ModelId,
    delta: number,
    minWeight: number = 0.05,
    maxWeight: number = 0.60
  ): void {
    const current = this.weights[bucket][modelId] ?? 0.25
    const newValue = Math.max(minWeight, Math.min(maxWeight, current + delta))
    this.weights[bucket][modelId] = newValue

    // Renormalize bucket to sum to 1.0
    this.normalizeBucket(bucket)
  }

  /**
   * Normalize a bucket's weights to sum to 1.0
   */
  private normalizeBucket(bucket: ActionBucket): void {
    const bucketWeights = this.weights[bucket]
    const total = Object.values(bucketWeights).reduce((sum, v) => sum + v, 0)

    if (total === 0) return

    for (const id of Object.keys(bucketWeights) as ModelId[]) {
      bucketWeights[id] = Math.round((bucketWeights[id] / total) * 10000) / 10000
    }
  }

  /**
   * Generate model stats from tracking data
   */
  generateStats(
    trackingData: Array<{
      modelId: ModelId
      bucket: ActionBucket
      success: boolean
      confidence: number
    }>
  ): ModelStats[] {
    const statsMap = new Map<ModelId, {
      totalTasks: number
      successfulTasks: number
      failedTasks: number
      totalConfidence: number
    }>()

    for (const entry of trackingData) {
      if (!statsMap.has(entry.modelId)) {
        statsMap.set(entry.modelId, {
          totalTasks: 0,
          successfulTasks: 0,
          failedTasks: 0,
          totalConfidence: 0,
        })
      }

      const stats = statsMap.get(entry.modelId)!
      stats.totalTasks++
      if (entry.success) stats.successfulTasks++
      else stats.failedTasks++
      stats.totalConfidence += entry.confidence
    }

    const result: ModelStats[] = []

    for (const [modelId, stats] of statsMap) {
      const weightsByBucket: Record<ActionBucket, number> = {} as Record<ActionBucket, number>
      for (const bucket of Object.keys(this.weights) as ActionBucket[]) {
        weightsByBucket[bucket] = this.weights[bucket][modelId] ?? 0
      }

      result.push({
        modelId,
        totalTasks: stats.totalTasks,
        successfulTasks: stats.successfulTasks,
        failedTasks: stats.failedTasks,
        successRate: stats.totalTasks > 0 ? stats.successfulTasks / stats.totalTasks : 0,
        avgConfidence: stats.totalTasks > 0 ? stats.totalConfidence / stats.totalTasks : 0,
        weightsByBucket,
      })
    }

    return result
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.weights = { ...DEFAULT_MODEL_WEIGHTS }
  }
}
