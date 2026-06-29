import { RESTAURANTS_PER_REGION } from './api'
import type { MidpointResult } from '../types'

export const OG_SITE_NAME = 'Moim — AI 소셜 미팅 플래너'
export const OG_DEFAULT_TITLE = OG_SITE_NAME
export const OG_DEFAULT_DESCRIPTION =
  '우리 모임, 어디서 만날까? AI가 최적의 장소를 추천해드려요 🗺️'

export function getSiteBaseUrl(): string {
  const configured = import.meta.env.VITE_SHARE_BASE_URL?.replace(/\/$/, '')
  if (configured) return configured

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return 'https://moim.vercel.app'
}

export function getOgImageUrl(baseUrl = getSiteBaseUrl()): string {
  return `${baseUrl}/og-image.png`
}

export function countShareRestaurants(result: MidpointResult): number {
  return result.regions.reduce(
    (total, region) =>
      total + Math.min(region.restaurants.length, RESTAURANTS_PER_REGION),
    0,
  )
}

export interface VoteOgMetadata {
  purpose: string
  region1: string
  region2: string
  restaurantCount: number
}

export function buildVoteOgMetadata(result: MidpointResult): VoteOgMetadata {
  return {
    purpose: result.purpose || '모임',
    region1: result.regions[0]?.name ?? '지역 1',
    region2: result.regions[1]?.name ?? '지역 2',
    restaurantCount: countShareRestaurants(result),
  }
}

export function buildVoteOgTitle(metadata: VoteOgMetadata): string {
  return `Moim — ${metadata.purpose} 모임 장소 투표`
}

export function buildVoteOgDescription(metadata: VoteOgMetadata): string {
  return `${metadata.region1} vs ${metadata.region2} · 식당 후보 ${metadata.restaurantCount}개 · 지금 투표해주세요!`
}

export function buildVoteShareSearchParams(
  metadata: VoteOgMetadata,
): URLSearchParams {
  const params = new URLSearchParams()
  params.set('purpose', metadata.purpose)
  params.set('r1', metadata.region1)
  params.set('r2', metadata.region2)
  params.set('n', String(metadata.restaurantCount))
  return params
}

export function buildVoteShareUrl(
  shareId: string,
  metadata: VoteOgMetadata,
  baseUrl = getSiteBaseUrl(),
): string {
  const params = buildVoteShareSearchParams(metadata)
  return `${baseUrl}/vote/${shareId}?${params.toString()}`
}

export function parseVoteOgMetadata(
  searchParams: URLSearchParams,
): VoteOgMetadata | null {
  const purpose = searchParams.get('purpose')
  const region1 = searchParams.get('r1')
  const region2 = searchParams.get('r2')
  const countRaw = searchParams.get('n')

  if (!purpose || !region1 || !region2 || !countRaw) return null

  const restaurantCount = Number.parseInt(countRaw, 10)
  if (Number.isNaN(restaurantCount)) return null

  return {
    purpose,
    region1,
    region2,
    restaurantCount,
  }
}

export function setDocumentMeta(name: string, content: string) {
  if (typeof document === 'undefined') return

  let element =
    document.querySelector(`meta[name="${name}"]`) ??
    document.querySelector(`meta[property="${name}"]`)

  if (!element) {
    element = document.createElement('meta')
    if (name.startsWith('og:')) {
      element.setAttribute('property', name)
    } else {
      element.setAttribute('name', name)
    }
    document.head.appendChild(element)
  }

  element.setAttribute('content', content)
}

export function applyVoteOgTags(metadata: VoteOgMetadata, shareUrl: string) {
  const title = buildVoteOgTitle(metadata)
  const description = buildVoteOgDescription(metadata)
  const imageUrl = getOgImageUrl()

  document.title = title
  setDocumentMeta('description', description)
  setDocumentMeta('og:site_name', 'Moim')
  setDocumentMeta('og:title', title)
  setDocumentMeta('og:description', description)
  setDocumentMeta('og:url', shareUrl)
  setDocumentMeta('og:image', imageUrl)
  setDocumentMeta('twitter:title', title)
  setDocumentMeta('twitter:description', description)
  setDocumentMeta('twitter:image', imageUrl)
}
