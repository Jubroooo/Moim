const AVATAR_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export interface LocationWeight {
  location: string
  count: number
}

export interface LocationAnalysis {
  locationWeights: LocationWeight[]
  totalPeople: number
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

export function analyzeParticipantLocations(
  locations: string[],
): LocationAnalysis {
  return {
    locationWeights: groupLocationsByHeadcount(locations),
    totalPeople: locations.filter((location) => location.trim()).length,
  }
}

/** 참여자 수에 비례한 추정 이동 시간 (18분 + index × 4분) */
export function buildEstimatedBalances(
  locations: string[],
): { name: string; location: string; minutes: number }[] {
  return locations.map((location, index) => ({
    name: AVATAR_LETTERS[index] ?? `P${index + 1}`,
    location,
    minutes: 18 + index * 4,
  }))
}
