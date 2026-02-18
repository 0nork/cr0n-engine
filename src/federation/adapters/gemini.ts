// ============================================================
// cr0n-engine — Gemini Adapter
// Google Gemini via @ai-sdk/google
// ============================================================

import type { ModelId, PageData, ActionBucket, ContentBrief } from '../../core/types.js'
import type {
  ModelAdapter,
  ModelAnalysis,
  BusinessContext,
  ContentScore,
  GeneratedContent,
} from '../types.js'
import { BUCKET_INSTRUCTIONS } from '../../core/constants.js'

export class GeminiAdapter implements ModelAdapter {
  id: ModelId = 'gemini'
  name: string
  provider = 'google'
  available: boolean

  private apiKey: string
  private modelName: string

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey
    this.modelName = model || 'gemini-2.0-flash'
    this.name = `Gemini ${this.modelName}`
    this.available = !!apiKey
  }

  async analyzeOpportunity(page: PageData, bucket: ActionBucket): Promise<ModelAnalysis> {
    const { generateObject } = await import('ai')
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
    const { z } = await import('zod')

    const google = createGoogleGenerativeAI({ apiKey: this.apiKey })

    const result = await generateObject({
      model: google(this.modelName),
      schema: z.object({
        confidence: z.number().min(0).max(1),
        priorityScore: z.number().min(0).max(1),
        recommendations: z.array(z.string()),
        keyInsights: z.array(z.string()),
        suggestedActions: z.array(z.string()),
      }),
      prompt: this.buildAnalysisPrompt(page, bucket),
    })

    return { modelId: this.id, bucket, ...result.object }
  }

  async generateBrief(page: PageData, bucket: ActionBucket, context?: BusinessContext): Promise<ContentBrief> {
    const { generateObject } = await import('ai')
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
    const { z } = await import('zod')

    const google = createGoogleGenerativeAI({ apiKey: this.apiKey })

    const result = await generateObject({
      model: google(this.modelName),
      schema: z.object({
        titleRecommendations: z.array(z.string()).min(1).max(3),
        h1Recommendation: z.string(),
        metaDescription: z.string(),
        targetWordCount: z.number(),
        h2Additions: z.array(z.string()),
        priorityTasks: z.array(z.string()),
        schemaStack: z.array(z.string()),
      }),
      prompt: this.buildBriefPrompt(page, bucket, context),
    })

    return {
      url: page.url,
      targetKeyword: page.primaryKeyword,
      bucket,
      ...result.object,
      internalLinks: [],
      keywordDensityTarget: '0.6% - 1.2%',
      mandatoryPlacements: ['First 100 words', 'One H2 exact match', 'Last 120 words'],
      metricsSnapshot: {
        clicks: page.clicks,
        impressions: page.impressions,
        ctr: page.ctr,
        position: page.position,
        conversions: page.conversions,
      },
      status: 'draft',
      generatedBy: this.id,
    }
  }

  async scoreContent(content: string, brief: ContentBrief): Promise<ContentScore> {
    const { generateObject } = await import('ai')
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
    const { z } = await import('zod')

    const google = createGoogleGenerativeAI({ apiKey: this.apiKey })

    const result = await generateObject({
      model: google(this.modelName),
      schema: z.object({
        overall: z.number().min(0).max(100),
        relevance: z.number().min(0).max(100),
        readability: z.number().min(0).max(100),
        seoAlignment: z.number().min(0).max(100),
        suggestions: z.array(z.string()),
      }),
      prompt: `Score this content against the SEO brief.\n\nKeyword: "${brief.targetKeyword}"\nBucket: ${brief.bucket}\nTarget words: ${brief.targetWordCount}\n\nContent:\n${content.slice(0, 3000)}`,
    })

    return { modelId: this.id, ...result.object }
  }

  async generateContent(brief: ContentBrief): Promise<GeneratedContent> {
    const { generateText } = await import('ai')
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google')

    const google = createGoogleGenerativeAI({ apiKey: this.apiKey })

    const result = await generateText({
      model: google(this.modelName),
      prompt: `Write SEO-optimized content for "${brief.targetKeyword}".\n\nBucket: ${brief.bucket}\nTarget: ${brief.targetWordCount} words\nH1: ${brief.h1Recommendation}\nH2s: ${brief.h2Additions.join(', ')}\n\nWrite in markdown.`,
    })

    const wordCount = result.text.split(/\s+/).length

    return {
      modelId: this.id,
      content: result.text,
      wordCount,
      title: brief.titleRecommendations[0] || brief.targetKeyword,
      metaDescription: brief.metaDescription,
      h2Sections: brief.h2Additions,
    }
  }

  private buildAnalysisPrompt(page: PageData, bucket: ActionBucket): string {
    const instructions = BUCKET_INSTRUCTIONS[bucket]
    return `Analyze this SEO opportunity.\n\nURL: ${page.url}\nKeyword: "${page.primaryKeyword}"\nPosition: ${page.position} | Impressions: ${page.impressions} | CTR: ${(page.ctr * 100).toFixed(2)}%\nClicks: ${page.clicks} | Intent: ${page.intent} | Freshness: ${page.freshnessScore}\n\nBucket: ${bucket}\nStrategy: ${instructions.instruction}\n\nProvide confidence, priority, recommendations, insights, and actions.`
  }

  private buildBriefPrompt(page: PageData, bucket: ActionBucket, context?: BusinessContext): string {
    const instructions = BUCKET_INSTRUCTIONS[bucket]
    let prompt = `Generate SEO content brief.\n\nURL: ${page.url}\nKeyword: "${page.primaryKeyword}"\nPosition: ${page.position} | Impressions: ${page.impressions} | CTR: ${(page.ctr * 100).toFixed(2)}%\nIntent: ${page.intent}\n\nBucket: ${bucket}\nStrategy: ${instructions.instruction}\n`

    if (context?.industry) prompt += `\nIndustry: ${context.industry}`
    if (context?.targetAudience) prompt += `\nAudience: ${context.targetAudience}`
    if (context?.customInstructions) prompt += `\n${context.customInstructions}`

    prompt += `\n\nGenerate titles, H2 sections, meta description, and priority tasks.`
    return prompt
  }
}
