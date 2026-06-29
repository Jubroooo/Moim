import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

import { getNaverPlaceSearchUrl } from '../lib/naverMap'
import type { Restaurant } from '../types'
import RestaurantCardImage from './RestaurantCardImage'

interface RestaurantCardProps {
  restaurant: Restaurant
  selected?: boolean
  selectable?: boolean
  onSelect?: () => void
}

export default function RestaurantCard({
  restaurant,
  selected = false,
  selectable = false,
  onSelect,
}: RestaurantCardProps) {
  const handleCardClick = () => {
    if (selectable) {
      onSelect?.()
    }
  }

  const handleNaverLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation()
  }

  const Wrapper = selectable ? 'button' : 'article'

  return (
    <Wrapper
      type={selectable ? 'button' : undefined}
      onClick={selectable ? handleCardClick : undefined}
      aria-pressed={selectable ? selected : undefined}
      className={`group relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border text-left backdrop-blur-sm transition ${
        selected
          ? 'scale-[1.02] cursor-pointer border-indigo-500/70 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
          : selectable
            ? 'cursor-pointer border-white/[0.08] bg-white/[0.03] hover:border-indigo-500/50 hover:bg-white/[0.05]'
            : 'border-white/[0.08] bg-white/[0.03]'
      }`}
    >
      {selected && selectable ? (
        <div className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
      ) : null}

      <RestaurantCardImage emoji={restaurant.emoji} tags={restaurant.tags} />

      <div className="space-y-2 p-3.5">
        <h4 className="font-bold text-white">{restaurant.name}</h4>

        {restaurant.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {restaurant.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400"
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        ) : null}

        <p className="text-sm font-medium text-indigo-400">{restaurant.priceRange}</p>
        <p className="text-xs leading-relaxed text-slate-400">{restaurant.description}</p>

        <div className="flex justify-end pt-1">
          <a
            href={getNaverPlaceSearchUrl(restaurant.name)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleNaverLinkClick}
            className="text-[11px] font-medium text-indigo-400 transition hover:text-indigo-300 hover:underline"
          >
            네이버 지도에서 보기 →
          </a>
        </div>
      </div>
    </Wrapper>
  )
}

export function RestaurantCardGrid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const container = scrollRef.current
    if (!container || items.length === 0) return

    const updateActiveIndex = () => {
      const scrollCenter = container.scrollLeft + container.clientWidth / 2
      const slides = Array.from(container.children) as HTMLElement[]

      let closestIndex = 0
      let closestDistance = Number.POSITIVE_INFINITY

      slides.forEach((slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2
        const distance = Math.abs(scrollCenter - slideCenter)

        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      })

      setActiveIndex(closestIndex)
    }

    updateActiveIndex()
    container.addEventListener('scroll', updateActiveIndex, { passive: true })
    window.addEventListener('resize', updateActiveIndex)

    return () => {
      container.removeEventListener('scroll', updateActiveIndex)
      window.removeEventListener('resize', updateActiveIndex)
    }
  }, [items.length])

  return (
    <>
      <div className="restaurant-carousel-outer md:hidden">
        <div ref={scrollRef} className="restaurant-carousel flex gap-3 px-4">
          {Children.map(children, (child, index) => {
            const key = isValidElement(child)
              ? (child as ReactElement).key ?? index
              : index

            return (
              <div
                key={key}
                className={`restaurant-carousel-item min-w-0 max-w-full ${
                  index === activeIndex ? 'opacity-100' : 'opacity-75'
                } transition-opacity duration-300`}
              >
                {child}
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
          {items.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex
                  ? 'w-4 bg-emerald-400'
                  : 'w-1.5 bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="hidden min-w-0 gap-3 md:grid md:grid-cols-3">{children}</div>
    </>
  )
}
