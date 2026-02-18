// ============================================================
// cr0n-engine — Content Writer Bridge
// Converts briefs into AI Content Writer input format
// ============================================================

import type { ContentBrief, ContentWriterInput } from '../core/types.js'

export class ContentWriterBridge {
  formatBriefForContentWriter(brief: ContentBrief): ContentWriterInput {
    const postType = this.determinePostType(brief)
    const customInstructions = this.buildCustomInstructions(brief)

    return {
      topic: brief.titleRecommendations[0] || brief.targetKeyword,
      primaryKeyword: brief.targetKeyword,
      secondaryKeywords: this.extractSecondaryKeywords(brief),
      postType,
      tags: this.extractTags(brief),
      targetWordCount: brief.targetWordCount,
      customInstructions,
    }
  }

  private determinePostType(brief: ContentBrief): ContentWriterInput['postType'] {
    if (brief.targetWordCount >= 2200) return 'pillar'
    if (brief.targetWordCount >= 1000) return 'cluster'
    if (brief.bucket === 'LOCAL_BOOST') return 'service'
    return 'cluster'
  }

  private extractSecondaryKeywords(brief: ContentBrief): string[] {
    const keywords: string[] = []

    for (const h2 of brief.h2Additions) {
      const cleaned = h2
        .replace(/^(what is|how to|why|the|best|top|guide to)\s+/i, '')
        .replace(/\?$/, '')
        .toLowerCase()
        .trim()

      if (cleaned && cleaned !== brief.targetKeyword.toLowerCase()) {
        keywords.push(cleaned)
      }
    }

    for (const schema of brief.schemaStack) {
      if (!['Organization', 'WebSite', 'BreadcrumbList'].includes(schema)) {
        keywords.push(schema.toLowerCase())
      }
    }

    return [...new Set(keywords)].slice(0, 5)
  }

  private extractTags(brief: ContentBrief): string[] {
    const tags: string[] = []

    tags.push(brief.bucket.toLowerCase().replace(/_/g, '-'))

    if (brief.metricsSnapshot) {
      tags.push('seo-optimized')
    }

    if (brief.schemaStack.includes('LocalBusiness')) tags.push('local')
    if (brief.schemaStack.includes('FAQPage')) tags.push('faq')
    if (brief.schemaStack.includes('HowTo')) tags.push('guide')

    return [...new Set(tags)]
  }

  private buildCustomInstructions(brief: ContentBrief): string {
    const sections: string[] = []

    sections.push('=== CR0N ENGINE BRIEF ===')
    sections.push('')

    if (brief.metricsSnapshot) {
      sections.push('CURRENT METRICS:')
      sections.push(`- Position: ${brief.metricsSnapshot.position?.toFixed(1) || 'N/A'}`)
      sections.push(`- Impressions: ${brief.metricsSnapshot.impressions || 'N/A'}`)
      sections.push(`- CTR: ${((brief.metricsSnapshot.ctr || 0) * 100).toFixed(2)}%`)
      sections.push('')
    }

    sections.push(`ACTION TYPE: ${brief.bucket}`)
    sections.push('')

    sections.push('TITLE STRATEGY:')
    for (const title of brief.titleRecommendations) {
      sections.push(`- ${title}`)
    }
    sections.push('')

    sections.push(`H1 (EXACT MATCH): ${brief.h1Recommendation}`)
    sections.push('')

    sections.push('META DESCRIPTION:')
    sections.push(brief.metaDescription)
    sections.push('')

    sections.push('REQUIRED H2 SECTIONS:')
    for (const h2 of brief.h2Additions) {
      sections.push(`- ${h2}`)
    }
    sections.push('')

    sections.push('PRIORITY TASKS:')
    for (const task of brief.priorityTasks.slice(0, 5)) {
      sections.push(`- ${task}`)
    }
    sections.push('')

    sections.push('KEYWORD ENGINEERING:')
    sections.push(`- Primary: "${brief.targetKeyword}"`)
    sections.push(`- Density Target: ${brief.keywordDensityTarget}`)
    sections.push('- Mandatory Placements:')
    for (const placement of brief.mandatoryPlacements) {
      sections.push(`  - ${placement}`)
    }
    sections.push('')

    sections.push('SCHEMA MARKUP REQUIRED:')
    sections.push(brief.schemaStack.join(', '))
    sections.push('')

    if (brief.internalLinks.length > 0) {
      sections.push('INTERNAL LINKS TO INCLUDE:')
      for (const link of brief.internalLinks.slice(0, 3)) {
        sections.push(`- ${link.anchor} -> ${link.url}`)
      }
    }

    return sections.join('\n')
  }

  generateContentWriterUrl(brief: ContentBrief, briefId: string): string {
    const input = this.formatBriefForContentWriter(brief)

    const params = new URLSearchParams({
      briefId,
      topic: input.topic,
      keyword: input.primaryKeyword,
      type: input.postType,
      words: input.targetWordCount.toString(),
    })

    return `/content-writer?${params.toString()}`
  }
}

export function createContentWriterBridge(): ContentWriterBridge {
  return new ContentWriterBridge()
}

export function formatBriefForContentWriter(brief: ContentBrief): ContentWriterInput {
  const bridge = new ContentWriterBridge()
  return bridge.formatBriefForContentWriter(brief)
}
