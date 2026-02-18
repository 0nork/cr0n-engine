// ============================================================
// cr0n-engine — OpenAI Adapter
// OpenAI GPT via @ai-sdk/openai
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

export class OpenAIAdapter implements ModelAdapter {
  id: ModelId = 'openai'
  name: string
  provider = 'openai'
  available: boolean

  private apiKey: string
  private modelName: string

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey
    this.modelName = model || 'gpt-4o'
    this.name = `OpenAI ${this.modelName}`
    this.available = !!apiKey
  }

  async analyzeOpportunity(page: PageData, bucket: ActionBucket): Promise<ModelAnalysis> {
    const { generateObject } = await import('ai')
    const { createOpenAI } = await import('@ai-sdk/openai')
    const { z } = await import('zod')

    const openai = createOpenAI({ apiKey: this.apiKey })

    const result = await generateObject({
      model: openai(this.modelName),
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
    const { createOpenAI } = await import('@ai-sdk/openai')
    const { z } = await import('zod')

    const openai = createOpenAI({ apiKey: this.apiKey })

    const result = await generateObject({
      model: openai(this.modelName),
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
    const { createOpenAI } = await import('@ai-sdk/openai')
    const { z } = await import('zod')

    const openai = createOpenAI({ apiKey: this.apiKey })

    const result = await generateObject({
      model: openai(this.modelName),
      schema: z.object({
        overall: z.number().min(0).max(100),
        relevance: z.number().min(0).max(100),
        readability: z.number().min(0).max(100),
        seoAlignment: z.number().min(0).max(100),
        suggestions: z.array(z.string()),
      }),
      prompt: `Score this content against the SEO brief.\n\nBrief target keyword: "${brief.targetKeyword}"\nBucket: ${brief.bucket}\nTarget word count: ${brief.targetWordCount}\n\nContent:\n${content.slice(0, 3000)}`,
    })

    return { modelId: this.id, ...result.object }
  }

  async generateContent(brief: ContentBrief): Promise<GeneratedContent> {
    const { generateText } = await import('ai')
    const { createOpenAI } = await import('@ai-sdk/openai')

    const openai = createOpenAI({ apiKey: this.apiKey })

    const result = await generateText({
      model: openai(this.modelName),
      prompt: `Write SEO-optimized content for the keyword "${brief.targetKeyword}".\n\nAction type: ${brief.bucket}\nTarget word count: ${brief.targetWordCount}\nH1: ${brief.h1Recommendation}\nH2 sections: ${brief.h2Additions.join(', ')}\n\nWrite the full article in markdown format.`,
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
    return `Analyze this SEO opportunity and provide recommendations.

URL: ${page.url}
Primary Keyword: "${page.primaryKeyword}"
Position: ${page.position} | Impressions: ${page.impressions} | CTR: ${(page.ctr * 100).toFixed(2)}%
Clicks: ${page.clicks} | Conversions: ${page.conversions} | Intent: ${page.intent}
Freshness Score: ${page.freshnessScore}

Bucket: ${bucket}
Strategy: ${instructions.instruction}

Provide confidence (0-1), priority (0-1), specific recommendations, key insights, and suggested actions.`
  }

  private buildBriefPrompt(page: PageData, bucket: ActionBucket, context?: BusinessContext): string {
    const instructions = BUCKET_INSTRUCTIONS[bucket]
    let prompt = `Generate an SEO content brief.\n\nURL: ${page.url}\nKeyword: "${page.primaryKeyword}"\nPosition: ${page.position} | Impressions: ${page.impressions} | CTR: ${(page.ctr * 100).toFixed(2)}%\nIntent: ${page.intent}\n\nBucket: ${bucket}\nStrategy: ${instructions.instruction}\n`

    if (context) {
      if (context.industry) prompt += `\nIndustry: ${context.industry}`
      if (context.targetAudience) prompt += `\nAudience: ${context.targetAudience}`
      if (context.brandVoice) prompt += `\nVoice: ${context.brandVoice}`
      if (context.customInstructions) prompt += `\n${context.customInstructions}`
    }

    prompt += `\n\nGenerate title recommendations, H2 sections, meta description, and priority tasks.`
    return prompt
  }
}
