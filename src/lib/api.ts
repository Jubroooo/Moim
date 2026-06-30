import { nanoid } from 'nanoid'

import {
  analyzeParticipantLocations,
  buildEstimatedBalances,
  type LocationAnalysis,
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
  '서울 맛집 정보를 검색하고 있어요',
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
  naverSearchQuery?: string
}

interface ParsedRegion {
  rank: number
  name: string
  reasons: string[]
  matchScore?: number
  restaurants: ParsedRestaurant[]
  activities: { label: string; text: string; color: string }[]
}

interface ParsedAIResponse {
  regions: ParsedRegion[]
  summary: string
  matchScore?: number
}

function formatLocationWeights(analysis: LocationAnalysis): string {
  if (analysis.locationWeights.length === 0) {
    return '정보 없음'
  }

  return analysis.locationWeights
    .map(({ location, count }) => `${location} ${count}명`)
    .join(', ')
}

function buildPrompt(
  inputs: AIRecommendationInputs,
  locationAnalysis: LocationAnalysis,
): string {
  const locations = inputs.locations.join(', ')
  const preferFoods =
    inputs.preferFoods.length > 0 ? inputs.preferFoods.join(', ') : '없음'
  const excludeFoods =
    inputs.excludeFoods.length > 0 ? inputs.excludeFoods.join(', ') : '없음'
  const participantDistribution = formatLocationWeights(locationAnalysis)
  const midpointSection = `아래 참여자 분포(${participantDistribution})를 분석해
인원이 많은 출발지 쪽과 지리적 중간을 함께 고려해 추천해줘.
예) 강남 3명 + 수원 1명이면 강남 쪽에 더 가까운 지점을 기준으로 추천`

  return `너는 한국 최고의 모임 장소 큐레이터야.
웹 검색으로 네이버 플레이스, 인스타그램 핫플, 망고플레이트 등
실제로 현재 운영 중이고 요즘 뜨는 장소만 추천해줘.

[참여자 출발 위치]
${locations}

[참여자 인원 분포]
${participantDistribution} (총 ${locationAnalysis.totalPeople}명)

[계산된 중간 지점]
${midpointSection}

[만남 조건]
- 목적: ${inputs.purpose}
- 선호 음식: ${preferFoods}
- 제외 음식: ${excludeFoods}
- 예산: ${inputs.budget || '미정'}
- 분위기: ${inputs.vibe || '미정'}
- 이동 우선순위: ${inputs.movePriority || '미정'}

[추천 철학 — 반드시 따를 것]
이동 거리가 완벽히 공평하지 않아도 괜찮아.
참여자 다수가 가기 편하고, 요즘 핫한 지역을 우선 추천해줘.
단, 소수 인원이 극단적으로 불리하지 않도록 고려해줘.
지리적 중간점보다 접근성 좋은 핫플·인기 상권을 우선해줘.

[중요 규칙]
1. 참여자 출발 위치와 인원 분포를 분석해 추천해줘.
   인원이 많은 출발지에 가깝고, 동시에 다수가 모이기 좋은 핫한 지역을 우선해줘.
   서울로 한정하지 말고 수원, 분당, 판교, 광교, 용인, 인천 등
   실제로 접근성이 좋은 지역도 적극 추천해줘.

2. 식당은 반드시 웹 검색으로 확인한 실제 운영 중인 곳만 선정해줘:
   - 네이버 플레이스 평점 4.0 이상
   - 최근 6개월 내 SNS에서 언급된 핫플
   - 웨이팅이 있을 정도로 인기 있는 곳 우선
   - 각 지역당 반드시 정확히 3개 추천

3. 액티비티는 만남 목적(${inputs.purpose})에 맞게 웹 검색으로
   현재 실제 운영 중인 장소만 추천해줘.
   아래 예시 템플릿·가상 장소명은 절대 사용하지 마.
   반드시 웹 검색으로 확인한 실제 장소만 추천해.

   각 액티비티 text에는 아래 정보를 모두 포함해:
   - 실제 장소명
   - 주소 또는 위치 (예: 성수동 OO로)
   - 가격 (예: 1인 25,000원)
   - 운영시간
   - 특징 한 줄 (예: 인스타 핫플, 웨이팅 있음)
   - 예약 필요 여부

   목적별 추가 요구사항:
   - 방탈출: 테마명까지 구체적으로
   - 팝업/전시: 현재 진행 중인 팝업명 + 기간
   - 카페: 대표 메뉴 + 분위기 키워드
   - 볼링·노래방·다트·보드게임 등: 실제 상호명 + 이용 요금

4. 액티비티 출력 형식:
   뭉뚱그려 "감성 카페 방문", "노래방 방문"처럼 쓰지 말고
   위 필드를 한 문단에 담아 구체적으로 작성해.
   형식 예시 (장소명은 반드시 웹 검색으로 확인한 실제 이름 사용):
   "[장소명] - [주소/위치] · [가격] · [운영시간] · [특징] · [예약 여부]"

5. regions 배열은 rank 1, rank 2 두 지역을 포함해야 해.
   각 region의 matchScore는 0~100 정수로 계산해줘.
   계산 기준: 목적·분위기 일치도(40) + 예산 적합도(30) + 지역 접근성·핫플 점수(30)

반드시 아래 JSON 형식으로만 응답해. 다른 텍스트 없이:
{
  "regions": [
    {
      "rank": 1,
      "name": "지역명",
      "reasons": ["이유1", "이유2", "이유3"],
      "matchScore": 85,
      "restaurants": [
        {
          "id": "r1",
          "name": "실제 식당명",
          "emoji": "🍽️",
          "tags": ["#태그1", "#태그2", "#태그3"],
          "priceRange": "1인 20,000~35,000원",
          "description": "네이버 평점 4.3 · 웨이팅 맛집 · 추천 이유",
          "naverSearchQuery": "식당명 지역명"
        },
        {
          "id": "r2",
          "name": "실제 식당명2",
          "emoji": "🍜",
          "tags": ["#태그1", "#태그2", "#태그3"],
          "priceRange": "1인 15,000~25,000원",
          "description": "네이버 평점 4.5 · 핫플 · 추천 이유",
          "naverSearchQuery": "식당명2 지역명"
        },
        {
          "id": "r3",
          "name": "실제 식당명3",
          "emoji": "🥘",
          "tags": ["#태그1", "#태그2", "#태그3"],
          "priceRange": "1인 25,000~40,000원",
          "description": "네이버 평점 4.2 · 웨이팅 맛집 · 추천 이유",
          "naverSearchQuery": "식당명3 지역명"
        }
      ],
      "activities": [
        {
          "label": "1차",
          "text": "식당 후보 중 선택",
          "color": "indigo"
        },
        {
          "label": "2차",
          "text": "[실제 장소명] - [주소] · [가격] · [운영시간] · [특징] · [예약 여부]",
          "color": "green"
        },
        {
          "label": "3차",
          "text": "[실제 장소명] - [주소] · [가격] · [운영시간] · [특징] · [예약 여부]",
          "color": "amber"
        }
      ]
    },
    {
      "rank": 2,
      "name": "지역명",
      "reasons": ["이유1", "이유2", "이유3"],
      "matchScore": 80,
      "restaurants": [
        { "id": "r4", "name": "...", "emoji": "🍽️", "tags": ["#태그"], "priceRange": "...", "description": "...", "naverSearchQuery": "..." },
        { "id": "r5", "name": "...", "emoji": "🍜", "tags": ["#태그"], "priceRange": "...", "description": "...", "naverSearchQuery": "..." },
        { "id": "r6", "name": "...", "emoji": "🥘", "tags": ["#태그"], "priceRange": "...", "description": "...", "naverSearchQuery": "..." }
      ],
      "activities": [
        { "label": "1차", "text": "...", "color": "indigo" },
        { "label": "2차", "text": "[실제 장소명] - [주소] · [가격] · [운영시간] · [특징] · [예약 여부]", "color": "green" },
        { "label": "3차", "text": "[실제 장소명] - [주소] · [가격] · [운영시간] · [특징] · [예약 여부]", "color": "amber" }
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
        naverSearchQuery: restaurant.naverSearchQuery,
      })),
    activities: region.activities ?? [],
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
    throw new Error('matchScore가 없습니다')
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
  const locationAnalysis = analyzeParticipantLocations(inputs.locations)

  const prompt = buildPrompt(inputs, locationAnalysis)
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      options?.onStatus?.('AI 추천 생성 중...')
      const textContent = await callOpenAIAPI(prompt, apiKey)
      const parsed = extractJson(textContent)
      validateRestaurantCounts(parsed.regions)
      const regions = normalizeRegions(parsed.regions)

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
