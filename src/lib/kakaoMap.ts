import type { MidpointResult } from '../types'

const ADDRESS_SEARCH_URL =
  'https://dapi.kakao.com/v2/local/search/address.json'
const COORD2REGION_URL =
  'https://dapi.kakao.com/v2/local/geo/coord2regioncode.json'
const KEYWORD_SEARCH_URL =
  'https://dapi.kakao.com/v2/local/search/keyword.json'

const AVATAR_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const TRANSIT_ROAD_FACTOR = 1.4
const AVERAGE_SPEED_KMH = 30

export interface Coordinates {
  longitude: number
  latitude: number
}

export interface ParticipantLocation {
  location: string
  coords: Coordinates | null
}

export interface LocationWeight {
  location: string
  count: number
}

export interface MidpointAnalysis {
  midpoint: Coordinates | null
  midpointRegionName: string | null
  participants: ParticipantLocation[]
  locationWeights: LocationWeight[]
  totalPeople: number
  usedKakao: boolean
}

interface KakaoAddressDocument {
  x: string
  y: string
}

interface KakaoAddressResponse {
  documents?: KakaoAddressDocument[]
}

interface KakaoRegionDocument {
  region_1depth_name?: string
  region_2depth_name?: string
  region_3depth_name?: string
  region_4depth_name?: string
}

interface KakaoRegionResponse {
  documents?: KakaoRegionDocument[]
}

function getKakaoApiKey(): string | null {
  const apiKey = import.meta.env.VITE_KAKAO_REST_API_KEY
  if (!apiKey || apiKey === 'your_key_here') return null
  return apiKey
}

function kakaoHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `KakaoAK ${apiKey}`,
  }
}

export function haversineDistanceKm(
  from: Coordinates,
  to: Coordinates,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const lat1 = toRad(from.latitude)
  const lat2 = toRad(to.latitude)
  const deltaLat = toRad(to.latitude - from.latitude)
  const deltaLon = toRad(to.longitude - from.longitude)

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function estimateTransitMinutes(straightDistanceKm: number): number {
  const hours = (straightDistanceKm * TRANSIT_ROAD_FACTOR) / AVERAGE_SPEED_KMH
  return Math.max(1, Math.round(hours * 60))
}

export async function searchAddressCoordinates(
  query: string,
): Promise<Coordinates | null> {
  const apiKey = getKakaoApiKey()
  if (!apiKey) return null

  const url = `${ADDRESS_SEARCH_URL}?query=${encodeURIComponent(query)}`
  const response = await fetch(url, { headers: kakaoHeaders(apiKey) })

  if (!response.ok) return null

  const data: KakaoAddressResponse = await response.json()
  const document = data.documents?.[0]
  if (!document) return null

  return {
    longitude: Number.parseFloat(document.x),
    latitude: Number.parseFloat(document.y),
  }
}

async function searchKeywordCoordinates(
  query: string,
): Promise<Coordinates | null> {
  const apiKey = getKakaoApiKey()
  if (!apiKey) return null

  const url = `${KEYWORD_SEARCH_URL}?query=${encodeURIComponent(query)}`
  const response = await fetch(url, { headers: kakaoHeaders(apiKey) })

  if (!response.ok) return null

  const data: KakaoAddressResponse = await response.json()
  const document = data.documents?.[0]
  if (!document) return null

  return {
    longitude: Number.parseFloat(document.x),
    latitude: Number.parseFloat(document.y),
  }
}

export async function resolveDestinationCoordinates(
  query: string,
): Promise<Coordinates | null> {
  const addressResult = await searchAddressCoordinates(query)
  if (addressResult) return addressResult

  return searchKeywordCoordinates(query)
}

export async function reverseGeocodeRegionName(
  coords: Coordinates,
): Promise<string | null> {
  const apiKey = getKakaoApiKey()
  if (!apiKey) return null

  const url = `${COORD2REGION_URL}?x=${coords.longitude}&y=${coords.latitude}`
  const response = await fetch(url, { headers: kakaoHeaders(apiKey) })

  if (!response.ok) return null

  const data: KakaoRegionResponse = await response.json()
  const region =
    data.documents?.find((doc) => doc.region_3depth_name) ??
    data.documents?.[0]

  if (!region) return null

  const parts = [
    region.region_2depth_name,
    region.region_3depth_name,
    region.region_4depth_name,
  ].filter(Boolean)

  return parts.join(' ') || region.region_1depth_name || null
}

export function groupLocationsByHeadcount(
  locations: string[],
): LocationWeight[] {
  const grouped = new Map<string, LocationWeight>()

  for (const rawLocation of locations) {
    const location = rawLocation.trim()
    if (!location) continue

    const key = location.toLowerCase()
    const existing = grouped.get(key)

    if (existing) {
      existing.count += 1
    } else {
      grouped.set(key, { location, count: 1 })
    }
  }

  return Array.from(grouped.values())
}

/** 가중 평균 좌표 = Σ(좌표 × 인원수) / 전체 인원 */
export function computeWeightedMidpoint(
  entries: { coords: Coordinates; weight: number }[],
): Coordinates | null {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (totalWeight === 0) return null

  const totals = entries.reduce(
    (acc, entry) => ({
      longitude: acc.longitude + entry.coords.longitude * entry.weight,
      latitude: acc.latitude + entry.coords.latitude * entry.weight,
    }),
    { longitude: 0, latitude: 0 },
  )

  return {
    longitude: totals.longitude / totalWeight,
    latitude: totals.latitude / totalWeight,
  }
}

export async function analyzeParticipantLocations(
  locations: string[],
): Promise<MidpointAnalysis> {
  const locationWeights = groupLocationsByHeadcount(locations)
  const totalPeople = locations.filter((location) => location.trim()).length

  const emptyAnalysis: MidpointAnalysis = {
    midpoint: null,
    midpointRegionName: null,
    participants: locations.map((location) => ({ location, coords: null })),
    locationWeights,
    totalPeople,
    usedKakao: false,
  }

  const apiKey = getKakaoApiKey()
  if (!apiKey) return emptyAnalysis

  try {
    const coordsByLocation = new Map<string, Coordinates | null>()

    await Promise.all(
      locationWeights.map(async ({ location }) => {
        const coords = await searchAddressCoordinates(location)
        coordsByLocation.set(location.toLowerCase(), coords)
      }),
    )

    const participants = locations.map((location) => ({
      location,
      coords: coordsByLocation.get(location.trim().toLowerCase()) ?? null,
    }))

    const weightedEntries = locationWeights
      .map(({ location, count }) => {
        const coords = coordsByLocation.get(location.toLowerCase())
        return coords ? { coords, weight: count } : null
      })
      .filter((entry): entry is { coords: Coordinates; weight: number } =>
        entry !== null,
      )

    if (weightedEntries.length === 0) {
      return { ...emptyAnalysis, participants }
    }

    const midpoint = computeWeightedMidpoint(weightedEntries)
    const midpointRegionName = midpoint
      ? await reverseGeocodeRegionName(midpoint)
      : null

    return {
      midpoint,
      midpointRegionName,
      participants,
      locationWeights,
      totalPeople,
      usedKakao: true,
    }
  } catch {
    return emptyAnalysis
  }
}

export function buildFallbackBalances(
  locations: string[],
): MidpointResult['balances'] {
  return locations.map((location, index) => ({
    name: AVATAR_LETTERS[index] ?? `P${index + 1}`,
    location,
    minutes: 18 + index * 4,
  }))
}

export async function calculateTravelBalances(
  participants: ParticipantLocation[],
  destinationQuery: string,
  midpoint: Coordinates | null,
): Promise<{ balances: MidpointResult['balances']; usedKakao: boolean }> {
  const apiKey = getKakaoApiKey()
  if (!apiKey) {
    return {
      balances: buildFallbackBalances(
        participants.map((participant) => participant.location),
      ),
      usedKakao: false,
    }
  }

  try {
    let destination =
      (await resolveDestinationCoordinates(destinationQuery)) ?? midpoint

    if (!destination) {
      return {
        balances: buildFallbackBalances(
          participants.map((participant) => participant.location),
        ),
        usedKakao: false,
      }
    }

    const balances = participants.map((participant, index) => {
      if (!participant.coords) {
        return {
          name: AVATAR_LETTERS[index] ?? `P${index + 1}`,
          location: participant.location,
          minutes: 25 + index * 3,
        }
      }

      const distanceKm = haversineDistanceKm(participant.coords, destination!)
      const minutes = estimateTransitMinutes(distanceKm)

      return {
        name: AVATAR_LETTERS[index] ?? `P${index + 1}`,
        location: participant.location,
        minutes,
      }
    })

    return { balances, usedKakao: true }
  } catch {
    return {
      balances: buildFallbackBalances(
        participants.map((participant) => participant.location),
      ),
      usedKakao: false,
    }
  }
}
