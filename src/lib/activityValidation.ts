export interface ActivityItem {
  label: string
  text: string
  type?: string
  color?: string
}

const RESTAURANT_KEYWORDS = /식당|맛집|음식점/

export const FIRST_COURSE_TEXT = '위의 식당 후보 중 선택'

export function isSecondOrThirdRound(label: string): boolean {
  return label === '2차' || label === '3차'
}

export function shouldShowActivityRestaurantWarning(
  activity: ActivityItem,
): boolean {
  if (!isSecondOrThirdRound(activity.label)) return false
  if (activity.type === 'restaurant') return true
  return RESTAURANT_KEYWORDS.test(activity.text)
}

export function warnIfActivityLooksLikeRestaurant(
  activity: ActivityItem,
  regionName: string,
): void {
  if (!shouldShowActivityRestaurantWarning(activity)) return

  console.warn(
    `[Moim] ${regionName} ${activity.label} 액티비티가 식당으로 보입니다 (type=${activity.type ?? '없음'}):`,
    activity.text,
  )
}

export function normalizeParsedActivity(activity: ActivityItem): ActivityItem {
  if (activity.label === '1차') {
    return {
      ...activity,
      text: FIRST_COURSE_TEXT,
    }
  }

  const type =
    activity.type === 'restaurant' || activity.type === 'activity'
      ? activity.type
      : isSecondOrThirdRound(activity.label)
        ? 'activity'
        : activity.type

  return {
    ...activity,
    type,
  }
}
