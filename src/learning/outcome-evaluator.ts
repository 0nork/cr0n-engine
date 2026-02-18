// ============================================================
// cr0n-engine — Outcome Evaluator
// Evaluates action outcomes after the evaluation period
// Extended with model tracking for federation
// ============================================================

import type {
  SEOAction,
  PageData,
  LearningLog,
  ActionBucket,
  EvaluationResult,
  BatchEvaluationResult,
} from '../core/types.js'
import { EVALUATION_CONFIG, SUCCESS_CRITERIA } from '../core/constants.js'

export class OutcomeEvaluator {
  private evaluationDelayDays: number
  private maxActionAgeDays: number

  constructor(config?: { evaluationDelayDays?: number; maxActionAgeDays?: number }) {
    this.evaluationDelayDays = config?.evaluationDelayDays ?? EVALUATION_CONFIG.evaluationDelayDays
    this.maxActionAgeDays = config?.maxActionAgeDays ?? EVALUATION_CONFIG.maxActionAgeDays
  }

  isReadyForEvaluation(action: SEOAction): boolean {
    if (action.learningApplied) return false
    if (action.actionStatus !== 'completed') return false

    const actionDate = new Date(action.actionDate)
    const now = new Date()
    const daysSinceAction = Math.floor(
      (now.getTime() - actionDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSinceAction < this.evaluationDelayDays) return false
    if (daysSinceAction > this.maxActionAgeDays) return false

    return true
  }

  evaluate(action: SEOAction, currentPageData: PageData): EvaluationResult {
    const deltaTraffic = currentPageData.clicks - action.originalClicks
    const deltaPosition = action.originalPosition - currentPageData.position
    const deltaCtr = currentPageData.ctr - action.originalCtr
    const deltaImpressions = currentPageData.impressions - action.originalImpressions

    const criteria = SUCCESS_CRITERIA[action.actionType]

    const { success, score } = this.evaluateSuccess(
      action.actionType,
      action,
      currentPageData
    )

    const learningLog: LearningLog = {
      date: new Date().toISOString().split('T')[0],
      action: `${action.actionType} on ${action.url.split('/').pop()}`,
      result: success
        ? this.formatSuccessResult(action.actionType, action, currentPageData)
        : 'No significant improvement',
      weightAdj: success ? `+${action.actionType}` : 'None',
      details: {
        url: action.url,
        actionType: action.actionType,
        deltaMetric: this.getPrimaryDelta(action.actionType, action, currentPageData),
        metricType: criteria.metric,
      },
    }

    return {
      action,
      success,
      successScore: score,
      criteria: criteria.description,
      deltaTraffic,
      deltaPosition,
      deltaCtr,
      deltaImpressions,
      learningLog,
    }
  }

  private evaluateSuccess(
    bucket: ActionBucket,
    action: SEOAction,
    current: PageData
  ): { success: boolean; score: number; description: string } {
    const criteria = SUCCESS_CRITERIA[bucket]

    switch (bucket) {
      case 'CTR_FIX': {
        const ctrChange = action.originalCtr > 0
          ? (current.ctr - action.originalCtr) / action.originalCtr
          : 0
        return {
          success: ctrChange >= criteria.improvement,
          score: Math.min(ctrChange / criteria.improvement, 1),
          description: criteria.description,
        }
      }

      case 'STRIKING_DISTANCE': {
        const positionImproved = action.originalPosition - current.position
        return {
          success: positionImproved >= criteria.improvement,
          score: Math.min(positionImproved / criteria.improvement, 1),
          description: criteria.description,
        }
      }

      case 'RELEVANCE_REBUILD': {
        const impressionChange = action.originalImpressions > 0
          ? (current.impressions - action.originalImpressions) / action.originalImpressions
          : 0
        return {
          success: impressionChange >= criteria.improvement,
          score: Math.min(impressionChange / criteria.improvement, 1),
          description: criteria.description,
        }
      }

      case 'LOCAL_BOOST': {
        const clickChange = action.originalClicks > 0
          ? (current.clicks - action.originalClicks) / action.originalClicks
          : 0
        return {
          success: clickChange >= criteria.improvement,
          score: Math.min(clickChange / criteria.improvement, 1),
          description: criteria.description,
        }
      }

      case 'MONITOR': {
        const positionMaintained = current.position <= action.originalPosition
        return {
          success: positionMaintained,
          score: positionMaintained ? 1 : 0,
          description: criteria.description,
        }
      }

      default:
        return { success: false, score: 0, description: 'Unknown action type' }
    }
  }

  private getPrimaryDelta(
    bucket: ActionBucket,
    action: SEOAction,
    current: PageData
  ): number {
    switch (bucket) {
      case 'CTR_FIX': return current.ctr - action.originalCtr
      case 'STRIKING_DISTANCE': return action.originalPosition - current.position
      case 'RELEVANCE_REBUILD': return current.impressions - action.originalImpressions
      case 'LOCAL_BOOST': return current.clicks - action.originalClicks
      case 'MONITOR': return action.originalPosition - current.position
      default: return 0
    }
  }

  private formatSuccessResult(
    bucket: ActionBucket,
    action: SEOAction,
    current: PageData
  ): string {
    switch (bucket) {
      case 'CTR_FIX': {
        const ctrChange = action.originalCtr > 0
          ? Math.round(((current.ctr - action.originalCtr) / action.originalCtr) * 100)
          : 0
        return `+${ctrChange}% CTR`
      }

      case 'STRIKING_DISTANCE': {
        const posChange = (action.originalPosition - current.position).toFixed(1)
        return `+${posChange} positions`
      }

      case 'RELEVANCE_REBUILD': {
        const impChange = action.originalImpressions > 0
          ? Math.round(((current.impressions - action.originalImpressions) / action.originalImpressions) * 100)
          : 0
        return `+${impChange}% impressions`
      }

      case 'LOCAL_BOOST': {
        const clickChange = action.originalClicks > 0
          ? Math.round(((current.clicks - action.originalClicks) / action.originalClicks) * 100)
          : 0
        return `+${clickChange}% clicks`
      }

      case 'MONITOR':
        return 'Position maintained'

      default:
        return 'Improved'
    }
  }

  batchEvaluate(
    actions: SEOAction[],
    currentPageDataMap: Map<string, PageData>
  ): BatchEvaluationResult {
    const evaluated: EvaluationResult[] = []
    const skipped: SEOAction[] = []
    const learningLogs: LearningLog[] = []

    for (const action of actions) {
      if (!this.isReadyForEvaluation(action)) {
        skipped.push(action)
        continue
      }

      const currentData = currentPageDataMap.get(action.url)
      if (!currentData) {
        skipped.push(action)
        continue
      }

      const result = this.evaluate(action, currentData)
      evaluated.push(result)
      learningLogs.push(result.learningLog)
    }

    const successful = evaluated.filter(e => e.success).length
    const total = evaluated.length

    return {
      evaluated,
      skipped,
      stats: {
        total,
        successful,
        failed: total - successful,
        successRate: total > 0 ? successful / total : 0,
      },
      learningLogs,
    }
  }
}

export function createOutcomeEvaluator(config?: {
  evaluationDelayDays?: number
  maxActionAgeDays?: number
}): OutcomeEvaluator {
  return new OutcomeEvaluator(config)
}

export function isActionReadyForEvaluation(action: SEOAction): boolean {
  const evaluator = new OutcomeEvaluator()
  return evaluator.isReadyForEvaluation(action)
}
