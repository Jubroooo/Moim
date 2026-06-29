const TAG_KEYWORD_MAP: Record<string, string> = {
  한식: 'korean food',
  고기: 'korean bbq',
  브런치: 'brunch cafe',
  이자카야: 'izakaya',
  중식: 'chinese restaurant',
  일식: 'japanese food',
  와인: 'wine bar',
  카페: 'cozy cafe',
  스테이크: 'steak restaurant',
  태국음식: 'thai food',
  태국: 'thai food',
  양식: 'western restaurant',
  술집: 'bar',
  디저트: 'dessert',
  해산물: 'seafood',
  파스타: 'pasta',
  스시: 'sushi',
  라멘: 'ramen',
  피자: 'pizza',
  치킨: 'fried chicken',
  베이커리: 'bakery',
}

const DEFAULT_KEYWORD = 'restaurant food'

interface PexelsPhoto {
  src?: {
    medium?: string
  }
}

interface PexelsSearchResponse {
  photos?: PexelsPhoto[]
}

function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, '').trim()
}

export function getPexelsKeyword(tags: string[]): string {
  const firstTag = tags[0] ? normalizeTag(tags[0]) : ''

  if (!firstTag) return DEFAULT_KEYWORD

  const mapped = TAG_KEYWORD_MAP[firstTag]
  if (mapped) return mapped

  if (/^[a-zA-Z0-9\s-]+$/.test(firstTag)) {
    return firstTag.toLowerCase()
  }

  return DEFAULT_KEYWORD
}

export async function fetchPexelsImageUrl(tags: string[]): Promise<string | null> {
  const apiKey = import.meta.env.VITE_PEXELS_API_KEY

  if (!apiKey || apiKey === 'your_key_here') {
    return null
  }

  const keyword = getPexelsKeyword(tags)
  const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1`

  const response = await fetch(searchUrl, {
    headers: {
      Authorization: apiKey,
    },
  })

  if (!response.ok) {
    return null
  }

  const data: PexelsSearchResponse = await response.json()
  return data.photos?.[0]?.src?.medium ?? null
}
