// ============================================================
// cr0n-engine — Content Weight Adjuster
// Dimension 1: Learns which metrics matter most for scoring
// ============================================================

import type {
  WeightConfig,
  LearningConfig,
  WeightAdjustment,
  SEOAction,
  ActionBucket,
} from '../core/types.js'
import { DEFAULT_WEIGHTS, DEFAULT_LEARNING_CONFIG, SUCCESS_CRITERIA } from '../core/constants.js'

export interface LearningResult {
  newWeights: WeightConfig
  adjustments: WeightAdjustment[]
  totalLearningCycles: number
}

export class WeightAdjuster {
  private weights: WeightConfig
  private config: LearningConfig
  private learningCycles: number

  constructor(
    weights?: Partial<WeightConfig>,
    config?: Partial<LearningConfig>,
    learningCycles: number = 0
  ) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights }
    this.config = { ...DEFAULT_LEARNING_CONFIG, ...config }
    this.learningCycles = learningCycles
  }

  evaluateActionSuccess(action: SEOAction): { success: boolean; score: number; criteria: string } {
    const criteria = SUCCESS_CRITERIA[action.actionType]

    if (!criteria) {
      return { success: false, score: 0, criteria: 'Unknown action type' }
    }

    const { metric, improvement, description } = criteria

    let delta = 0
    let baseValue = 0
    let resultValue = 0

    switch (metric) {
      case 'ctr':
        baseValue = action.originalCtr
        resultValue = action.resultCtr ?? baseValue
        delta = baseValue > 0 ? (resultValue - baseValue) / baseValue : 0
        break

      case 'position':
        baseValue = action.originalPosition
        resultValue = action.resultPosition ?? baseValue
        delta = baseValue - resultValue
        break

      case 'impressions':
        baseValue = action.originalImpressions
        resultValue = action.resultImpressions ?? baseValue
        delta = baseValue > 0 ? (resultValue - baseValue) / baseValue : 0
        break

      case 'clicks':
        baseValue = action.originalClicks
        resultValue = action.resultClicks ?? baseValue
        delta = baseValue > 0 ? (resultValue - baseValue) / baseValue : 0
        break
    }

    const successScore = Math.min(Math.max(delta / improvement, 0), 1)
    const success = delta >= improvement

    return { success, score: successScore, criteria: description }
  }

  private getWeightKeyForBucket(bucket: ActionBucket): keyof WeightConfig {
    switch (bucket) {
      case 'CTR_FIX': return 'ctrGap'
      case 'STRIKING_DISTANCE': return 'position'
      case 'RELEVANCE_REBUILD': return 'impressions'
      case 'LOCAL_BOOST': return 'conversions'
      case 'MONITOR': return 'freshness'
    }
  }

  private applyAdjustment(
    weightKey: keyof WeightConfig,
    delta: number,
    reason: string
  ): WeightAdjustment | null {
    const { learningRate, minWeight, maxWeight } = this.config
    const oldValue = this.weights[weightKey]

    const adjustment = delta * learningRate
    let newValue = oldValue + adjustment

    newValue = Math.max(minWeight, Math.min(maxWeight, newValue))

    if (Math.abs(newValue - oldValue) < 0.0001) {
      return null
    }

    this.weights[weightKey] = newValue

    return {
      weight: weightKey,
      oldValue: Math.round(oldValue * 10000) / 10000,
      newValue: Math.round(newValue * 10000) / 10000,
      reason,
    }
  }

  private normalizeWeights(): void {
    const total = Object.values(this.weights).reduce((sum, val) => sum + val, 0)
    if (total === 0) return

    for (const key of Object.keys(this.weights) as Array<keyof WeightConfig>) {
      this.weights[key] = Math.round((this.weights[key] / total) * 10000) / 10000
    }
  }

  runLearningCycle(completedActions: SEOAction[]): LearningResult {
    const adjustments: WeightAdjustment[] = []

    for (const action of completedActions) {
      if (action.learningApplied) continue

      const evaluation = this.evaluateActionSuccess(action)
      const weightKey = this.getWeightKeyForBucket(action.actionType)

      const delta = evaluation.success ? 1 : -0.5

      const adjustment = this.applyAdjustment(
        weightKey,
        delta,
        evaluation.success
          ? `${action.actionType} success on ${action.url.split('/').pop()}`
          : `${action.actionType} did not meet criteria on ${action.url.split('/').pop()}`
      )

      if (adjustment) {
        adjustments.push(adjustment)
      }
    }

    this.normalizeWeights()
    this.learningCycles++

    return {
      newWeights: { ...this.weights },
      adjustments,
      totalLearningCycles: this.learningCycles,
    }
  }

  getWeights(): WeightConfig {
    return { ...this.weights }
  }

  getConfig(): LearningConfig {
    return { ...this.config }
  }

  getLearningCycles(): number {
    return this.learningCycles
  }

  resetWeights(): void {
    this.weights = { ...DEFAULT_WEIGHTS }
  }

  setConfig(config: Partial<LearningConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

export function createWeightAdjuster(
  weights?: Partial<WeightConfig>,
  config?: Partial<LearningConfig>,
  learningCycles?: number
): WeightAdjuster {
  return new WeightAdjuster(weights, config, learningCycles)
}

export function evaluateAction(action: SEOAction): { success: boolean; score: number; criteria: string } {
  const adjuster = new WeightAdjuster()
  return adjuster.evaluateActionSuccess(action)
}
