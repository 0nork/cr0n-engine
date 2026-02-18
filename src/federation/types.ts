// ============================================================
// cr0n-engine — Federation Types
// Domain-agnostic multi-model orchestration interfaces
// ============================================================

import type {
  PageData,
  ActionBucket,
  ContentBrief,
  ModelId,
} from '../core/types.js'

// ============================================================
// Model Adapter Interface
// ============================================================

/**
 * Interface that each AI model adapter must implement.
 * Domain-agnostic — works for any analysis + generation task.
 */
export interface ModelAdapter {
  id: ModelId
  name: string
  provider: string
  available: boolean

  /** Analyze an opportunity and return structured analysis */
  analyzeOpportunity(page: PageData, bucket: ActionBucket): Promise<ModelAnalysis>

  /** Generate a content brief for a page */
  generateBrief(page: PageData, bucket: ActionBucket, context?: BusinessContext): Promise<ContentBrief>

  /** Score existing content against a brief */
  scoreContent(content: string, brief: ContentBrief): Promise<ContentScore>

  /** Generate content from a brief */
  generateContent(brief: ContentBrief): Promise<GeneratedContent>
}

// ============================================================
// Model Analysis
// ============================================================

export interface ModelAnalysis {
  modelId: ModelId
  bucket: ActionBucket
  confidence: number          // 0-1 how confident the model is
  priorityScore: number       // 0-1 priority ranking
  recommendations: string[]   // Actionable recommendations
  keyInsights: string[]       // Key observations
  suggestedActions: string[]  // Specific actions to take
  metadata?: Record<string, unknown>
}

// ============================================================
// Business Context (optional enrichment)
// ============================================================

export interface BusinessContext {
  industry?: string
  targetAudience?: string
  competitors?: string[]
  brandVoice?: string
  location?: string
  customInstructions?: string
}

// ============================================================
// Content Scoring
// ============================================================

export interface ContentScore {
  modelId: ModelId
  overall: number             // 0-100
  relevance: number           // 0-100
  readability: number         // 0-100
  seoAlignment: number        // 0-100
  suggestions: string[]
}

// ============================================================
// Generated Content
// ============================================================

export interface GeneratedContent {
  modelId: ModelId
  content: string
  wordCount: number
  title: string
  metaDescription: string
  h2Sections: string[]
}

// ============================================================
// Consensus Types
// ============================================================

export interface ModelContribution {
  modelId: ModelId
  weight: number              // Weight at time of contribution
  briefHash: string           // Hash of the brief for comparison
  analysis?: ModelAnalysis
  brief?: ContentBrief
}

export interface ConsensusResult {
  brief: ContentBrief                         // Merged best-of from all models
  confidence: number                          // 0-1 model agreement
  contributions: ModelContribution[]          // Which model influenced what
  primaryModel: ModelId                       // Model with highest weight
  modelOutputs: Map<ModelId, ContentBrief>    // Raw outputs for comparison
  strategy: 'consensus' | 'primary' | 'single'  // How the result was derived
}

// ============================================================
// Router Types
// ============================================================

export interface RouteDecision {
  models: ModelId[]           // Which models to query
  primary: ModelId            // Primary model for this bucket
  strategy: 'all' | 'top2' | 'primary_only'
  reason: string
}
