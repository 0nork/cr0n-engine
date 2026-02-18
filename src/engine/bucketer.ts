// ============================================================
// cr0n-engine — Action Bucket Classifier
// Assigns pages to action buckets based on criteria
// ============================================================

import type {
  PageData,
  ActionBucket,
  BucketCriteria,
  CTRCurve,
} from '../core/types.js'
import { BUCKET_CRITERIA, DEFAULT_CTR_CURVE, getExpectedCTR, LOCAL_INDICATORS } from '../core/constants.js'

export class ActionBucketer {
  private criteria: BucketCriteria
  private ctrCurve: CTRCurve

  constructor(criteria?: Partial<BucketCriteria>, ctrCurve?: CTRCurve) {
    this.criteria = { ...BUCKET_CRITERIA, ...criteria }
    this.ctrCurve = ctrCurve || DEFAULT_CTR_CURVE
  }

  private isCTRFix(page: PageData): boolean {
    const { minImpressions, ctrGapThreshold } = this.criteria.CTR_FIX
    const expectedCtr = getExpectedCTR(page.position, this.ctrCurve)

    return (
      page.impressions >= minImpressions &&
      page.ctr < expectedCtr * (1 - ctrGapThreshold)
    )
  }

  private isStrikingDistance(page: PageData): boolean {
    const { minPosition, maxPosition, minImpressions } = this.criteria.STRIKING_DISTANCE

    return (
      page.position >= minPosition &&
      page.position <= maxPosition &&
      page.impressions >= minImpressions
    )
  }

  private isRelevanceRebuild(page: PageData): boolean {
    const { minPosition, maxPosition, minImpressions } = this.criteria.RELEVANCE_REBUILD

    return (
      page.position >= minPosition &&
      page.position <= maxPosition &&
      page.impressions >= minImpressions
    )
  }

  private isLocalBoost(page: PageData): boolean {
    if (!page.isLocalPage && page.intent !== 'local') {
      const hasLocalKeyword = this.detectLocalIntent(page)
      if (!hasLocalKeyword) return false
    }

    return page.position > 3
  }

  private isMonitor(page: PageData): boolean {
    const { maxPosition } = this.criteria.MONITOR
    return page.position <= maxPosition
  }

  private detectLocalIntent(page: PageData): boolean {
    const urlAndKeyword = `${page.url} ${page.primaryKeyword}`.toLowerCase()

    for (const keyword of LOCAL_INDICATORS.keywords) {
      if (urlAndKeyword.includes(keyword.toLowerCase())) {
        return true
      }
    }

    for (const pattern of LOCAL_INDICATORS.cityPatterns) {
      if (pattern.test(urlAndKeyword)) {
        return true
      }
    }

    if (page.localKeywords && page.localKeywords.length > 0) {
      return true
    }

    return false
  }

  extractLocalKeywords(page: PageData): string[] {
    const localKeywords: string[] = []
    const urlAndKeyword = `${page.url} ${page.primaryKeyword}`

    for (const pattern of LOCAL_INDICATORS.cityPatterns) {
      const match = urlAndKeyword.match(pattern)
      if (match) {
        localKeywords.push(match[0])
      }
    }

    for (const keyword of LOCAL_INDICATORS.keywords) {
      if (urlAndKeyword.toLowerCase().includes(keyword.toLowerCase())) {
        localKeywords.push(keyword)
      }
    }

    return [...new Set(localKeywords)]
  }

  classify(page: PageData): ActionBucket {
    if (this.isMonitor(page)) return 'MONITOR'
    if (this.isCTRFix(page)) return 'CTR_FIX'
    if (this.isStrikingDistance(page)) return 'STRIKING_DISTANCE'
    if (this.isLocalBoost(page)) return 'LOCAL_BOOST'
    if (this.isRelevanceRebuild(page)) return 'RELEVANCE_REBUILD'
    return 'MONITOR'
  }

  classifyAll(pages: PageData[]): Array<PageData & { bucket: ActionBucket }> {
    return pages.map(page => ({
      ...page,
      bucket: this.classify(page),
    }))
  }

  groupByBucket(pages: PageData[]): Record<ActionBucket, PageData[]> {
    const groups: Record<ActionBucket, PageData[]> = {
      CTR_FIX: [],
      STRIKING_DISTANCE: [],
      RELEVANCE_REBUILD: [],
      LOCAL_BOOST: [],
      MONITOR: [],
    }

    for (const page of pages) {
      const bucket = this.classify(page)
      groups[bucket].push(page)
    }

    return groups
  }

  getBucketDistribution(pages: PageData[]): Record<ActionBucket, number> {
    const groups = this.groupByBucket(pages)

    return {
      CTR_FIX: groups.CTR_FIX.length,
      STRIKING_DISTANCE: groups.STRIKING_DISTANCE.length,
      RELEVANCE_REBUILD: groups.RELEVANCE_REBUILD.length,
      LOCAL_BOOST: groups.LOCAL_BOOST.length,
      MONITOR: groups.MONITOR.length,
    }
  }

  getCriteria(): BucketCriteria {
    return { ...this.criteria }
  }

  setCriteria(criteria: Partial<BucketCriteria>): void {
    this.criteria = { ...this.criteria, ...criteria }
  }
}

export function createBucketer(
  criteria?: Partial<BucketCriteria>,
  ctrCurve?: CTRCurve
): ActionBucketer {
  return new ActionBucketer(criteria, ctrCurve)
}

export function classifyBucket(
  page: PageData,
  criteria?: Partial<BucketCriteria>,
  ctrCurve?: CTRCurve
): ActionBucket {
  const bucketer = new ActionBucketer(criteria, ctrCurve)
  return bucketer.classify(page)
}

export function getBucketDistribution(
  pages: PageData[],
  criteria?: Partial<BucketCriteria>,
  ctrCurve?: CTRCurve
): Record<ActionBucket, number> {
  const bucketer = new ActionBucketer(criteria, ctrCurve)
  return bucketer.getBucketDistribution(pages)
}
