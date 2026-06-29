import { nanoid } from 'nanoid'

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
  '참여자 위치를 분석하고 있어요',
  '서울 맛집 정보를 검색하고 있어요',
  '최적의 만남 지점을 찾고 있어요',
  '예산과 분위기에 맞는 곳을 선별하고 있어요',
  'AI 추천 결과를 정리하고 있어요',
] as const

const MAX_RETRIES = 2
const RESTAURANTS_PER_REGION = 3
const REQUIRED_REGION_COUNT = 2
const API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-search-preview'

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
  emoji: string
  tags: string[]
  priceRange: string
  description: string
}

interface ParsedRegion {
  rank: number
  name: string
  reasons: string[]
  restaurants: ParsedRestaurant[]
  activities: { label: string; text: string; color: string }[]
}

interface ParsedBalance {
  name: string
  location: string
  minutes: number
}

interface ParsedAIResponse {
  regions: ParsedRegion[]
  summary: string
  matchScore: number
  balances: ParsedBalance[]
}

function buildPrompt(inputs: AIRecommendationInputs): string {
  const locations = inputs.locations.join(', ')
  const preferFoods =
    inputs.preferFoods.length > 0 ? inputs.preferFoods.join(', ') : '없음'
  const excludeFoods =
    inputs.excludeFoods.length > 0 ? inputs.excludeFoods.join(', ') : '없음'

  return `너는 서울 맛집과 모임 장소 전문가야.
다음 조건으로 최적의 만남 장소를 추천해줘.

참여자 출발 위치: ${locations}
만남 목적: ${inputs.purpose}
선호 음식: ${preferFoods}
제외 음식: ${excludeFoods}
예산: ${inputs.budget || '미정'}
원하는 분위기: ${inputs.vibe || '미정'}
이동 우선순위: ${inputs.movePriority || '미정'}

웹서치를 통해 실제 존재하는 서울 식당과 장소를 찾아서 추천해줘.
네이버 지도, 카카오맵 기준으로 실제 평점이 높은 곳 위주로 추천해.

각 지역마다 반드시 식당을 정확히 3개 추천해줘. restaurants 배열은 항상 length가 3이어야 해.
regions 배열은 rank 1, rank 2 두 지역을 포함해야 해.

각 참여자별로 1순위 추천 지역까지의 예상 이동 시간(분)을 balances에 포함해줘.
참여자 이름은 A, B, C, D, E, F 순서로 부여해.

만남 적합도(matchScore)를 0~100 정수로 직접 계산해서 포함해줘.
계산 기준:
- 목적과 분위기 일치도: 40점
- 예산 적합도: 30점
- 지역 특성(교통, 분위기, 식당 밀집도 등): 30점

반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 넣지 마:
{
  "regions": [
    {
      "rank": 1,
      "name": "지역명 (예: 성수 / 서울숲)",
      "reasons": ["이유1", "이유2", "이유3"],
      "restaurants": [
        {
          "id": "r1",
          "name": "실제 식당명1",
          "emoji": "🍽️",
          "tags": ["#태그1", "#태그2"],
          "priceRange": "1인 20,000~35,000원",
          "description": "추천 이유 한 줄"
        },
        {
          "id": "r2",
          "name": "실제 식당명2",
          "emoji": "🍜",
          "tags": ["#태그1", "#태그2"],
          "priceRange": "1인 15,000~25,000원",
          "description": "추천 이유 한 줄"
        },
        {
          "id": "r3",
          "name": "실제 식당명3",
          "emoji": "🥘",
          "tags": ["#태그1", "#태그2"],
          "priceRange": "1인 25,000~40,000원",
          "description": "추천 이유 한 줄"
        }
      ],
      "activities": [
        { "label": "1차", "text": "설명", "color": "indigo" },
        { "label": "2차", "text": "설명", "color": "green" },
        { "label": "3차", "text": "설명", "color": "amber" }
      ]
    },
    { "rank": 2, "name": "...", "reasons": ["..."], "restaurants": [{ "id": "r4", "...": "..." }, { "id": "r5", "...": "..." }, { "id": "r6", "...": "..." }], "activities": [] }
  ],
  "balances": [
    { "name": "A", "location": "출발지1", "minutes": 25 },
    { "name": "B", "location": "출발지2", "minutes": 30 }
  ],
  "matchScore": 85,
  "summary": "총평 한 문단"
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
      !('summary' in parsed) ||
      !('matchScore' in parsed) ||
      !('balances' in parsed)
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
        `"${region.name}" 지역의 식당이 ${RESTAURANTS_PER_REGION}개 미만입니다 (${count}개)`,
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
      .map((restaurant, index) => ({
        id: restaurant.id || `${region.rank}-r${index + 1}-${nanoid(6)}`,
        name: restaurant.name,
        emoji: restaurant.emoji || '🍽️',
        tags: restaurant.tags ?? [],
        priceRange: restaurant.priceRange,
        description: restaurant.description,
        region: region.name,
      })),
    activities: region.activities ?? [],
  }))
}

function normalizeBalances(
  balances: ParsedBalance[],
  locations: string[],
): MidpointResult['balances'] {
  const avatarLetters = ['A', 'B', 'C', 'D', 'E', 'F']

  if (!Array.isArray(balances) || balances.length === 0) {
    throw new Error('이동 시간 데이터가 없습니다')
  }

  return locations.map((location, index) => {
    const expectedName = avatarLetters[index] ?? `P${index + 1}`
    const matched =
      balances.find((balance) => balance.name === expectedName) ??
      balances[index]

    if (!matched || typeof matched.minutes !== 'number') {
      throw new Error('이동 시간 데이터 형식이 올바르지 않습니다')
    }

    return {
      name: expectedName,
      location: matched.location || location,
      minutes: Math.max(0, Math.round(matched.minutes)),
    }
  })
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
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
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
): Promise<MidpointResult> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('VITE_OPENAI_API_KEY를 .env 파일에 설정해 주세요')
  }

  const prompt = buildPrompt(inputs)
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const textContent = await callOpenAIAPI(prompt, apiKey)
      const parsed = extractJson(textContent)
      validateRestaurantCounts(parsed.regions)
      const regions = normalizeRegions(parsed.regions)

      if (regions.length === 0) {
        throw new Error('추천 지역 데이터가 없습니다')
      }

      const balances = normalizeBalances(parsed.balances, inputs.locations)
      const fairnessScore = calculateFairnessScore(
        balances.map((balance) => balance.minutes),
      )
      const matchScore = normalizeMatchScore(parsed.matchScore)

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
