import { useEffect, useState } from 'react'

import { fetchPexelsImageUrl } from '../lib/pexels'

const IMAGE_HEIGHT = 120

interface RestaurantCardImageProps {
  emoji: string
  tags: string[]
}

function EmojiFallback({ emoji }: { emoji: string }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-t-xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950"
      style={{ height: IMAGE_HEIGHT }}
    >
      <span className="text-5xl" aria-hidden>
        {emoji}
      </span>
    </div>
  )
}

function SkeletonShimmer() {
  return (
    <div
      className="image-skeleton-shimmer absolute inset-0 w-full rounded-t-xl"
      style={{ height: IMAGE_HEIGHT }}
      aria-hidden
    />
  )
}

export default function RestaurantCardImage({
  emoji,
  tags,
}: RestaurantCardImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false

    setStatus('loading')
    setImageUrl(null)

    fetchPexelsImageUrl(tags)
      .then((url) => {
        if (cancelled) return

        if (!url) {
          setStatus('error')
          return
        }

        setImageUrl(url)
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [tags])

  if (status === 'error') {
    return <EmojiFallback emoji={emoji} />
  }

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-t-xl bg-slate-800"
      style={{ height: IMAGE_HEIGHT }}
    >
      {status !== 'loaded' ? <SkeletonShimmer /> : null}

      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className={`w-full rounded-t-xl object-cover transition-opacity duration-300 ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ height: IMAGE_HEIGHT }}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      ) : null}
    </div>
  )
}
