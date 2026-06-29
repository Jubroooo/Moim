import { useEffect, useMemo, useState } from 'react'

import { getRestaurantImageUrl } from '../lib/unsplash'

interface RestaurantCardImageProps {
  emoji: string
  tags: string[]
}

function EmojiFallback({ emoji }: { emoji: string }) {
  return (
    <div className="flex h-[140px] items-center justify-center rounded-t-xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <span className="text-5xl" aria-hidden>
        {emoji}
      </span>
    </div>
  )
}

function SkeletonShimmer() {
  return (
    <div
      className="image-skeleton-shimmer absolute inset-0 h-[140px] w-full rounded-t-xl"
      aria-hidden
    />
  )
}

export default function RestaurantCardImage({
  emoji,
  tags,
}: RestaurantCardImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const imageUrl = useMemo(() => getRestaurantImageUrl(tags), [tags])

  useEffect(() => {
    setStatus('loading')
  }, [imageUrl])

  if (status === 'error') {
    return <EmojiFallback emoji={emoji} />
  }

  return (
    <div className="relative h-[140px] overflow-hidden rounded-t-xl bg-slate-800">
      {status !== 'loaded' ? <SkeletonShimmer /> : null}

      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={`h-[140px] w-full rounded-t-xl object-cover transition-opacity duration-300 ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  )
}
