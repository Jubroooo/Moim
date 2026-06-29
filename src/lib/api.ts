import { nanoid } from 'nanoid'

import {
  analyzeParticipantLocations,
  buildFallbackBalances,
  calculateTravelBalances,
} from './kakaoMap'
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

function buildPrompt(
  inputs: AIRecommendationInputs,
  midpointRegionName: string | null,
): string {
  const locations = inputs.locations.join(', ')
  const preferFoods =
    inputs.preferFoods.length > 0 ? inputs.preferFoods.join(', ') : '없음'
  const excludeFoods =
    inputs.excludeFoods.length > 0 ? inputs.excludeFoods.join(', ') : '없음'
  const midpointSection = midpointRegionName
    ? `카카오 지도 API로 계산한 지리적 중간 지점 근처 지역: ${midpointRegionName}
1순위 추천 지역은 이 중간 지점을 중심으로 추천해줘.`
    : `중간 지점 좌표 정보 없음 — 참여자 출발 위치 텍스트를 분석해 지리적 중간 지점 근처를 추천해줘.`

  return `너는 한국 최고의 모임 장소 큐레이터야.
네이버 플레이스 리뷰, 인스타그램 핫플, 망고플레이트 인기 맛집 데이터를 
기반으로 실제로 요즘 뜨는 장소를 추천해줘.

[참여자 출발 위치]
${locations}

[계산된 중간 지점]
${midpointSection}

[만남 조건]
- 목적: ${inputs.purpose}
- 선호 음식: ${preferFoods}
- 제외 음식: ${excludeFoods}
- 예산: ${inputs.budget || '미정'}
- 분위기: ${inputs.vibe || '미정'}
- 이동 우선순위: ${inputs.movePriority || '미정'}

[중요 규칙]
1. 참여자들의 실제 출발 위치를 분석해서 지리적 중간 지점 혹은 인기있는 지역을 추천해줘.
   서울로 한정하지 말고 수원, 분당, 판교, 광교, 용인, 인천 등
   실제 중간에 해당하는 지역도 적극 추천해줘.
   예) 수원역 + 병점역 → 수원 행궁동, 광교, 영통 추천

2. 식당은 반드시 다음 기준으로 선정해줘:
   - 네이버 플레이스 평점 4.0 이상
   - 최근 6개월 내 인스타그램/SNS에서 언급된 핫플
   - 웨이팅이 있을 정도로 인기 있는 곳 우선
   - 각 지역당 반드시 정확히 3개 추천

3. 액티비티는 만남 목적에 따라 아래 기준으로 구체적으로 추천해줘:

   [친목/동기모임/회식]
   - 볼링장: 구체적인 장소명 (예: 강남 볼링클럽)
   - 방탈출: 구체적인 테마명 (예: 홍대 넥스트에디션 '저택의 비밀')
   - 노래방: 구체적인 장소명 (예: 코인노래방 싱싱)
   - 다트바: 구체적인 장소명
   - 보드게임카페: 구체적인 장소명

   [소개팅/데이트]
   - 감성 카페: 구체적인 카페명 + 대표 메뉴
     (예: 성수 어니언 - 앤틱한 인테리어, 소금빵 유명)
   - 전시/팝업: 현재 진행 중인 전시명
     (예: 성수 무신사 팝업 '아디다스 오리지널스')
   - 서점: 구체적인 서점명
     (예: 을지로 최인아책방 - 독립서점, 분위기 좋음)
   - 만화카페: 구체적인 장소명
   - 루프탑 바: 구체적인 장소명 + 시그니처 칵테일

   [스터디]
   - 스터디카페: 구체적인 장소명 + 1인 가격
   - 북카페: 구체적인 장소명
   - 조용한 카페: 콘센트/와이파이 여부 포함

   [비즈니스/선후배]
   - 호텔 라운지: 구체적인 장소명
   - 프라이빗 룸: 구체적인 식당명
   - 조용한 카페: 구체적인 장소명

   [청첩장모임]
   - 프라이빗 카페: 구체적인 장소명
   - 갤러리 카페: 구체적인 장소명
   - 한옥 카페: 구체적인 장소명

4. 액티비티 출력 형식은 반드시 이렇게 해줘:
   뭉뚱그려서 "감성 카페 방문" 이렇게 쓰지 말고
   반드시 아래처럼 구체적으로:
   
   ✅ 좋은 예시:
   "성수 어니언 카페 - 앤틱한 공간, 소금빵·크루아상 유명. 
    웨이팅 있으니 도착 전 웨이팅 앱 등록 추천"
   
   "홍대 넥스트에디션 방탈출 '저택의 비밀' - 
    난이도 중상, 4인 기준 인당 25,000원, 예약 필수"
   
   ❌ 나쁜 예시:
   "인근 카페에서 커피"
   "노래방 방문"

5. regions 배열은 rank 1, rank 2 두 지역을 포함해야 해.
   각 region의 matchScore는 0~100 정수로 계산해줘.
   계산 기준: 목적·분위기 일치도(40) + 예산 적합도(30) + 지역 특성(30)

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
          "text": "구체적인 장소명 - 상세 설명 (가격, 특징, 팁)",
          "color": "green"
        },
        {
          "label": "3차",
          "text": "구체적인 장소명 - 상세 설명",
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
        { "label": "2차", "text": "...", "color": "green" },
        { "label": "3차", "text": "...", "color": "amber" }
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
  const locationAnalysis = await analyzeParticipantLocations(inputs.locations)

  const prompt = buildPrompt(inputs, locationAnalysis.midpointRegionName)
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

      const destinationQuery =
        regions[0]?.name ?? locationAnalysis.midpointRegionName ?? inputs.locations[0]

      const travelResult = await calculateTravelBalances(
        locationAnalysis.participants,
        destinationQuery,
        locationAnalysis.midpoint,
      )

      const balances = travelResult.usedKakao
        ? travelResult.balances
        : buildFallbackBalances(inputs.locations)

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
        midpointRegionName: locationAnalysis.midpointRegionName ?? undefined,
        balancesFromKakao: travelResult.usedKakao,
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
