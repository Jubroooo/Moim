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

export interface MidpointAnalysis {
  midpoint: Coordinates | null
  midpointRegionName: string | null
  participants: ParticipantLocation[]
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

export function computeMidpoint(
  coordinates: Coordinates[],
): Coordinates | null {
  if (coordinates.length === 0) return null

  const totals = coordinates.reduce(
    (acc, coord) => ({
      longitude: acc.longitude + coord.longitude,
      latitude: acc.latitude + coord.latitude,
    }),
    { longitude: 0, latitude: 0 },
  )

  return {
    longitude: totals.longitude / coordinates.length,
    latitude: totals.latitude / coordinates.length,
  }
}

export async function analyzeParticipantLocations(
  locations: string[],
): Promise<MidpointAnalysis> {
  const apiKey = getKakaoApiKey()

  if (!apiKey) {
    return {
      midpoint: null,
      midpointRegionName: null,
      participants: locations.map((location) => ({ location, coords: null })),
      usedKakao: false,
    }
  }

  try {
    const participants = await Promise.all(
      locations.map(async (location) => ({
        location,
        coords: await searchAddressCoordinates(location),
      })),
    )

    const validCoords = participants
      .map((participant) => participant.coords)
      .filter((coords): coords is Coordinates => coords !== null)

    if (validCoords.length === 0) {
      return {
        midpoint: null,
        midpointRegionName: null,
        participants,
        usedKakao: false,
      }
    }

    const midpoint = computeMidpoint(validCoords)
    const midpointRegionName = midpoint
      ? await reverseGeocodeRegionName(midpoint)
      : null

    return {
      midpoint,
      midpointRegionName,
      participants,
      usedKakao: true,
    }
  } catch {
    return {
      midpoint: null,
      midpointRegionName: null,
      participants: locations.map((location) => ({ location, coords: null })),
      usedKakao: false,
    }
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
