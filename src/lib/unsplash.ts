const TAG_KEYWORD_MAP: Record<string, string> = {
  브런치: 'brunch',
  고기: 'korean-bbq',
  이자카야: 'japanese-food',
  한식: 'korean-food',
  양식: 'western-food',
  일식: 'japanese-food',
  중식: 'chinese-food',
  카페: 'cafe',
  술집: 'bar',
  디저트: 'dessert',
  비건: 'vegan-food',
  해산물: 'seafood',
  파스타: 'pasta',
  스시: 'sushi',
  라멘: 'ramen',
  피자: 'pizza',
  스테이크: 'steak',
  치킨: 'fried-chicken',
  떡볶이: 'korean-street-food',
  분식: 'korean-snack',
  샐러드: 'salad',
  베이커리: 'bakery',
  와인: 'wine-bar',
  칵테일: 'cocktail-bar',
  맥주: 'beer',
  루프탑: 'rooftop-restaurant',
  감성: 'aesthetic-cafe',
  데이트: 'date-restaurant',
  회식: 'group-dining',
  가성비: 'affordable-food',
  프렌치: 'french-food',
  태국: 'thai-food',
  멕시칸: 'mexican-food',
  인도: 'indian-food',
  베트남: 'vietnamese-food',
  햄버거: 'burger',
  샤브샤브: 'hot-pot',
  곱창: 'korean-grill',
  삼겹살: 'korean-bbq',
  국밥: 'korean-soup',
  noodles: 'noodles',
  food: 'restaurant-food',
}

const DEFAULT_KEYWORD = 'restaurant-food'

function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, '').trim()
}

export function getUnsplashKeyword(tags: string[]): string {
  const firstTag = tags[0] ? normalizeTag(tags[0]) : ''

  if (!firstTag) return DEFAULT_KEYWORD

  const mapped = TAG_KEYWORD_MAP[firstTag]
  if (mapped) return mapped

  if (/^[a-zA-Z0-9-]+$/.test(firstTag)) {
    return firstTag.toLowerCase()
  }

  return DEFAULT_KEYWORD
}

export function getUnsplashImageUrl(keyword: string): string {
  return `https://source.unsplash.com/featured/400x200?${encodeURIComponent(keyword)}`
}

export function getRestaurantImageUrl(tags: string[]): string {
  return getUnsplashImageUrl(getUnsplashKeyword(tags))
}
