import type { ReactNode } from 'react'

import type { Restaurant } from '../types'

interface RestaurantCardProps {
  restaurant: Restaurant
  selected?: boolean
  selectable?: boolean
  onClick?: () => void
}

export default function RestaurantCard({
  restaurant,
  selected = false,
  selectable = false,
  onClick,
}: RestaurantCardProps) {
  const Wrapper = selectable ? 'button' : 'article'

  return (
    <Wrapper
      type={selectable ? 'button' : undefined}
      onClick={selectable ? onClick : undefined}
      className={`relative w-full overflow-hidden rounded-xl border text-left backdrop-blur-sm transition ${
        selected
          ? 'scale-[1.02] border-indigo-500/70 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/15'
      } ${selectable ? 'cursor-pointer' : ''}`}
    >
      {selected ? (
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

      <div className="flex h-[140px] items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
        <span className="text-5xl" aria-hidden>
          {restaurant.emoji}
        </span>
      </div>

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
      </div>
    </Wrapper>
  )
}

export function RestaurantCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{children}</div>
  )
}
