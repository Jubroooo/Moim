import { nanoid } from 'nanoid'

import {
  buildEstimatedBalances,
} from './locationAnalysis'
import { calculateFairnessScore, normalizeMatchScore } from './scores'
import type { MidpointResult, RegionRecommendation } from '../types'

export interface AIRecommendationInputs {
  locations: string[]
  purpose: string
  preferFoods: string[]
  excludeFoods: string[]
  budget: string
  vibe: string
  movePriority: string
}

export const LOADING_STEP_MESSAGES = [
  '위치 분석 중...',
  '실제 맛집 정보를 검색하고 있어요',
  '최적의 만남 지점을 찾고 있어요',
  '예산과 분위기에 맞는 곳을 선별하고 있어요',
  'AI 추천 결과를 정리하고 있어요',
] as const

export interface GetAIRecommendationOptions {
  onStatus?: (message: string) => void
}

const MAX_RETRIES = 2
const RESTAURANTS_PER_REGION = 3
const REQUIRED_REGION_COUNT = 2
const API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-search-preview'

const ACTIVITY_COLORS = ['indigo', 'green', 'amber'] as const

const RETRY_SEARCH_HINTS = [
  '',
  `[재시도 지시]
이전 검색에서 식당 수가 부족했거나 주소가 확인되지 않았습니다.
각 지역별로 아래와 다른 검색어로 반드시 웹 검색을 다시 실행하세요:
- "{지역명} 인기 맛집"
- "{지역명} 웨이팅 맛집"
- "{지역명} 네이버 플레이스 맛집"`,
  `[재시도 지시]
여전히 식당이 부족합니다. 이번에는 아래 키워드로 각 지역을 다시 검색하세요:
- "{지역명} 망고플레이트"
- "{지역명} 핫플 레스토랑"
- "{지역명} {음식종류} 추천"`,
]

interface OpenAIMessage {
  role: string
  content: string
}

interface OpenAIChoice {
  message: OpenAIMessage
}

interface OpenAIAPIResponse {
  choices: OpenAIChoice[]
}

interface ParsedRestaurant {
  id: string
  name: string
  address?: string
  emoji: string
  tags: string[]
  priceRange: string
  description: string
  naverSearchQuery?: string
}

interface ParsedRegion {
  rank: number
  name: string
  reasons: string[]
  matchScore?: number
  restaurants: ParsedRestaurant[]
  activities: { label: string; text: string; color?: string }[]
}

interface ParsedAIResponse {
  regions: ParsedRegion[]
  summary: string
  matchScore?: number
}

export function buildNaverSearchQuery(name: string, address: string): string {
  const trimmedAddress = address.trim()
  if (!trimmedAddress) return name.trim()

  const cityDistrictMatch = trimmedAddress.match(
    /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s+(\S+?(?:구|군|시))/,
  )

  if (cityDistrictMatch) {
    return `${name.trim()} ${cityDistrictMatch[1]} ${cityDistrictMatch[2]}`
  }

  const districtMatch = trimmedAddress.match(/(\S+?(?:구|군|시))/)
  if (districtMatch) {
    return `${name.trim()} ${districtMatch[1]}`
  }

  const parts = trimmedAddress.split(/\s+/).filter(Boolean)
  return `${name.trim()} ${parts.slice(0, 2).join(' ')}`.trim()
}

export function cleanDescription(text: string): string {
  // 마크다운 링크 제거: [텍스트](URL) → 텍스트만 남김
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 단독 URL 제거: http:// 또는 https://로 시작하는 URL
  text = text.replace(/https?:\/\/[^\s)]+/g, '')

  // URL 인코딩된 문자열 제거 (%EA%B0 등)
  text = text.replace(/%[0-9A-Fa-f]{2}/g, '')

  // 빈 괄호 제거: () 또는 []
  text = text.replace(/\(\s*\)/g, '')
  text = text.replace(/\[\s*\]/g, '')

  // 연속 공백 정리
  text = text.replace(/\s+/g, ' ').trim()

  return text
}

function buildPrompt(
  inputs: AIRecommendationInputs,
  attempt = 0,
): string {
  const locations = inputs.locations.join(', ')
  const preferFoods =
    inputs.preferFoods.length > 0 ? inputs.preferFoods.join(', ') : '없음'
  const excludeFoods =
    inputs.excludeFoods.length > 0 ? inputs.excludeFoods.join(', ') : '없음'
  const budget = inputs.budget || '미정'
  const vibe = inputs.vibe || '미정'
  const retryHint = RETRY_SEARCH_HINTS[attempt] ?? RETRY_SEARCH_HINTS.at(-1) ?? ''

  return `너는 실제 검색 결과만을 기반으로 답변하는 식당 추천 AI야.
절대 식당 이름을 지어내거나 추측하지 마.

[필수 규칙]
1. 반드시 웹 검색을 통해 실제로 존재하는 식당만 추천해.
2. 검색 결과에서 찾지 못한 식당은 절대 포함하지 마.
3. 식당 이름은 네이버 플레이스, 카카오맵, 망고플레이트에서
   실제로 검색되는 정확한 상호명을 사용해.
4. 확실하지 않으면 차라리 후보 수를 줄여서라도
   실제 존재하는 곳만 답해.
5. 각 식당마다 실제 주소(도로명 또는 동 단위)를 함께 제공해.
6. description과 activities의 text 필드에는 URL, 마크다운 링크,
   인코딩된 문자열을 절대 포함하지 마.
   순수한 한국어 설명 텍스트만 작성해.

[검색 조건]
참여자 출발 위치: ${locations}
만남 목적: ${inputs.purpose}
선호 음식: ${preferFoods}
제외 음식: ${excludeFoods}
예산: ${budget}
분위기: ${vibe}

[작업 순서]
1. 먼저 참여자 위치 기반으로 적절한 만남 지역 2곳을 선정해.
2. 각 지역에 대해 반드시 웹 검색을 실행해서
   "{지역명} {음식종류} 맛집" 또는 "{지역명} 핫플 레스토랑"
   형태로 검색해.
3. 검색 결과에서 실제로 존재하고, 최근 운영 중인 것으로
   확인되는 식당만 선택해.
4. 각 지역당 정확히 3개씩, 총 6개 식당을 선정해.
5. 액티비티(2차, 3차)도 동일하게 실제 검색 기반으로
   찾아서 추천해.

${retryHint}

JSON으로만 응답:
{
  "regions": [
    {
      "rank": 1,
      "name": "지역명",
      "reasons": ["이유1", "이유2", "이유3"],
      "restaurants": [
        {
          "id": "r1",
          "name": "실제 정확한 상호명",
          "address": "실제 주소 (예: 서울 강남구 OO로 123)",
          "emoji": "🍽️",
          "tags": ["#태그1", "#태그2"],
          "priceRange": "1인 가격대",
          "description": "검색에서 확인된 특징 설명"
        }
      ],
      "activities": [
        {
          "label": "1차",
          "text": "식당 후보 중 선택"
        },
        {
          "label": "2차",
          "text": "실제 장소명 + 주소 + 특징 (검색 기반)"
        },
        {
          "label": "3차",
          "text": "실제 장소명 + 주소 + 특징 (검색 기반)"
        }
      ]
    },
    {
      "rank": 2,
      "name": "지역명",
      "reasons": ["이유1", "이유2", "이유3"],
      "restaurants": [
        { "id": "r4", "name": "...", "address": "...", "emoji": "🍽️", "tags": ["#태그"], "priceRange": "...", "description": "..." },
        { "id": "r5", "name": "...", "address": "...", "emoji": "🍜", "tags": ["#태그"], "priceRange": "...", "description": "..." },
        { "id": "r6", "name": "...", "address": "...", "emoji": "🥘", "tags": ["#태그"], "priceRange": "...", "description": "..." }
      ],
      "activities": [
        { "label": "1차", "text": "식당 후보 중 선택" },
        { "label": "2차", "text": "실제 장소명 + 주소 + 특징 (검색 기반)" },
        { "label": "3차", "text": "실제 장소명 + 주소 + 특징 (검색 기반)" }
      ]
    }
  ],
  "summary": "총평"
}`
}

function extractJson(text: string): ParsedAIResponse {
  const trimmed = text.trim()

  const tryParse = (value: string): ParsedAIResponse => {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('regions' in parsed) ||
      !('summary' in parsed)
    ) {
      throw new Error('Invalid AI response shape')
    }
    return parsed as ParsedAIResponse
  }

  try {
    return tryParse(trimmed)
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenced) return tryParse(fenced[1].trim())

    const objectMatch = trimmed.match(/\{[\s\S]*\}/)
    if (objectMatch) return tryParse(objectMatch[0])

    throw new Error('AI 응답에서 JSON을 찾을 수 없습니다')
  }
}

function hasValidAddress(address: unknown): address is string {
  return typeof address === 'string' && address.trim().length >= 4
}

function sanitizeParsedRegions(regions: ParsedRegion[]): ParsedRegion[] {
  return regions.slice(0, REQUIRED_REGION_COUNT).map((region) => {
    const validRestaurants: ParsedRestaurant[] = []

    for (const restaurant of region.restaurants ?? []) {
      if (!hasValidAddress(restaurant.address)) {
        console.warn(
          `[Moim] address 없음 — 식당 제외: "${restaurant.name ?? '이름 없음'}" (${region.name})`,
        )
        continue
      }
      validRestaurants.push({
        ...restaurant,
        description: cleanDescription(restaurant.description ?? ''),
      })
    }

    return {
      ...region,
      restaurants: validRestaurants,
      activities: (region.activities ?? []).map((activity) => ({
        ...activity,
        text: cleanDescription(activity.text ?? ''),
      })),
    }
  })
}

function validateRestaurantCounts(regions: ParsedRegion[]): void {
  if (regions.length < REQUIRED_REGION_COUNT) {
    throw new Error(
      `추천 지역이 ${REQUIRED_REGION_COUNT}개 미만입니다 (${regions.length}개)`,
    )
  }

  for (const region of regions.slice(0, REQUIRED_REGION_COUNT)) {
    const count = region.restaurants?.length ?? 0

    if (count < RESTAURANTS_PER_REGION) {
      throw new Error(
        `"${region.name}" 지역의 유효 식당(address 포함)이 ${RESTAURANTS_PER_REGION}개 미만입니다 (${count}개)`,
      )
    }
  }
}

function normalizeRegions(regions: ParsedRegion[]): RegionRecommendation[] {
  return regions.slice(0, REQUIRED_REGION_COUNT).map((region) => ({
    rank: (region.rank === 2 ? 2 : 1) as 1 | 2,
    name: region.name,
    reasons: region.reasons ?? [],
    restaurants: (region.restaurants ?? [])
      .slice(0, RESTAURANTS_PER_REGION)
      .map((restaurant, index) => {
        const address = restaurant.address!.trim()
        const naverSearchQuery = buildNaverSearchQuery(restaurant.name, address)

        return {
          id: restaurant.id || `${region.rank}-r${index + 1}-${nanoid(6)}`,
          name: restaurant.name,
          emoji: restaurant.emoji || '🍽️',
          tags: restaurant.tags ?? [],
          priceRange: restaurant.priceRange,
          description: cleanDescription(restaurant.description ?? ''),
          region: region.name,
          address,
          naverSearchQuery,
        }
      }),
    activities: (region.activities ?? []).map((activity, index) => ({
      label: activity.label,
      text: cleanDescription(activity.text ?? ''),
      color: activity.color ?? ACTIVITY_COLORS[index] ?? 'indigo',
    })),
  }))
}

function resolveMatchScore(parsed: ParsedAIResponse): number {
  if (typeof parsed.matchScore === 'number') {
    return normalizeMatchScore(parsed.matchScore)
  }

  const regionScores = parsed.regions
    .slice(0, REQUIRED_REGION_COUNT)
    .map((region) => region.matchScore)
    .filter((score): score is number => typeof score === 'number')

  if (regionScores.length === 0) {
    return 80
  }

  const average = Math.round(
    regionScores.reduce((sum, score) => sum + score, 0) / regionScores.length,
  )

  return normalizeMatchScore(average)
}

function extractTextContent(data: OpenAIAPIResponse): string {
  return data.choices[0]?.message?.content?.trim() ?? ''
}

async function callOpenAIAPI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      web_search_options: {
        search_context_size: 'high',
      },
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI API 오류 (${response.status}): ${errorBody}`)
  }

  const data: OpenAIAPIResponse = await response.json()
  const textContent = extractTextContent(data)

  if (!textContent) {
    throw new Error('AI 응답이 비어 있습니다')
  }

  return textContent
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getAIRecommendation(
  inputs: AIRecommendationInputs,
  options?: GetAIRecommendationOptions,
): Promise<MidpointResult> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('VITE_OPENAI_API_KEY를 .env 파일에 설정해 주세요')
  }

  options?.onStatus?.('위치 분석 중...')

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        options?.onStatus?.(`맛집 재검색 중... (${attempt}/${MAX_RETRIES})`)
      } else {
        options?.onStatus?.('실제 맛집 검색 중...')
      }

      const prompt = buildPrompt(inputs, attempt)
      const textContent = await callOpenAIAPI(prompt, apiKey)
      const parsed = extractJson(textContent)
      const sanitized = sanitizeParsedRegions(parsed.regions)
      validateRestaurantCounts(sanitized)
      const regions = normalizeRegions(sanitized)

      if (regions.length === 0) {
        throw new Error('추천 지역 데이터가 없습니다')
      }

      const balances = buildEstimatedBalances(inputs.locations)

      const fairnessScore = calculateFairnessScore(
        balances.map((balance) => balance.minutes),
      )
      const matchScore = resolveMatchScore(parsed)

      return {
        purpose: inputs.purpose,
        budget: inputs.budget,
        vibe: inputs.vibe,
        peopleCount: inputs.locations.length,
        regions,
        fairnessScore,
        matchScore,
        balances,
        summary: parsed.summary,
        shareId: nanoid(10),
        votes: {},
      }
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다')

      if (attempt < MAX_RETRIES) {
        await delay(1000 * (attempt + 1))
      }
    }
  }

  throw lastError ?? new Error('AI 추천을 가져오지 못했습니다')
}

export { REQUIRED_REGION_COUNT, RESTAURANTS_PER_REGION }
