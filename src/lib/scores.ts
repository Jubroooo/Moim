function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function calculateFairnessScore(minutes: number[]): number {
  if (minutes.length === 0) return 0
  if (minutes.length === 1) return 100

  const mean = minutes.reduce((sum, value) => sum + value, 0) / minutes.length

  if (mean === 0) return 100

  const variance =
    minutes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / minutes.length
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) return 100

  const score = 100 - (stdDev / mean) * 100
  return clamp(Math.round(score), 0, 100)
}

export function normalizeMatchScore(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error('matchScore가 유효하지 않습니다')
  }

  return clamp(Math.round(value), 0, 100)
}
