// ============================================================
// cr0n-engine — Content Brief Generator
// Generates structured content briefs based on bucket type
// ============================================================

import type {
  PageData,
  ActionBucket,
  ContentBrief,
} from '../core/types.js'
import {
  CONTENT_RULES,
  SCHEMA_STACKS,
  BUCKET_INSTRUCTIONS,
} from '../core/constants.js'

export class BriefGenerator {
  generate(page: PageData, bucket: ActionBucket): ContentBrief {
    const isPillar = this.isPillarContent(page)
    const wordCount = this.getTargetWordCount(isPillar)
    const bucketConfig = BUCKET_INSTRUCTIONS[bucket]

    return {
      url: page.url,
      targetKeyword: page.primaryKeyword,
      bucket,

      titleRecommendations: this.generateTitleRecommendations(page, bucket),
      h1Recommendation: this.generateH1Recommendation(page),
      metaDescription: this.generateMetaDescription(page, bucket),

      targetWordCount: wordCount,
      h2Additions: this.generateH2Additions(page, bucket),
      internalLinks: this.generateInternalLinkSuggestions(page),

      priorityTasks: bucketConfig.tasks,

      schemaStack: this.getSchemaStack(page),

      keywordDensityTarget: CONTENT_RULES.keywordDensity.target,
      mandatoryPlacements: CONTENT_RULES.mandatoryPlacements,

      metricsSnapshot: {
        clicks: page.clicks,
        impressions: page.impressions,
        ctr: page.ctr,
        position: page.position,
        conversions: page.conversions,
      },

      status: 'draft',
    }
  }

  private isPillarContent(page: PageData): boolean {
    if (page.impressions > 5000) return true

    const pillarPatterns = [
      /\/guide\//i,
      /\/ultimate-/i,
      /\/complete-/i,
      /\/pillar\//i,
      /\/hub\//i,
    ]

    return pillarPatterns.some(pattern => pattern.test(page.url))
  }

  private getTargetWordCount(isPillar: boolean): number {
    if (isPillar) {
      return Math.round(
        (CONTENT_RULES.wordCount.pillar.min + CONTENT_RULES.wordCount.pillar.max) / 2
      )
    }
    return Math.round(
      (CONTENT_RULES.wordCount.cluster.min + CONTENT_RULES.wordCount.cluster.max) / 2
    )
  }

  private generateTitleRecommendations(page: PageData, bucket: ActionBucket): string[] {
    const kw = page.primaryKeyword
    const year = new Date().getFullYear()
    const recommendations: string[] = []

    recommendations.push(`${this.capitalize(kw)}: Complete Guide`)

    if (bucket === 'CTR_FIX' || bucket === 'STRIKING_DISTANCE') {
      recommendations.push(`${this.capitalize(kw)} [${year} Guide]`)
      recommendations.push(`${this.capitalize(kw)}: What You Need to Know [Updated]`)
    }

    recommendations.push(`What is ${this.capitalize(kw)}? Everything Explained`)

    if (page.intent === 'local' || page.isLocalPage) {
      const location = page.localKeywords?.[0] || 'Your Area'
      recommendations.push(`Best ${this.capitalize(kw)} in ${location}`)
    }

    return recommendations.slice(0, 3)
  }

  private generateH1Recommendation(page: PageData): string {
    return this.capitalize(page.primaryKeyword)
  }

  private generateMetaDescription(page: PageData, bucket: ActionBucket): string {
    const kw = page.primaryKeyword
    const year = new Date().getFullYear()

    switch (bucket) {
      case 'CTR_FIX':
        return `Discover the complete guide to ${kw}. Learn proven strategies, expert tips, and actionable steps for ${year}. Click to start today!`

      case 'STRIKING_DISTANCE':
        return `Everything you need to know about ${kw}. In-depth coverage with examples, comparisons, and expert insights. Updated for ${year}.`

      case 'RELEVANCE_REBUILD':
        return `${this.capitalize(kw)} explained with the latest ${year} updates. Fresh insights, current statistics, and modern best practices.`

      case 'LOCAL_BOOST': {
        const location = page.localKeywords?.[0] || 'your area'
        return `Find the best ${kw} in ${location}. Local expertise, real reviews, and trusted recommendations. Contact us today!`
      }

      default:
        return `Comprehensive guide to ${kw}. Expert strategies, tips, and insights to help you succeed. Learn more now.`
    }
  }

  private generateH2Additions(page: PageData, bucket: ActionBucket): string[] {
    const kw = page.primaryKeyword
    const baseH2s: string[] = []

    switch (bucket) {
      case 'CTR_FIX':
        baseH2s.push(
          `What is ${this.capitalize(kw)}?`,
          `Why ${this.capitalize(kw)} Matters`,
          `Key Benefits of ${this.capitalize(kw)}`,
        )
        break

      case 'STRIKING_DISTANCE':
        baseH2s.push(
          `How ${this.capitalize(kw)} Works`,
          `${this.capitalize(kw)} Benefits and Results`,
          `Case Study: ${this.capitalize(kw)} in Action`,
          `Step-by-Step ${this.capitalize(kw)} Guide`,
          `Common ${this.capitalize(kw)} Mistakes to Avoid`,
        )
        break

      case 'RELEVANCE_REBUILD': {
        const year = new Date().getFullYear()
        baseH2s.push(
          `${this.capitalize(kw)} in ${year}: What's Changed`,
          `Latest ${this.capitalize(kw)} Trends and Statistics`,
          `Updated Best Practices for ${this.capitalize(kw)}`,
          `Future of ${this.capitalize(kw)}`,
        )
        break
      }

      case 'LOCAL_BOOST': {
        const location = page.localKeywords?.[0] || 'Your Area'
        baseH2s.push(
          `Top ${this.capitalize(kw)} Services in ${location}`,
          `Why Choose Local ${this.capitalize(kw)}`,
          `${this.capitalize(kw)} Pricing in ${location}`,
          `Customer Reviews and Testimonials`,
        )
        break
      }

      case 'MONITOR':
        baseH2s.push(
          `Frequently Asked Questions About ${this.capitalize(kw)}`,
          `Expert Tips for ${this.capitalize(kw)}`,
        )
        break
    }

    return baseH2s
  }

  private generateInternalLinkSuggestions(page: PageData): Array<{ url: string; anchor: string }> {
    return [
      { url: '/related-topic-1', anchor: `Learn more about ${page.primaryKeyword}` },
      { url: '/services', anchor: 'Our services' },
      { url: '/contact', anchor: 'Contact us' },
    ]
  }

  private getSchemaStack(page: PageData): string[] {
    const base = [...SCHEMA_STACKS.base]
    let intentStack: string[] = []

    switch (page.intent) {
      case 'local':
        intentStack = SCHEMA_STACKS.local
        break
      case 'transactional':
        intentStack = SCHEMA_STACKS.transactional
        break
      case 'informational':
        intentStack = SCHEMA_STACKS.informational
        break
      default:
        intentStack = SCHEMA_STACKS.mixed
    }

    if (page.isLocalPage && !intentStack.includes('LocalBusiness')) {
      intentStack.push('LocalBusiness', 'AreaServed')
    }

    return [...base, ...intentStack]
  }

  private capitalize(str: string): string {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }
}

export function createBriefGenerator(): BriefGenerator {
  return new BriefGenerator()
}

export function generateBrief(page: PageData, bucket: ActionBucket): ContentBrief {
  const generator = new BriefGenerator()
  return generator.generate(page, bucket)
}
