export interface Person {
  id: string
  location: string
}

export interface Restaurant {
  id: string
  name: string
  emoji: string
  tags: string[]
  priceRange: string
  description: string
  region: string
  naverSearchQuery?: string
}

export interface RegionRecommendation {
  rank: 1 | 2
  name: string
  reasons: string[]
  restaurants: Restaurant[]
  activities: { label: string; text: string; color: string }[]
}

export interface MidpointResult {
  purpose: string
  budget: string
  vibe: string
  peopleCount: number
  regions: RegionRecommendation[]
  fairnessScore: number
  matchScore: number
  balances: { name: string; location: string; minutes: number }[]
  summary: string
  /** Share ID generated with nanoid */
  shareId: string
  /** restaurantId → voter names */
  votes: Record<string, string[]>
}
