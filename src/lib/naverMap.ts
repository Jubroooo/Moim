export function getNaverPlaceSearchUrl(restaurantName: string): string {
  return `https://map.naver.com/v5/search/${encodeURIComponent(restaurantName)}`
}

export function openNaverPlaceSearch(restaurantName: string): void {
  window.open(getNaverPlaceSearchUrl(restaurantName), '_blank', 'noopener,noreferrer')
}
