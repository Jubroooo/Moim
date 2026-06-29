import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import RestaurantCard, { RestaurantCardGrid } from '../components/RestaurantCard'
import {
  getStorageKey,
  loadSharedResult,
  saveSharedResult,
} from '../lib/share'
import type { MidpointResult, Restaurant } from '../types'

type PagePhase = 'loading' | 'error' | 'name' | 'voting' | 'thanks'

interface RegionGroup {
  label: string
  restaurants: Restaurant[]
}

function getRegionGroups(result: MidpointResult): RegionGroup[] {
  return result.regions.map((region) => ({
    label: `${region.rank === 1 ? '1순위' : '2순위'} · ${region.name}`,
    restaurants: region.restaurants.slice(0, 3),
  }))
}

function getAllRestaurants(result: MidpointResult): Restaurant[] {
  return getRegionGroups(result).flatMap((group) => group.restaurants)
}

function getVoteCount(result: MidpointResult, restaurantId: string): number {
  return result.votes[restaurantId]?.length ?? 0
}

function VoteResultsChart({ result }: { result: MidpointResult }) {
  const restaurants = getAllRestaurants(result)

  const ranked = useMemo(() => {
    return [...restaurants]
      .map((restaurant) => ({
        restaurant,
        count: getVoteCount(result, restaurant.id),
      }))
      .sort((a, b) => b.count - a.count)
  }, [restaurants, result])

  const maxCount = Math.max(...ranked.map((item) => item.count), 1)
  const topCount = ranked[0]?.count ?? 0

  if (restaurants.length === 0) return null

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-md sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">현재까지 투표 결과</h2>

      <div className="space-y-3">
        {ranked.map(({ restaurant, count }, index) => {
          const isWinner = count > 0 && count === topCount
          const widthPercent = (count / maxCount) * 100

          return (
            <div
              key={restaurant.id}
              className={`rounded-xl border p-3 transition ${
                isWinner
                  ? 'border-amber-400/60 bg-amber-500/5 shadow-[0_0_16px_rgba(251,191,36,0.12)]'
                  : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-lg" aria-hidden>
                    {restaurant.emoji}
                  </span>
                  <span className="truncate font-medium text-white">
                    {restaurant.name}
                  </span>
                  {isWinner ? (
                    <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">
                      👑 1위
                    </span>
                  ) : null}
                </div>
                <span className="shrink-0 text-sm font-semibold text-indigo-400">
                  {count}표
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  className={`h-full rounded-full ${
                    isWinner
                      ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                      : 'bg-gradient-to-r from-indigo-600 to-indigo-400'
                  }`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function NameModal({
  name,
  onNameChange,
  onSubmit,
}: {
  name: string
  onNameChange: (value: string) => void
  onSubmit: () => void
}) {
  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0 && trimmed.length <= 10

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-[#0F172A]/70 backdrop-blur-md"
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0F172A]/95 p-6 shadow-2xl backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-modal-title"
      >
        <h2 id="name-modal-title" className="text-lg font-bold text-white">
          안녕하세요! 어떤 식당이 마음에 드세요?
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          투표에 사용할 이름을 입력해 주세요
        </p>

        <input
          type="text"
          value={name}
          maxLength={10}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) onSubmit()
          }}
          placeholder="이름 (최대 10자)"
          className="mt-4 w-full rounded-xl border border-white/[0.08] bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
          autoFocus
        />

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 py-3 text-sm font-semibold text-white transition hover:from-indigo-500 hover:to-indigo-400 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
        >
          투표 시작하기
        </button>
      </motion.div>
    </div>
  )
}

function ErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F172A] px-4">
      <div className="max-w-sm text-center">
        <p className="text-5xl" aria-hidden>
          🔗
        </p>
        <h1 className="mt-4 text-xl font-bold text-white">
          링크가 만료되었거나 존재하지 않아요
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          공유 링크가 올바른지 확인하거나, 모임 주최자에게 새 링크를 요청해
          주세요.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
        >
          Moim 홈으로
        </a>
      </div>
    </div>
  )
}

export default function VotePage() {
  const { shareId } = useParams<{ shareId: string }>()

  const [phase, setPhase] = useState<PagePhase>('loading')
  const [result, setResult] = useState<MidpointResult | null>(null)
  const [voterName, setVoterName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!shareId) {
      setPhase('error')
      return
    }

    const loaded = loadSharedResult(shareId)
    if (!loaded) {
      setPhase('error')
      setResult(null)
      return
    }

    setResult(loaded)
    setPhase('name')
  }, [shareId])

  useEffect(() => {
    if (!shareId) return

    const storageKey = getStorageKey(shareId)

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return

      const loaded = loadSharedResult(shareId)
      if (loaded) setResult(loaded)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [shareId])

  const toggleSelection = (restaurantId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(restaurantId)) {
        next.delete(restaurantId)
      } else {
        next.add(restaurantId)
      }
      return next
    })
  }

  const handleStartVoting = () => {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed.length > 10) return
    setVoterName(trimmed)
    setPhase('voting')
  }

  const handleSubmitVote = () => {
    if (!result || !shareId || selectedIds.size === 0) return

    const updatedVotes = { ...result.votes }

    for (const restaurantId of selectedIds) {
      const existing = updatedVotes[restaurantId] ?? []
      if (!existing.includes(voterName)) {
        updatedVotes[restaurantId] = [...existing, voterName]
      }
    }

    const updatedResult: MidpointResult = { ...result, votes: updatedVotes }
    saveSharedResult(shareId, updatedResult)
    setResult(updatedResult)
    setPhase('thanks')
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/20 border-t-indigo-400" />
      </div>
    )
  }

  if (phase === 'error' || !result) {
    return <ErrorPage />
  }

  const regionGroups = getRegionGroups(result)
  const selectedCount = selectedIds.size

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#0F172A]">
      <header className="border-b border-white/[0.06] px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-slate-400">
            <span className="text-white">Moi</span>
            <span className="text-emerald-400">m</span>
            <span className="text-slate-500"> · 식당 투표</span>
          </p>
        </div>
      </header>

      <main className="mx-auto box-border w-full min-w-0 max-w-2xl space-y-6 px-4 py-6 pb-32 sm:px-6 sm:py-8">
        <AnimatePresence mode="wait">
          {phase === 'thanks' ? (
            <motion.div
              key="thanks"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 text-center backdrop-blur-md"
            >
              <p className="text-3xl" aria-hidden>
                🎉
              </p>
              <h1 className="mt-3 text-xl font-bold text-white">
                투표해주셔서 감사해요! 🎉
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                모든 참여자가 투표하면 결과를 확인해보세요.
              </p>
            </motion.div>
          ) : phase === 'voting' ? (
            <motion.div
              key="voting"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <h1 className="text-lg font-semibold text-white sm:text-xl">
                마음에 드는 식당을 선택해주세요 (중복 선택 가능)
              </h1>

              {regionGroups.map((group) => (
                <section key={group.label} className="space-y-3">
                  <h2 className="text-sm font-medium text-emerald-400">
                    {group.label}
                  </h2>
                  <RestaurantCardGrid>
                    {group.restaurants.map((restaurant) => (
                      <RestaurantCard
                        key={restaurant.id}
                        restaurant={restaurant}
                        selectable
                        selected={selectedIds.has(restaurant.id)}
                        onSelect={() => toggleSelection(restaurant.id)}
                      />
                    ))}
                  </RestaurantCardGrid>
                </section>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <VoteResultsChart result={result} />
      </main>

      {phase === 'name' ? (
        <NameModal
          name={nameInput}
          onNameChange={setNameInput}
          onSubmit={handleStartVoting}
        />
      ) : null}

      {phase === 'voting' ? (
        <div className="fixed bottom-0 left-0 right-0 border-t border-white/[0.06] bg-[#0F172A]/90 px-4 py-4 backdrop-blur-lg">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <p className="min-w-0 flex-1 text-sm text-slate-300">
              <span className="font-semibold text-indigo-400">
                {selectedCount}개
              </span>{' '}
              선택됨
            </p>
            <button
              type="button"
              onClick={handleSubmitVote}
              disabled={selectedCount === 0}
              className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:from-indigo-500 hover:to-indigo-400 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
            >
              투표 완료
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
