// ============================================================
// cr0n-engine — Constants & Configuration
// Extracted from CRO9
// ============================================================

import type {
  WeightConfig,
  LearningConfig,
  BucketCriteria,
  CTRCurve,
  ModelWeights,
  ActionBucket,
} from './types.js'

// ============================================================
// Default Weights
// ============================================================

export const DEFAULT_WEIGHTS: WeightConfig = {
  impressions: 0.20,
  position: 0.20,
  ctrGap: 0.20,
  conversions: 0.20,
  freshness: 0.20,
}

export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  learningRate: 0.015,
  minWeight: 0.05,
  maxWeight: 0.50,
}

// ============================================================
// Default Model Weights (equal across all 4 models, per bucket)
// ============================================================

export const DEFAULT_MODEL_WEIGHTS: ModelWeights = {
  CTR_FIX:           { claude: 0.25, openai: 0.25, gemini: 0.25, grok: 0.25 },
  STRIKING_DISTANCE: { claude: 0.25, openai: 0.25, gemini: 0.25, grok: 0.25 },
  RELEVANCE_REBUILD: { claude: 0.25, openai: 0.25, gemini: 0.25, grok: 0.25 },
  LOCAL_BOOST:       { claude: 0.25, openai: 0.25, gemini: 0.25, grok: 0.25 },
  MONITOR:           { claude: 0.25, openai: 0.25, gemini: 0.25, grok: 0.25 },
}

// ============================================================
// Expected CTR by Position (Industry Averages)
// ============================================================

export const DEFAULT_CTR_CURVE: CTRCurve = {
  position1: 0.32,
  position2: 0.20,
  position3: 0.13,
  position4: 0.09,
  position5: 0.07,
  position6: 0.05,
  position7: 0.04,
  position8: 0.03,
  position9: 0.025,
  position10: 0.02,
  position11_20: 0.01,
  position21Plus: 0.005,
  industry: 'general',
  dataSource: 'industry_average',
}

export function getExpectedCTR(position: number, curve: CTRCurve = DEFAULT_CTR_CURVE): number {
  const pos = Math.round(position)

  if (pos <= 0) return curve.position1
  if (pos === 1) return curve.position1
  if (pos === 2) return curve.position2
  if (pos === 3) return curve.position3
  if (pos === 4) return curve.position4
  if (pos === 5) return curve.position5
  if (pos === 6) return curve.position6
  if (pos === 7) return curve.position7
  if (pos === 8) return curve.position8
  if (pos === 9) return curve.position9
  if (pos === 10) return curve.position10
  if (pos <= 20) return curve.position11_20
  return curve.position21Plus
}

// ============================================================
// Bucket Criteria
// ============================================================

export const BUCKET_CRITERIA: BucketCriteria = {
  CTR_FIX: {
    minImpressions: 500,
    ctrGapThreshold: 0.05,
  },
  STRIKING_DISTANCE: {
    minPosition: 4,
    maxPosition: 10,
    minImpressions: 100,
  },
  RELEVANCE_REBUILD: {
    minPosition: 11,
    maxPosition: 50,
    minImpressions: 50,
  },
  LOCAL_BOOST: {
    requiresLocalIntent: true,
  },
  MONITOR: {
    maxPosition: 3,
  },
}

// ============================================================
// Content Rules
// ============================================================

export const CONTENT_RULES = {
  wordCount: {
    pillar: { min: 2200, max: 3200 },
    cluster: { min: 1000, max: 1600 },
    service: { min: 900, max: 1400 },
    news: { min: 600, max: 1000 },
  },

  keywordDensity: {
    min: 0.006,
    max: 0.012,
    target: '0.6% - 1.2%',
  },

  structure: {
    readingLevel: 'Grade 8',
    paragraphMaxWords: 85,
    sentenceMaxWords: 20,
    h2FrequencyWords: 220,
  },

  mandatoryPlacements: [
    'First 100 words',
    'One H2 exact match',
    'Last 120 words',
  ],
}

// ============================================================
// Schema Stacks by Intent
// ============================================================

export const SCHEMA_STACKS = {
  base: ['Organization', 'WebSite', 'BreadcrumbList'],
  local: ['LocalBusiness', 'Service', 'AreaServed', 'Review'],
  transactional: ['Service', 'FAQPage', 'Product', 'Offer'],
  informational: ['Article', 'FAQPage', 'Person', 'HowTo'],
  mixed: ['Article', 'FAQPage', 'Service'],
}

// ============================================================
// Local Keywords Detection
// ============================================================

export const LOCAL_INDICATORS = {
  keywords: [
    'near me',
    'nearby',
    'local',
    'in my area',
    'close to me',
  ],

  cityPatterns: [
    /\b(pittsburgh|chicago|new york|los angeles|houston|phoenix)\b/i,
    /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/,
  ],

  servicePatterns: [
    /serving\s+/i,
    /service\s+area/i,
    /located\s+in/i,
  ],
}

// ============================================================
// Success Criteria by Bucket
// ============================================================

export const SUCCESS_CRITERIA: Record<ActionBucket, {
  metric: string
  improvement: number
  description: string
}> = {
  CTR_FIX: {
    metric: 'ctr',
    improvement: 0.20,
    description: 'CTR improved by 20% or more',
  },
  STRIKING_DISTANCE: {
    metric: 'position',
    improvement: 2,
    description: 'Position improved by 2+ spots',
  },
  RELEVANCE_REBUILD: {
    metric: 'impressions',
    improvement: 0.50,
    description: 'Impressions grew by 50% or more',
  },
  LOCAL_BOOST: {
    metric: 'clicks',
    improvement: 0.30,
    description: 'Clicks improved by 30% or more',
  },
  MONITOR: {
    metric: 'position',
    improvement: 0,
    description: 'Position maintained or improved',
  },
}

// ============================================================
// Evaluation Period
// ============================================================

export const EVALUATION_CONFIG = {
  evaluationDelayDays: 14,
  minDataDays: 7,
  maxActionAgeDays: 60,
}

// ============================================================
// Bucket-Specific Brief Instructions
// ============================================================

export const BUCKET_INSTRUCTIONS: Record<ActionBucket, {
  priorityAction: string
  instruction: string
  tasks: string[]
}> = {
  CTR_FIX: {
    priorityAction: 'REWRITE_META_AND_INTRO',
    instruction: 'The content ranks but doesn\'t get clicks. Rewrite the Title Tag and the first paragraph to be a "Hook" or "Direct Answer". Create 3 title variations with brackets for CTR improvement.',
    tasks: [
      'Create 3 compelling title variations with brackets [2024 Guide], [Updated], etc.',
      'Rewrite meta description with clear value proposition and CTA',
      'Add a hook or direct answer in first paragraph',
      'Review featured snippet opportunity',
      'Add FAQ schema for SERP real estate',
    ],
  },
  STRIKING_DISTANCE: {
    priorityAction: 'EXPAND_DEPTH',
    instruction: 'Content ranks position 4-10. Add depth to push into top 3. Focus on comprehensive coverage and internal linking.',
    tasks: [
      'Add 2-3 new H2 sections covering related subtopics',
      'Expand existing sections with more detail',
      'Add internal links to 3-5 related pages',
      'Include a case study or example section',
      'Add comparison table if applicable',
      'Optimize for featured snippet with direct answers',
    ],
  },
  RELEVANCE_REBUILD: {
    priorityAction: 'COMPLETE_OVERHAUL',
    instruction: 'Content has dropped in rankings or is stale. Complete refresh needed with updated information and improved structure.',
    tasks: [
      'Update all statistics and data to current year',
      'Refresh introduction with current trends',
      'Add new sections covering recent developments',
      'Update internal and external links',
      'Improve page load speed and Core Web Vitals',
      'Add/update lastmod date in sitemap',
      'Consider content consolidation if competing pages exist',
    ],
  },
  LOCAL_BOOST: {
    priorityAction: 'LOCAL_OPTIMIZATION',
    instruction: 'Page has local intent. Optimize for local search with location-specific content and schema.',
    tasks: [
      'Add LocalBusiness schema markup',
      'Include city/region in title and H1',
      'Add location-specific content section',
      'Include local testimonials/reviews',
      'Add Google Maps embed if applicable',
      'Optimize Google Business Profile linkage',
      'Add AreaServed schema',
    ],
  },
  MONITOR: {
    priorityAction: 'PROTECT_RANKINGS',
    instruction: 'Page ranks in top 3. Focus on maintaining position and protecting against competitors.',
    tasks: [
      'Monitor for ranking fluctuations weekly',
      'Update content freshness signals monthly',
      'Respond to competitor content improvements',
      'Build high-quality backlinks',
      'Optimize for Core Web Vitals',
      'Add new FAQ questions as search trends evolve',
    ],
  },
}

// ============================================================
// Federation Constants
// ============================================================

export const DEFAULT_CONSENSUS_THRESHOLD = 0.7

export const DEFAULT_MODEL_LEARNING_RATE = 0.02

export const MODEL_DEFAULTS: Record<string, { model: string; provider: string }> = {
  claude: { model: 'claude-sonnet-4-20250514', provider: 'anthropic' },
  openai: { model: 'gpt-4o', provider: 'openai' },
  gemini: { model: 'gemini-2.0-flash', provider: 'google' },
  grok:   { model: 'grok-3', provider: 'xai' },
}
