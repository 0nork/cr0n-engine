// ============================================================
// cr0n-engine — Data Aggregator
// Merges GSC and GA4 data into unified PageData format
// Standalone — no CRO9 dependencies
// ============================================================

import type { PageData, GSCPageData, GA4PageData } from '../core/types.js'
import { LOCAL_INDICATORS } from '../core/constants.js'

export class DataAggregator {
  private normalizeUrl(url: string): string {
    try {
      if (url.startsWith('http')) {
        const urlObj = new URL(url)
        return urlObj.pathname.toLowerCase().replace(/\/$/, '') || '/'
      }
      return url.toLowerCase().replace(/\/$/, '') || '/'
    } catch {
      return url.toLowerCase().replace(/\/$/, '') || '/'
    }
  }

  private detectIntent(url: string, keyword: string): PageData['intent'] {
    const combined = `${url} ${keyword}`.toLowerCase()

    if (this.hasLocalIntent(combined)) return 'local'

    const transactionalPatterns = [
      /buy|purchase|order|price|pricing|cost|shop|cart|checkout/i,
      /free trial|signup|sign up|get started|demo/i,
      /quote|estimate|booking|schedule/i,
    ]

    for (const pattern of transactionalPatterns) {
      if (pattern.test(combined)) return 'transactional'
    }

    const informationalPatterns = [
      /what is|how to|guide|tutorial|learn|tips|best practices/i,
      /blog|article|news|update/i,
      /definition|meaning|explained/i,
    ]

    for (const pattern of informationalPatterns) {
      if (pattern.test(combined)) return 'informational'
    }

    return 'mixed'
  }

  private hasLocalIntent(text: string): boolean {
    for (const keyword of LOCAL_INDICATORS.keywords) {
      if (text.includes(keyword.toLowerCase())) return true
    }

    for (const pattern of LOCAL_INDICATORS.cityPatterns) {
      if (pattern.test(text)) return true
    }

    return false
  }

  private extractLocalKeywords(text: string): string[] {
    const keywords: string[] = []

    for (const pattern of LOCAL_INDICATORS.cityPatterns) {
      const match = text.match(pattern)
      if (match) keywords.push(match[0])
    }

    for (const keyword of LOCAL_INDICATORS.keywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        keywords.push(keyword)
      }
    }

    return [...new Set(keywords)]
  }

  private calculateFreshnessScore(lastUpdate?: string): number {
    if (!lastUpdate) return 0.5

    const updateDate = new Date(lastUpdate)
    const now = new Date()
    const daysSinceUpdate = Math.floor(
      (now.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    return Math.min(daysSinceUpdate / 365, 1)
  }

  aggregate(
    gscData: GSCPageData[],
    ga4Data: GA4PageData[],
    lastUpdates?: Map<string, string>
  ): PageData[] {
    const ga4Map = new Map<string, GA4PageData>()
    for (const ga4 of ga4Data) {
      const normalizedPath = this.normalizeUrl(ga4.pagePath)
      ga4Map.set(normalizedPath, ga4)
    }

    const pages: PageData[] = []

    for (const gsc of gscData) {
      const normalizedPath = this.normalizeUrl(gsc.url)
      const ga4 = ga4Map.get(normalizedPath)
      const combined = `${gsc.url} ${gsc.query}`
      const lastUpdate = lastUpdates?.get(gsc.url)

      const pageData: PageData = {
        url: gsc.url,
        primaryKeyword: gsc.query || this.extractKeywordFromUrl(gsc.url),
        clicks: gsc.clicks,
        impressions: gsc.impressions,
        ctr: gsc.ctr,
        position: gsc.position,
        sessions: ga4?.sessions ?? 0,
        conversions: ga4?.conversions ?? 0,
        bounceRate: ga4?.bounceRate ?? 0,
        avgSessionDuration: ga4?.avgSessionDuration ?? 0,
        intent: this.detectIntent(gsc.url, gsc.query),
        isLocalPage: this.hasLocalIntent(combined),
        localKeywords: this.extractLocalKeywords(combined),
        freshnessScore: this.calculateFreshnessScore(lastUpdate),
        lastContentUpdate: lastUpdate,
        lastUpdated: new Date().toISOString(),
      }

      pages.push(pageData)
    }

    return pages
  }

  private extractKeywordFromUrl(url: string): string {
    try {
      const path = this.normalizeUrl(url)
      const segments = path.replace(/^\/|\/$/g, '').split(/[-_/]/)
      const keyword = segments.filter(s => s.length > 0).pop() || ''
      return keyword.replace(/-/g, ' ')
    } catch {
      return ''
    }
  }
}

export function createAggregator(): DataAggregator {
  return new DataAggregator()
}

export function aggregateData(
  gscData: GSCPageData[],
  ga4Data: GA4PageData[],
  lastUpdates?: Map<string, string>
): PageData[] {
  const aggregator = new DataAggregator()
  return aggregator.aggregate(gscData, ga4Data, lastUpdates)
}
