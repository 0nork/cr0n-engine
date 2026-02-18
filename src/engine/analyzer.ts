// ============================================================
// cr0n-engine — Main Analysis Orchestrator
// Coordinates scoring, bucketing, and brief generation
// ============================================================

import type {
  PageData,
  WeightConfig,
  ActionBucket,
  SEOTask,
  DailyPlan,
  AnalysisRun,
  CTRCurve,
  LearningLog,
  WeightAdjustment,
} from '../core/types.js'
import { DEFAULT_WEIGHTS, DEFAULT_CTR_CURVE } from '../core/constants.js'
import { OpportunityScorer, createScorer } from './scorer.js'
import { ActionBucketer, createBucketer } from './bucketer.js'
import { BriefGenerator, createBriefGenerator } from '../briefs/generator.js'

export interface AnalyzerConfig {
  weights?: Partial<WeightConfig>
  ctrCurve?: CTRCurve
  maxTasksPerRun?: number
  includeMonitorBucket?: boolean
}

export class SEOAnalyzer {
  private scorer: OpportunityScorer
  private bucketer: ActionBucketer
  private briefGenerator: BriefGenerator
  private config: Required<AnalyzerConfig>

  constructor(config: AnalyzerConfig = {}) {
    const weights = { ...DEFAULT_WEIGHTS, ...config.weights }
    const ctrCurve = config.ctrCurve || DEFAULT_CTR_CURVE

    this.scorer = createScorer(weights, ctrCurve)
    this.bucketer = createBucketer(undefined, ctrCurve)
    this.briefGenerator = createBriefGenerator()

    this.config = {
      weights,
      ctrCurve,
      maxTasksPerRun: config.maxTasksPerRun || 50,
      includeMonitorBucket: config.includeMonitorBucket ?? false,
    }
  }

  analyzePage(page: PageData): SEOTask {
    const bucket = this.bucketer.classify(page)
    const score = this.scorer.calculateScore(page)
    const brief = this.briefGenerator.generate(page, bucket)

    return {
      url: page.url,
      score,
      bucket,
      metrics: page,
      brief,
    }
  }

  analyzePages(pages: PageData[]): SEOTask[] {
    const tasks: SEOTask[] = []

    for (const page of pages) {
      const bucket = this.bucketer.classify(page)

      if (bucket === 'MONITOR' && !this.config.includeMonitorBucket) {
        continue
      }

      const score = this.scorer.calculateScore(page)
      const brief = this.briefGenerator.generate(page, bucket)

      tasks.push({
        url: page.url,
        score,
        bucket,
        metrics: page,
        brief,
      })
    }

    tasks.sort((a, b) => b.score - a.score)
    return tasks.slice(0, this.config.maxTasksPerRun)
  }

  generateDailyPlan(
    siteId: string,
    pages: PageData[],
    learningLog: LearningLog[] = []
  ): DailyPlan {
    const tasks = this.analyzePages(pages)
    const bucketDist = this.bucketer.getBucketDistribution(pages)

    return {
      date: new Date().toISOString().split('T')[0],
      siteId,
      activeWeights: this.scorer.getWeights(),
      tasks,
      learningLog,
      stats: {
        totalPagesAnalyzed: pages.length,
        pagesWithOpportunities: tasks.length,
        bucketDistribution: bucketDist,
      },
    }
  }

  createAnalysisRun(
    siteId: string,
    plan: DailyPlan,
    options: {
      runType?: 'scheduled' | 'manual'
      gscSyncSuccess?: boolean
      ga4SyncSuccess?: boolean
      syncErrors?: string[]
      learningCycleRan?: boolean
      actionsEvaluated?: number
      successfulActions?: number
      weightAdjustments?: WeightAdjustment[]
    } = {}
  ): AnalysisRun {
    const dist = plan.stats.bucketDistribution

    return {
      siteId,
      runDate: plan.date,
      runType: options.runType || 'manual',
      totalPagesAnalyzed: plan.stats.totalPagesAnalyzed,
      pagesWithOpportunities: plan.stats.pagesWithOpportunities,
      briefsGenerated: plan.tasks.length,
      ctrFixCount: dist.CTR_FIX,
      strikingDistanceCount: dist.STRIKING_DISTANCE,
      relevanceRebuildCount: dist.RELEVANCE_REBUILD,
      localBoostCount: dist.LOCAL_BOOST,
      monitorCount: dist.MONITOR,
      learningCycleRan: options.learningCycleRan ?? false,
      actionsEvaluated: options.actionsEvaluated ?? 0,
      successfulActions: options.successfulActions ?? 0,
      weightAdjustments: options.weightAdjustments ?? [],
      gscSyncSuccess: options.gscSyncSuccess ?? false,
      ga4SyncSuccess: options.ga4SyncSuccess ?? false,
      syncErrors: options.syncErrors ?? [],
      notificationSent: false,
      startedAt: new Date().toISOString(),
    }
  }

  getTopOpportunitiesByBucket(
    pages: PageData[],
    limit: number = 5
  ): Record<ActionBucket, SEOTask[]> {
    const groups = this.bucketer.groupByBucket(pages)
    const result: Record<ActionBucket, SEOTask[]> = {
      CTR_FIX: [],
      STRIKING_DISTANCE: [],
      RELEVANCE_REBUILD: [],
      LOCAL_BOOST: [],
      MONITOR: [],
    }

    for (const bucket of Object.keys(groups) as ActionBucket[]) {
      const bucketPages = groups[bucket]
      const tasks = bucketPages
        .map(page => ({
          url: page.url,
          score: this.scorer.calculateScore(page),
          bucket,
          metrics: page,
          brief: this.briefGenerator.generate(page, bucket),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      result[bucket] = tasks
    }

    return result
  }

  getWeights(): WeightConfig {
    return this.scorer.getWeights()
  }

  setWeights(weights: Partial<WeightConfig>): void {
    this.scorer.setWeights(weights)
    this.config.weights = this.scorer.getWeights()
  }

  getCTRCurve(): CTRCurve {
    return this.scorer.getCTRCurve()
  }

  setCTRCurve(curve: Partial<CTRCurve>): void {
    this.scorer.setCTRCurve(curve)
    this.bucketer = createBucketer(undefined, this.scorer.getCTRCurve())
  }
}

export function createAnalyzer(config?: AnalyzerConfig): SEOAnalyzer {
  return new SEOAnalyzer(config)
}

export function quickAnalyze(
  pages: PageData[],
  weights?: Partial<WeightConfig>,
  ctrCurve?: CTRCurve
): SEOTask[] {
  const analyzer = new SEOAnalyzer({ weights, ctrCurve })
  return analyzer.analyzePages(pages)
}

export function generateDailyPlan(
  siteId: string,
  pages: PageData[],
  weights?: Partial<WeightConfig>,
  learningLog?: LearningLog[]
): DailyPlan {
  const analyzer = new SEOAnalyzer({ weights })
  return analyzer.generateDailyPlan(siteId, pages, learningLog)
}
