// ============================================================
// cr0n-engine — Core Type Definitions
// Extracted from CRO9 + extended with federation types
// ============================================================

// ============================================================
// Core Data Types
// ============================================================

export interface PageData {
  id?: string
  url: string
  primaryKeyword: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  conversions: number
  sessions: number
  bounceRate: number
  avgSessionDuration: number
  intent: 'local' | 'transactional' | 'informational' | 'mixed'
  isLocalPage: boolean
  localKeywords: string[]
  freshnessScore: number
  lastContentUpdate?: string
  lastUpdated?: string
}

export interface NormalizedScores {
  impressions: number
  position: number
  ctrGap: number
  conversions: number
  freshness: number
}

export interface OpportunityScore {
  total: number
  breakdown: NormalizedScores
  bucket: ActionBucket
}

// ============================================================
// Action Buckets
// ============================================================

export type ActionBucket =
  | 'CTR_FIX'
  | 'STRIKING_DISTANCE'
  | 'RELEVANCE_REBUILD'
  | 'LOCAL_BOOST'
  | 'MONITOR'

export const ACTION_BUCKETS: ActionBucket[] = [
  'CTR_FIX',
  'STRIKING_DISTANCE',
  'RELEVANCE_REBUILD',
  'LOCAL_BOOST',
  'MONITOR',
]

export interface BucketCriteria {
  CTR_FIX: {
    minImpressions: number
    ctrGapThreshold: number
  }
  STRIKING_DISTANCE: {
    minPosition: number
    maxPosition: number
    minImpressions: number
  }
  RELEVANCE_REBUILD: {
    minPosition: number
    maxPosition: number
    minImpressions: number
  }
  LOCAL_BOOST: {
    requiresLocalIntent: boolean
  }
  MONITOR: {
    maxPosition: number
  }
}

// ============================================================
// Weights & Learning
// ============================================================

export interface WeightConfig {
  impressions: number
  position: number
  ctrGap: number
  conversions: number
  freshness: number
}

export interface LearningConfig {
  learningRate: number
  minWeight: number
  maxWeight: number
}

export interface SavedWeights extends WeightConfig {
  learningRate: number
  minWeight: number
  maxWeight: number
  totalLearningCycles: number
  lastLearningAt?: string
}

export interface WeightAdjustment {
  weight: keyof WeightConfig
  oldValue: number
  newValue: number
  reason: string
}

// ============================================================
// Content Briefs
// ============================================================

export interface ContentBrief {
  id?: string
  url: string
  targetKeyword: string
  bucket: ActionBucket

  // Meta strategy
  titleRecommendations: string[]
  h1Recommendation: string
  metaDescription: string

  // Content structure
  targetWordCount: number
  h2Additions: string[]
  internalLinks: { url: string; anchor: string }[]

  // Priority tasks
  priorityTasks: string[]

  // Schema recommendations
  schemaStack: string[]

  // Keyword engineering
  keywordDensityTarget: string
  mandatoryPlacements: string[]

  // Metrics snapshot
  metricsSnapshot?: Partial<PageData>

  // Status
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'cancelled'

  // Content Writer integration
  contentWriterJobId?: string
  generatedContent?: string
  generatedWordCount?: number

  // Federation metadata
  generatedBy?: string          // Model ID that generated this brief
  contributingModels?: string[] // All models that influenced this brief
  consensusConfidence?: number  // 0-1 agreement score
}

// ============================================================
// Actions
// ============================================================

export interface SEOAction {
  id?: string
  siteId: string
  pageId?: string
  url: string
  actionType: ActionBucket
  actionStatus: 'pending' | 'in_progress' | 'completed' | 'failed'

  // Original metrics
  originalClicks: number
  originalImpressions: number
  originalCtr: number
  originalPosition: number
  originalConversions: number

  // Weights at time of action
  weightsSnapshot: WeightConfig

  // Brief
  briefId?: string
  contentBrief?: ContentBrief

  // Results (populated after evaluation)
  resultClicks?: number
  resultImpressions?: number
  resultCtr?: number
  resultPosition?: number
  resultConversions?: number
  resultDeltaTraffic?: number

  // Learning
  learningApplied: boolean
  successScore?: number
  successCriteria?: string
  learningNotes?: string

  // Federation tracking
  modelUsed?: string            // Which model generated the brief
  contributingModels?: string[] // All models that contributed

  // Timestamps
  actionDate: string
  evaluatedAt?: string
  createdAt: string
}

// ============================================================
// Daily Plans
// ============================================================

export interface SEOTask {
  url: string
  score: number
  bucket: ActionBucket
  metrics: PageData
  brief: ContentBrief
}

export interface LearningLog {
  date: string
  action: string
  result: string
  weightAdj: string
  details?: {
    url: string
    actionType: ActionBucket
    deltaMetric: number
    metricType: string
  }
}

export interface DailyPlan {
  date: string
  siteId: string
  activeWeights: WeightConfig
  tasks: SEOTask[]
  learningLog: LearningLog[]
  stats: {
    totalPagesAnalyzed: number
    pagesWithOpportunities: number
    bucketDistribution: Record<ActionBucket, number>
  }
}

// ============================================================
// Analysis Runs
// ============================================================

export interface AnalysisRun {
  id?: string
  siteId: string
  runDate: string
  runType: 'scheduled' | 'manual'

  totalPagesAnalyzed: number
  pagesWithOpportunities: number
  briefsGenerated: number

  ctrFixCount: number
  strikingDistanceCount: number
  relevanceRebuildCount: number
  localBoostCount: number
  monitorCount: number

  learningCycleRan: boolean
  actionsEvaluated: number
  successfulActions: number
  weightAdjustments: WeightAdjustment[]

  gscSyncSuccess: boolean
  ga4SyncSuccess: boolean
  syncErrors: string[]

  notificationSent: boolean

  startedAt: string
  completedAt?: string
  durationMs?: number
}

// ============================================================
// CTR Curve
// ============================================================

export interface CTRCurve {
  position1: number
  position2: number
  position3: number
  position4: number
  position5: number
  position6: number
  position7: number
  position8: number
  position9: number
  position10: number
  position11_20: number
  position21Plus: number
  industry: string
  dataSource: 'industry_average' | 'custom' | 'calculated'
}

// ============================================================
// Federation — Model Types
// ============================================================

export type ModelId = 'claude' | 'openai' | 'gemini' | 'grok'

export const MODEL_IDS: ModelId[] = ['claude', 'openai', 'gemini', 'grok']

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'xai'

export interface ModelConfig {
  apiKey: string
  model?: string     // Override default model name
  baseURL?: string   // For custom endpoints (Grok)
}

/** Per-bucket model weight distribution. Must sum to 1.0 per bucket. */
export type ModelWeights = Record<ActionBucket, Record<ModelId, number>>

export interface ModelStats {
  modelId: ModelId
  totalTasks: number
  successfulTasks: number
  failedTasks: number
  successRate: number
  avgConfidence: number
  weightsByBucket: Record<ActionBucket, number>
}

// ============================================================
// Engine Configuration
// ============================================================

export interface EngineConfig {
  models: Partial<Record<ModelId, ModelConfig>>
  weights?: Partial<WeightConfig>
  modelWeights?: Partial<ModelWeights>
  maxTasksPerRun?: number
  includeMonitorBucket?: boolean
  consensusThreshold?: number    // 0-1, default 0.7
  evaluationDelayDays?: number
  maxActionAgeDays?: number
}

// ============================================================
// Engine Results
// ============================================================

export interface CycleInput {
  pages: PageData[]
  completedActions?: SEOAction[]
  siteId?: string
}

export interface CycleResult {
  plan: DailyPlan
  evaluations: BatchEvaluationResult | null
  weights: WeightConfig
  modelWeights: ModelWeights
  modelStats: ModelStats[]
  learningLog: LearningLog[]
}

export interface BatchEvaluationResult {
  evaluated: EvaluationResult[]
  skipped: SEOAction[]
  stats: {
    total: number
    successful: number
    failed: number
    successRate: number
  }
  learningLogs: LearningLog[]
}

export interface EvaluationResult {
  action: SEOAction
  success: boolean
  successScore: number
  criteria: string
  deltaTraffic: number
  deltaPosition: number
  deltaCtr: number
  deltaImpressions: number
  learningLog: LearningLog
}

// ============================================================
// Data Aggregator Types (standalone, no CRO9 deps)
// ============================================================

export interface GSCPageData {
  url: string
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GA4PageData {
  pagePath: string
  sessions: number
  conversions: number
  bounceRate: number
  avgSessionDuration: number
}

// ============================================================
// Content Writer Bridge Types
// ============================================================

export interface ContentWriterInput {
  topic: string
  primaryKeyword: string
  secondaryKeywords: string[]
  postType: 'pillar' | 'cluster' | 'service' | 'news'
  tags: string[]
  targetWordCount: number
  customInstructions: string
}

// ============================================================
// CLI — Project Scanner Types
// ============================================================

export interface ProjectScan {
  rootDir: string
  packageJson: Record<string, any> | null
  tsconfig: Record<string, any> | null
  framework: string
  language: 'typescript' | 'javascript'
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun'
  directories: string[]
  filesByExtension: Record<string, number>
  configFiles: string[]
  entryPoints: string[]
  integrations: string[]
}

// ============================================================
// CLI — AI Brain Types
// ============================================================

export interface AIBrain {
  version: string
  generatedAt: string
  generatedBy: ModelId
  project: {
    name: string
    framework: string
    language: 'typescript' | 'javascript'
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun'
    entryPoints: string[]
  }
  integration: {
    configPath: string
    dataSourcePaths: string[]
    apiRoutePath: string
    cronPath: string
    recommendedPattern: string
  }
  models: {
    primary: ModelId
    apiKeyEnvVar: string
    recommended: ModelId[]
  }
  capabilities: string[]
  nextSteps: string[]
}
