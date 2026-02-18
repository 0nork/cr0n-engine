// ============================================================
// @0nork/cr0n-engine
// Federated AI Closed Learning Loop
// Two-dimensional adaptive learning: content weights + model weights
// ============================================================

// ---- Core Types & Constants (re-export everything) ----
export type {
  PageData,
  NormalizedScores,
  OpportunityScore,
  ActionBucket,
  BucketCriteria,
  WeightConfig,
  LearningConfig,
  SavedWeights,
  WeightAdjustment,
  ContentBrief,
  SEOAction,
  SEOTask,
  LearningLog,
  DailyPlan,
  AnalysisRun,
  CTRCurve,
  ModelId,
  ModelConfig,
  ModelWeights,
  ModelStats,
  EngineConfig,
  CycleInput,
  CycleResult,
  BatchEvaluationResult,
  EvaluationResult,
  GSCPageData,
  GA4PageData,
  ContentWriterInput,
} from './core/types.js'

export { ACTION_BUCKETS, MODEL_IDS } from './core/types.js'

export {
  DEFAULT_WEIGHTS,
  DEFAULT_LEARNING_CONFIG,
  DEFAULT_MODEL_WEIGHTS,
  DEFAULT_CTR_CURVE,
  BUCKET_CRITERIA,
  CONTENT_RULES,
  SCHEMA_STACKS,
  LOCAL_INDICATORS,
  SUCCESS_CRITERIA,
  EVALUATION_CONFIG,
  BUCKET_INSTRUCTIONS,
  DEFAULT_CONSENSUS_THRESHOLD,
  MODEL_DEFAULTS,
  getExpectedCTR,
} from './core/constants.js'

// ---- Federation Types ----
export type {
  ModelAdapter,
  ModelAnalysis,
  BusinessContext,
  ContentScore,
  GeneratedContent,
  ModelContribution,
  ConsensusResult,
  RouteDecision,
} from './federation/types.js'

// ---- Engine Components (for advanced usage) ----
export { OpportunityScorer, createScorer, calculateOpportunityScore, sortByOpportunity } from './engine/scorer.js'
export { ActionBucketer, createBucketer, classifyBucket, getBucketDistribution } from './engine/bucketer.js'
export { SEOAnalyzer, createAnalyzer, quickAnalyze, generateDailyPlan } from './engine/analyzer.js'
export { BriefGenerator, createBriefGenerator, generateBrief } from './briefs/generator.js'
export { ContentWriterBridge, createContentWriterBridge, formatBriefForContentWriter } from './briefs/bridge.js'
export { WeightAdjuster, createWeightAdjuster, evaluateAction } from './learning/weight-adjuster.js'
export { OutcomeEvaluator, createOutcomeEvaluator, isActionReadyForEvaluation } from './learning/outcome-evaluator.js'
export { ModelAdjuster, createModelAdjuster } from './learning/model-adjuster.js'
export { DataAggregator, createAggregator, aggregateData } from './data/aggregator.js'
export { ModelRegistry } from './federation/registry.js'
export { TaskRouter } from './federation/router.js'
export { ConsensusEngine } from './federation/consensus.js'
export { ModelWeightManager } from './federation/model-weights.js'

// ---- Adapters ----
export { ClaudeAdapter } from './federation/adapters/claude.js'
export { OpenAIAdapter } from './federation/adapters/openai.js'
export { GeminiAdapter } from './federation/adapters/gemini.js'
export { GrokAdapter } from './federation/adapters/grok.js'

// ---- Config ----
export { resolveConfig } from './core/config.js'

// ============================================================
// Main API: createEngine()
// ============================================================

import type {
  EngineConfig,
  CycleInput,
  CycleResult,
  WeightConfig,
  ModelWeights,
  ModelStats,
  ModelId,
  LearningLog,
  SEOTask,
  DailyPlan,
  PageData,
  ActionBucket,
  ContentBrief,
} from './core/types.js'
import { resolveConfig } from './core/config.js'
import { SEOAnalyzer } from './engine/analyzer.js'
import { WeightAdjuster } from './learning/weight-adjuster.js'
import { OutcomeEvaluator } from './learning/outcome-evaluator.js'
import { ModelAdjuster } from './learning/model-adjuster.js'
import { ModelRegistry } from './federation/registry.js'
import { TaskRouter } from './federation/router.js'
import { ConsensusEngine } from './federation/consensus.js'
import { ModelWeightManager } from './federation/model-weights.js'

export interface Cr0nEngine {
  /** Run a full optimization cycle */
  runCycle(input: CycleInput): Promise<CycleResult>

  /** Analyze pages without federation (fast, local only) */
  analyze(pages: PageData[], siteId?: string): DailyPlan

  /** Generate a federated brief for a single page */
  federateBrief(page: PageData, bucket: ActionBucket): Promise<ContentBrief>

  /** Get current content weights */
  getWeights(): WeightConfig

  /** Get current model weights */
  getModelWeights(): ModelWeights

  /** Get model statistics */
  getModelStats(): ModelStats[]

  /** Get available model count */
  getModelCount(): number
}

/**
 * Create a cr0n engine instance.
 *
 * @example
 * ```ts
 * import { createEngine } from '@0nork/cr0n-engine';
 *
 * const engine = createEngine({
 *   models: {
 *     claude: { apiKey: process.env.ANTHROPIC_API_KEY },
 *     openai: { apiKey: process.env.OPENAI_API_KEY },
 *   },
 *   weights: savedContentWeights,
 *   modelWeights: savedModelWeights,
 * });
 *
 * const result = await engine.runCycle({
 *   pages: pageDataArray,
 *   completedActions: pastActions,
 * });
 * ```
 */
export function createEngine(config: EngineConfig): Cr0nEngine {
  const resolved = resolveConfig(config)
  const registry = ModelRegistry.fromConfig(config)
  const router = new TaskRouter(registry, resolved.modelWeights)
  const consensus = new ConsensusEngine(resolved.consensusThreshold)
  const weightManager = new ModelWeightManager(config.modelWeights)

  // Track model usage for stats
  const modelTracking: Array<{
    modelId: ModelId
    bucket: ActionBucket
    success: boolean
    confidence: number
  }> = []

  return {
    async runCycle(input: CycleInput): Promise<CycleResult> {
      const startTime = Date.now()
      const siteId = input.siteId || 'default'
      const allLearningLogs: LearningLog[] = []

      // ── Step 1: Evaluate completed actions (Dimension 1 + 2) ──
      let evaluations = null
      const contentAdjuster = new WeightAdjuster(
        resolved.weights,
        undefined,
        0
      )
      const modelAdjuster = new ModelAdjuster(
        resolved.modelWeights
      )

      if (input.completedActions && input.completedActions.length > 0) {
        // Build page data map for evaluation
        const pageMap = new Map<string, PageData>()
        for (const page of input.pages) {
          pageMap.set(page.url, page)
        }

        // Evaluate outcomes
        const evaluator = new OutcomeEvaluator({
          evaluationDelayDays: resolved.evaluationDelayDays,
          maxActionAgeDays: resolved.maxActionAgeDays,
        })
        evaluations = evaluator.batchEvaluate(input.completedActions, pageMap)
        allLearningLogs.push(...evaluations.learningLogs)

        // Dimension 1: Adjust content weights
        const actionsForLearning = evaluations.evaluated.map(e => e.action)
        if (actionsForLearning.length > 0) {
          const contentResult = contentAdjuster.runLearningCycle(actionsForLearning)
          resolved.weights = contentResult.newWeights

          for (const adj of contentResult.adjustments) {
            allLearningLogs.push({
              date: new Date().toISOString().split('T')[0],
              action: `Content weight: ${adj.weight}`,
              result: `${adj.oldValue.toFixed(4)} -> ${adj.newValue.toFixed(4)}`,
              weightAdj: adj.reason,
            })
          }
        }

        // Dimension 2: Adjust model weights
        const modelEvaluations = evaluations.evaluated
          .filter(e => e.action.modelUsed)
          .map(e => ({
            action: e.action,
            success: e.success,
            successScore: e.successScore,
          }))

        if (modelEvaluations.length > 0) {
          const modelResult = modelAdjuster.runLearningCycle(modelEvaluations)
          resolved.modelWeights = modelResult.newModelWeights
          router.setModelWeights(resolved.modelWeights)

          allLearningLogs.push(...modelAdjuster.toLearningLogs(modelResult))
        }
      }

      // ── Step 2: Score & Classify ──
      const analyzer = new SEOAnalyzer({
        weights: resolved.weights,
        maxTasksPerRun: resolved.maxTasksPerRun,
        includeMonitorBucket: resolved.includeMonitorBucket,
      })

      const basePlan = analyzer.generateDailyPlan(siteId, input.pages, allLearningLogs)

      // ── Step 3: Federate (if models available) ──
      const availableModels = registry.getAvailable()

      if (availableModels.length > 0) {
        // Federate top tasks
        const federatedTasks: SEOTask[] = []

        for (const task of basePlan.tasks) {
          try {
            const route = router.route(task.bucket)
            const adapters = route.models
              .map(id => registry.get(id))
              .filter((a): a is NonNullable<typeof a> => !!a)

            if (adapters.length > 0) {
              const result = await consensus.generateConsensus(
                adapters,
                task.metrics,
                task.bucket,
                resolved.modelWeights
              )

              // Tag the brief
              task.brief = result.brief
              task.brief.generatedBy = result.primaryModel
              task.brief.contributingModels = result.contributions.map(c => c.modelId)
              task.brief.consensusConfidence = result.confidence

              // Track for stats
              for (const contribution of result.contributions) {
                modelTracking.push({
                  modelId: contribution.modelId,
                  bucket: task.bucket,
                  success: true, // Will be evaluated later
                  confidence: result.confidence,
                })
              }
            }
          } catch {
            // Federation failed for this task — keep the local brief
          }

          federatedTasks.push(task)
        }

        basePlan.tasks = federatedTasks
      }

      // ── Step 4: Build result ──
      const modelStats = weightManager.generateStats(modelTracking)

      return {
        plan: basePlan,
        evaluations,
        weights: resolved.weights,
        modelWeights: resolved.modelWeights,
        modelStats,
        learningLog: allLearningLogs,
      }
    },

    analyze(pages: PageData[], siteId?: string): DailyPlan {
      const analyzer = new SEOAnalyzer({
        weights: resolved.weights,
        maxTasksPerRun: resolved.maxTasksPerRun,
        includeMonitorBucket: resolved.includeMonitorBucket,
      })
      return analyzer.generateDailyPlan(siteId || 'default', pages)
    },

    async federateBrief(page: PageData, bucket: ActionBucket): Promise<ContentBrief> {
      const available = registry.getAvailable()
      if (available.length === 0) {
        throw new Error('No models available for federation')
      }

      const result = await consensus.generateConsensus(
        available,
        page,
        bucket,
        resolved.modelWeights
      )

      return result.brief
    },

    getWeights(): WeightConfig {
      return { ...resolved.weights }
    },

    getModelWeights(): ModelWeights {
      return JSON.parse(JSON.stringify(resolved.modelWeights))
    },

    getModelStats(): ModelStats[] {
      return weightManager.generateStats(modelTracking)
    },

    getModelCount(): number {
      return registry.count()
    },
  }
}
