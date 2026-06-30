import { get, onValue, ref, set, update } from 'firebase/database'
import { nanoid } from 'nanoid'

import { getFirebaseDb, getVoteRefPath, isFirebaseConfigured } from './firebase'
import {
  buildVoteOgMetadata,
  buildVoteShareUrl,
  getSiteBaseUrl,
} from './og'
import type { MidpointResult } from '../types'

function parseMidpointResult(value: unknown): MidpointResult | null {
  if (typeof value !== 'object' || value === null) return null

  const data = value as Partial<MidpointResult>
  if (!Array.isArray(data.regions) || typeof data.purpose !== 'string') {
    return null
  }

  return {
    purpose: data.purpose,
    budget: data.budget ?? '',
    vibe: data.vibe ?? '',
    peopleCount: data.peopleCount ?? 0,
    regions: data.regions,
    fairnessScore: data.fairnessScore ?? 0,
    matchScore: data.matchScore ?? 0,
    balances: data.balances ?? [],
    summary: data.summary ?? '',
    shareId: data.shareId ?? '',
    votes: data.votes ?? {},
    midpointRegionName: data.midpointRegionName,
    balancesFromKakao: data.balancesFromKakao,
  }
}

export async function createShareLink(result: MidpointResult): Promise<{
  url: string
  updatedResult: MidpointResult
}> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase가 설정되지 않았습니다')
  }

  const shareId = nanoid(10)
  const updatedResult: MidpointResult = { ...result, shareId, votes: result.votes ?? {} }

  const db = getFirebaseDb()
  await set(ref(db, getVoteRefPath(shareId)), updatedResult)

  const metadata = buildVoteOgMetadata(updatedResult)
  const shareUrl = buildVoteShareUrl(shareId, metadata, getSiteBaseUrl())

  return { url: shareUrl, updatedResult }
}

export async function loadSharedResult(
  shareId: string,
): Promise<MidpointResult | null> {
  if (!isFirebaseConfigured()) return null

  const db = getFirebaseDb()
  const snapshot = await get(ref(db, getVoteRefPath(shareId)))

  if (!snapshot.exists()) return null
  return parseMidpointResult(snapshot.val())
}

export function subscribeSharedResult(
  shareId: string,
  onData: (result: MidpointResult | null) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!isFirebaseConfigured()) {
    onData(null)
    return () => {}
  }

  const db = getFirebaseDb()
  const voteRef = ref(db, getVoteRefPath(shareId))

  const unsubscribe = onValue(
    voteRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null)
        return
      }
      onData(parseMidpointResult(snapshot.val()))
    },
    (error) => {
      onError?.(error)
    },
  )

  return unsubscribe
}

export async function saveSharedVotes(
  shareId: string,
  votes: MidpointResult['votes'],
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase가 설정되지 않았습니다')
  }

  const db = getFirebaseDb()
  await update(ref(db, getVoteRefPath(shareId)), { votes })
}
