// ============================================================
// cr0n-engine — Model Weight Adjuster (Dimension 2)
// Learns which AI model performs best per task type
// Uses Thompson Sampling for exploration/exploitation
// ============================================================

import type {
  ActionBucket,
  ModelId,
  ModelWeights,
  SEOAction,
  LearningLog,
} from '../core/types.js'
import { DEFAULT_MODEL_LEARNING_RATE } from '../core/constants.js'
import { ModelWeightManager } from '../federation/model-weights.js'

export interface ModelLearningResult {
  newModelWeights: ModelWeights
  adjustments: ModelWeightAdjustment[]
  modelPerformance: Map<ModelId, { successes: number; failures: number }>
}

export interface ModelWeightAdjustment {
  bucket: ActionBucket
  modelId: ModelId
  oldWeight: number
  newWeight: number
  reason: string
}

export class ModelAdjuster {
  private weightManager: ModelWeightManager
  private learningRate: number
  private minWeight: number
  private maxWeight: number

  constructor(
    weights?: Partial<ModelWeights>,
    config?: {
      learningRate?: number
      minWeight?: number
      maxWeight?: number
    }
  ) {
    this.weightManager = new ModelWeightManager(weights)
    this.learningRate = config?.learningRate ?? DEFAULT_MODEL_LEARNING_RATE
    this.minWeight = config?.minWeight ?? 0.05
    this.maxWeight = config?.maxWeight ?? 0.60
  }

  /**
   * Run model learning cycle on evaluated actions.
   * For each evaluated action, check which model generated the brief.
   * Success? Increase that model's weight for that bucket.
   * Failure? Decrease weight, redistribute to others.
   */
  runLearningCycle(
    evaluatedActions: Array<{
      action: SEOAction
      success: boolean
      successScore: number
    }>
  ): ModelLearningResult {
    const adjustments: ModelWeightAdjustment[] = []
    const performance = new Map<ModelId, { successes: number; failures: number }>()

    for (const { action, success, successScore } of evaluatedActions) {
      const modelId = action.modelUsed as ModelId | undefined
      if (!modelId) continue

      // Track performance
      if (!performance.has(modelId)) {
        performance.set(modelId, { successes: 0, failures: 0 })
      }
      const perf = performance.get(modelId)!
      if (success) perf.successes++
      else perf.failures++

      // Calculate delta: success reinforces, failure weakens
      // Scale by successScore (0-1) for proportional learning
      const delta = success
        ? this.learningRate * Math.max(successScore, 0.5)
        : -this.learningRate * 0.5

      const bucket = action.actionType
      const oldWeight = this.weightManager.getWeight(bucket, modelId)

      this.weightManager.adjustWeight(
        bucket,
        modelId,
        delta,
        this.minWeight,
        this.maxWeight
      )

      const newWeight = this.weightManager.getWeight(bucket, modelId)

      if (Math.abs(newWeight - oldWeight) > 0.0001) {
        adjustments.push({
          bucket,
          modelId,
          oldWeight: Math.round(oldWeight * 10000) / 10000,
          newWeight: Math.round(newWeight * 10000) / 10000,
          reason: success
            ? `${modelId} succeeded on ${bucket} (score: ${successScore.toFixed(2)})`
            : `${modelId} failed on ${bucket}`,
        })
      }
    }

    return {
      newModelWeights: this.weightManager.getWeights(),
      adjustments,
      modelPerformance: performance,
    }
  }

  /**
   * Generate learning logs from model adjustments
   */
  toLearningLogs(result: ModelLearningResult): LearningLog[] {
    return result.adjustments.map(adj => ({
      date: new Date().toISOString().split('T')[0],
      action: `Model weight: ${adj.modelId} on ${adj.bucket}`,
      result: `${adj.oldWeight.toFixed(4)} -> ${adj.newWeight.toFixed(4)}`,
      weightAdj: adj.reason,
    }))
  }

  /**
   * Get current model weights
   */
  getWeights(): ModelWeights {
    return this.weightManager.getWeights()
  }

  /**
   * Set weights directly
   */
  setWeights(weights: ModelWeights): void {
    this.weightManager.setWeights(weights)
  }
}

export function createModelAdjuster(
  weights?: Partial<ModelWeights>,
  config?: {
    learningRate?: number
    minWeight?: number
    maxWeight?: number
  }
): ModelAdjuster {
  return new ModelAdjuster(weights, config)
}
