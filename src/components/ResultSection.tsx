import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'

import RestaurantCard, { RestaurantCardGrid } from './RestaurantCard'
import { RESTAURANTS_PER_REGION } from '../lib/api'
import { createShareLink } from '../lib/share'
import { useMidpointStore } from '../store/useMidpointStore'
import type { MidpointResult, RegionRecommendation } from '../types'
import Toast from './Toast'

const ACTIVITY_COLOR_CLASSES: Record<string, string> = {
  indigo: 'bg-indigo-500/20 text-indigo-300 ring-indigo-500/30',
  green: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
  amber: 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
}

function ScoreBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-center backdrop-blur-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:text-xs">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold text-emerald-400 sm:text-xl">{value}</p>
    </div>
  )
}

function ConditionChip({ label }: { label: string }) {
  if (!label) return null

  return (
    <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
      {label}
    </span>
  )
}

function RegionSection({ region }: { region: RegionRecommendation }) {
  const restaurants = region.restaurants.slice(0, RESTAURANTS_PER_REGION)
  const rankLabel = region.rank === 1 ? '1순위' : '2순위'

  return (
    <section className="box-border min-w-0 max-w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-md sm:p-6">
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
            region.rank === 1
              ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
              : 'bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30'
          }`}
        >
          {rankLabel}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-white">{region.name}</h3>
          <ul className="mt-2 space-y-1">
            {region.reasons.map((reason) => (
              <li
                key={reason}
                className="flex items-start gap-2 text-sm text-slate-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <RestaurantCardGrid>
        {restaurants.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} />
        ))}
      </RestaurantCardGrid>

      {region.activities.length > 0 ? (
        <div className="space-y-2.5 border-t border-white/[0.06] pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            추천 코스
          </p>
          {region.activities.map((activity) => (
            <div key={`${activity.label}-${activity.text}`} className="flex items-start gap-3">
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${
                  ACTIVITY_COLOR_CLASSES[activity.color] ??
                  ACTIVITY_COLOR_CLASSES.indigo
                }`}
              >
                {activity.label}
              </span>
              <p className="text-sm text-slate-300">{activity.text}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function BalanceBarChart({
  balances,
}: {
  balances: MidpointResult['balances']
}) {
  const maxMinutes = Math.max(...balances.map((b) => b.minutes), 1)

  return (
    <section className="box-border min-w-0 max-w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-md sm:p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">이동 시간 균형</h3>

      <div className="space-y-4">
        {balances.map((balance, index) => {
          const widthPercent = (balance.minutes / maxMinutes) * 100

          return (
            <div key={`${balance.name}-${balance.location}`}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-semibold text-white">{balance.name}</span>
                  <span className="ml-2 truncate text-sm text-slate-400">
                    {balance.location}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-medium text-emerald-400">
                  {balance.minutes}분
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{
                    duration: 0.75,
                    delay: 0.15 + index * 0.1,
                    ease: 'easeOut',
                  }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ResultHeader({ result }: { result: MidpointResult }) {
  const chips = [
    result.purpose,
    result.budget || null,
    result.vibe || null,
  ].filter(Boolean) as string[]

  return (
    <header className="space-y-4">
      <h2 className="text-xl font-bold text-white sm:text-2xl">
        AI가 분석한 추천 만남 지역 TOP 2
      </h2>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <ScoreBadge label="이동공정성" value={`${result.fairnessScore}%`} />
        <ScoreBadge label="만남적합도" value={`${result.matchScore}%`} />
        <ScoreBadge label="참여인원" value={`${result.peopleCount}명`} />
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {chips.map((chip, index) => (
            <span key={chip} className="inline-flex items-center gap-2">
              <ConditionChip label={chip} />
              {index < chips.length - 1 ? (
                <span className="text-slate-600" aria-hidden>
                  ·
                </span>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </header>
  )
}

export default function ResultSection() {
  const result = useMidpointStore((s) => s.result)
  const setResult = useMidpointStore((s) => s.setResult)
  const reset = useMidpointStore((s) => s.reset)

  const sectionRef = useRef<HTMLElement>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    if (result && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  const handleShare = useCallback(async () => {
    if (!result || isSharing) return

    setIsSharing(true)

    try {
      const { url, updatedResult } = createShareLink(result)
      setResult(updatedResult)
      await navigator.clipboard.writeText(url)
      setToastMessage('링크가 복사되었습니다! 친구들에게 공유해보세요 🎉')
      setToastVisible(true)
    } catch {
      setToastMessage('링크 복사에 실패했습니다. 다시 시도해 주세요.')
      setToastVisible(true)
    } finally {
      setIsSharing(false)
    }
  }, [result, isSharing, setResult])

  const handleCloseToast = useCallback(() => setToastVisible(false), [])

  if (!result) return null

  return (
    <>
      <motion.section
        ref={sectionRef}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="box-border min-w-0 max-w-full space-y-5 border-t border-white/[0.06] pt-8 sm:space-y-6"
        aria-label="AI 추천 결과"
      >
        <ResultHeader result={result} />

        {result.regions.map((region) => (
          <RegionSection key={`${region.rank}-${region.name}`} region={region} />
        ))}

        <BalanceBarChart balances={result.balances} />

        <blockquote className="relative rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-5 py-5 backdrop-blur-md sm:px-6">
          <span
            className="absolute left-4 top-2 text-4xl leading-none text-indigo-400/40"
            aria-hidden
          >
            "
          </span>
          <p className="relative z-10 pl-6 text-sm italic leading-relaxed text-indigo-100 sm:text-base">
            {result.summary}
          </p>
          <span
            className="absolute bottom-0 right-4 text-4xl leading-none text-indigo-400/40"
            aria-hidden
          >
            "
          </span>
        </blockquote>

        <div className="space-y-3 pb-4">
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            className="w-full rounded-xl border border-white/20 bg-transparent py-3.5 text-sm font-semibold text-white transition hover:border-emerald-500/40 hover:bg-emerald-500/5 disabled:opacity-60"
          >
            🔗 친구들에게 공유하기
          </button>

          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl border border-white/15 bg-transparent py-3 text-sm font-medium text-slate-400 transition hover:border-white/25 hover:text-slate-200"
          >
            다시 설정하기
          </button>
        </div>
      </motion.section>

      <Toast
        message={toastMessage}
        visible={toastVisible}
        onClose={handleCloseToast}
      />
    </>
  )
}
