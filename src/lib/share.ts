import { nanoid } from 'nanoid'

import type { MidpointResult } from '../types'

const DEFAULT_SHARE_BASE = 'https://yourdomain.com'

export function getShareBaseUrl(): string {
  return import.meta.env.VITE_SHARE_BASE_URL ?? DEFAULT_SHARE_BASE
}

export function createShareLink(result: MidpointResult): {
  url: string
  updatedResult: MidpointResult
} {
  const shareId = nanoid(10)
  const updatedResult: MidpointResult = { ...result, shareId }

  localStorage.setItem(`midpoint_${shareId}`, JSON.stringify(updatedResult))

  const url = `${getShareBaseUrl()}/vote/${shareId}`

  return { url, updatedResult }
}

export function loadSharedResult(shareId: string): MidpointResult | null {
  const raw = localStorage.getItem(`midpoint_${shareId}`)
  if (!raw) return null

  try {
    return JSON.parse(raw) as MidpointResult
  } catch {
    return null
  }
}

export function saveSharedResult(
  shareId: string,
  result: MidpointResult,
): void {
  localStorage.setItem(`midpoint_${shareId}`, JSON.stringify(result))
}

export function getStorageKey(shareId: string): string {
  return `midpoint_${shareId}`
}
