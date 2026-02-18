// ============================================================
// cr0n-engine — Runtime Configuration Builder
// ============================================================

import type { EngineConfig, WeightConfig, ModelWeights, ModelId } from './types.js'
import {
  DEFAULT_WEIGHTS,
  DEFAULT_MODEL_WEIGHTS,
  DEFAULT_CONSENSUS_THRESHOLD,
  EVALUATION_CONFIG,
} from './constants.js'

export interface ResolvedConfig {
  weights: WeightConfig
  modelWeights: ModelWeights
  maxTasksPerRun: number
  includeMonitorBucket: boolean
  consensusThreshold: number
  evaluationDelayDays: number
  maxActionAgeDays: number
  availableModels: ModelId[]
}

/**
 * Resolve partial user config into a fully populated config with defaults
 */
export function resolveConfig(config: EngineConfig): ResolvedConfig {
  // Determine which models have API keys
  const availableModels: ModelId[] = []
  if (config.models) {
    for (const [id, modelConfig] of Object.entries(config.models)) {
      if (modelConfig?.apiKey) {
        availableModels.push(id as ModelId)
      }
    }
  }

  // Merge content weights
  const weights: WeightConfig = {
    ...DEFAULT_WEIGHTS,
    ...config.weights,
  }

  // Merge model weights — use saved if provided, else defaults
  const modelWeights: ModelWeights = { ...DEFAULT_MODEL_WEIGHTS }
  if (config.modelWeights) {
    for (const bucket of Object.keys(modelWeights) as Array<keyof ModelWeights>) {
      if (config.modelWeights[bucket]) {
        modelWeights[bucket] = {
          ...modelWeights[bucket],
          ...config.modelWeights[bucket],
        }
      }
    }
  }

  return {
    weights,
    modelWeights,
    maxTasksPerRun: config.maxTasksPerRun ?? 50,
    includeMonitorBucket: config.includeMonitorBucket ?? false,
    consensusThreshold: config.consensusThreshold ?? DEFAULT_CONSENSUS_THRESHOLD,
    evaluationDelayDays: config.evaluationDelayDays ?? EVALUATION_CONFIG.evaluationDelayDays,
    maxActionAgeDays: config.maxActionAgeDays ?? EVALUATION_CONFIG.maxActionAgeDays,
    availableModels,
  }
}
