import { AnimatePresence, motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'

import LoadingOverlay from '../components/LoadingOverlay'
import ResultSection from '../components/ResultSection'
import { getAIRecommendation } from '../lib/api'
import {
  DEFAULT_PEOPLE_COUNT,
  MAX_PEOPLE,
  useMidpointStore,
} from '../store/useMidpointStore'

const PURPOSE_OPTIONS = [
  { value: '친목/동기모임', emoji: '🍻' },
  { value: '선후배식사', emoji: '🍽️' },
  { value: '회식', emoji: '🥂' },
  { value: '청첩장모임', emoji: '💌' },
  { value: '소개팅', emoji: '💕' },
  { value: '데이트', emoji: '🌹' },
  { value: '스터디', emoji: '📚' },
  { value: '비즈니스', emoji: '💼' },
] as const

const PREFER_FOODS = [
  '한식',
  '양식',
  '일식',
  '중식',
  '고기',
  '브런치',
  '카페',
  '술집',
  '디저트',
  '비건',
] as const

const EXCLUDE_FOODS = [
  '매운음식',
  '해산물',
  '고기',
  '술',
  '밀가루',
  '기름진음식',
] as const

const BUDGET_OPTIONS = [
  { value: '1만원이하', label: '1만원 이하' },
  { value: '1~3만원', label: '1~3만원' },
  { value: '3~5만원', label: '3~5만원' },
  { value: '5만원이상', label: '5만원 이상' },
] as const

const VIBE_OPTIONS = [
  '조용한',
  '감성적인',
  '활기찬',
  '고급스러운',
  '가성비좋은',
  '대화하기좋은',
] as const

const MOVE_PRIORITY_OPTIONS = [
  { value: '공평한이동', label: '공평한 이동' },
  { value: '역세권우선', label: '역세권 우선' },
  { value: '한명더이동', label: '한 명 더 이동' },
  { value: '대중교통편의', label: '대중교통 편의' },
] as const

const AVATAR_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function GlassCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`box-border min-w-0 max-w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-md sm:p-6 ${className}`}
    >
      {children}
    </section>
  )
}

function SectionTitle({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      ) : null}
    </div>
  )
}

function CityMapOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.05]"
      aria-hidden
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="city-grid"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 80V0h80v80H0zm20 20h12v28H20V20zm28 0h12v40H48V20zm-14 36h12v24H34V56z"
              fill="white"
              fillOpacity="0.9"
            />
            <path
              d="M0 0h80M0 40h80M40 0v80"
              stroke="white"
              strokeWidth="0.5"
              fill="none"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#city-grid)" />
        <circle cx="15%" cy="20%" r="120" fill="white" fillOpacity="0.15" />
        <circle cx="85%" cy="75%" r="160" fill="white" fillOpacity="0.1" />
      </svg>
    </div>
  )
}

function HeroSection() {
  return (
    <header className="hero-gradient relative overflow-hidden px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16 max-w-[100vw]">
      <CityMapOverlay />

      <div className="relative mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium tracking-wide text-emerald-200 backdrop-blur-sm">
          AI Social Meeting Planner
        </span>

        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
          <span className="text-white">Moi</span>
          <span className="text-emerald-400">m</span>
        </h1>

        <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
          사람과 사람 사이, 가장 좋은 만남의 지점을 찾아드립니다
        </p>
      </div>
    </header>
  )
}

function PeopleSection() {
  const people = useMidpointStore((s) => s.people)
  const addPerson = useMidpointStore((s) => s.addPerson)
  const removePerson = useMidpointStore((s) => s.removePerson)
  const updateLocation = useMidpointStore((s) => s.updateLocation)

  const canAdd = people.length < MAX_PEOPLE
  const canRemove = people.length > DEFAULT_PEOPLE_COUNT

  return (
    <GlassCard>
      <SectionTitle
        title="참석자 위치"
        description={`최소 ${DEFAULT_PEOPLE_COUNT}명, 최대 ${MAX_PEOPLE}명까지 입력할 수 있어요`}
      />

      <div className="space-y-3">
        <AnimatePresence initial={false} mode="popLayout">
          {people.map((person, index) => (
            <motion.div
              key={person.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex items-center gap-3 overflow-hidden"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30"
                aria-hidden
              >
                {AVATAR_LETTERS[index]}
              </div>

              <input
                type="text"
                value={person.location}
                onChange={(e) => updateLocation(person.id, e.target.value)}
                placeholder={`${AVATAR_LETTERS[index]}의 출발 위치 (예: 강남역)`}
                className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.06] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
              />

              <button
                type="button"
                onClick={() => removePerson(person.id)}
                disabled={!canRemove}
                aria-label={`${AVATAR_LETTERS[index]} 참석자 삭제`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] text-slate-400 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/[0.08] disabled:hover:bg-transparent disabled:hover:text-slate-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {canAdd ? (
        <button
          type="button"
          onClick={addPerson}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-2.5 text-sm text-slate-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          참석자 추가 ({people.length}/{MAX_PEOPLE})
        </button>
      ) : null}
    </GlassCard>
  )
}

function PurposeSection() {
  const purpose = useMidpointStore((s) => s.purpose)
  const setPurpose = useMidpointStore((s) => s.setPurpose)

  return (
    <GlassCard>
      <SectionTitle
        title="모임 목적"
        description="어떤 자리인지 선택해 주세요"
      />

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 md:grid-cols-4">
        {PURPOSE_OPTIONS.map((option) => {
          const selected = purpose === option.value

          return (
            <motion.button
              key={option.value}
              type="button"
              onClick={() => setPurpose(option.value)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition sm:py-4 ${
                selected
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-white shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                  : 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.06]'
              }`}
            >
              <span className="text-xl sm:text-2xl" aria-hidden>
                {option.emoji}
              </span>
              <span className="text-[11px] font-medium leading-tight sm:text-xs">
                {option.value}
              </span>
            </motion.button>
          )
        })}
      </div>
    </GlassCard>
  )
}

function FoodChip({
  label,
  selected,
  variant,
  onClick,
}: {
  label: string
  selected: boolean
  variant: 'prefer' | 'exclude'
  onClick: () => void
}) {
  const selectedClass =
    variant === 'prefer'
      ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
      : 'border-red-500/60 bg-red-500/15 text-red-200'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
        selected
          ? selectedClass
          : 'border-white/[0.08] bg-white/[0.04] text-slate-300 hover:border-white/15 hover:bg-white/[0.08]'
      }`}
    >
      {label}
    </button>
  )
}

function FoodPreferencesSection() {
  const preferFoods = useMidpointStore((s) => s.preferFoods)
  const excludeFoods = useMidpointStore((s) => s.excludeFoods)
  const togglePrefer = useMidpointStore((s) => s.togglePrefer)
  const toggleExclude = useMidpointStore((s) => s.toggleExclude)

  return (
    <GlassCard>
      <SectionTitle title="음식 취향" description="선호와 제외 항목을 골라 주세요" />

      <div className="space-y-5">
        <div>
          <p className="mb-2.5 text-sm font-medium text-slate-300">선호 음식</p>
          <div className="flex flex-wrap gap-2">
            {PREFER_FOODS.map((food) => (
              <FoodChip
                key={food}
                label={food}
                variant="prefer"
                selected={preferFoods.includes(food)}
                onClick={() => togglePrefer(food)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-sm font-medium text-slate-300">제외 음식</p>
          <div className="flex flex-wrap gap-2">
            {EXCLUDE_FOODS.map((food) => (
              <FoodChip
                key={food}
                label={food}
                variant="exclude"
                selected={excludeFoods.includes(food)}
                onClick={() => toggleExclude(food)}
              />
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[] | readonly string[]
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
      >
        <option value="" className="bg-slate-900">
          선택해 주세요
        </option>
        {options.map((option) => {
          const optionValue =
            typeof option === 'string' ? option : option.value
          const optionLabel =
            typeof option === 'string' ? option : option.label

          return (
            <option key={optionValue} value={optionValue} className="bg-slate-900">
              {optionLabel}
            </option>
          )
        })}
      </select>
    </label>
  )
}

function ConditionsSection() {
  const budget = useMidpointStore((s) => s.budget)
  const vibe = useMidpointStore((s) => s.vibe)
  const movePriority = useMidpointStore((s) => s.movePriority)
  const setBudget = useMidpointStore((s) => s.setBudget)
  const setVibe = useMidpointStore((s) => s.setVibe)
  const setMovePriority = useMidpointStore((s) => s.setMovePriority)

  return (
    <GlassCard>
      <SectionTitle title="추가 조건" description="예산, 분위기, 이동 조건을 설정해 주세요" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SelectField
          label="예산"
          value={budget}
          onChange={setBudget}
          options={BUDGET_OPTIONS}
        />
        <SelectField
          label="분위기"
          value={vibe}
          onChange={setVibe}
          options={VIBE_OPTIONS.map((v) => ({ value: v, label: v }))}
        />
        <SelectField
          label="이동 우선순위"
          value={movePriority}
          onChange={setMovePriority}
          options={MOVE_PRIORITY_OPTIONS}
        />
      </div>
    </GlassCard>
  )
}

function CtaSection() {
  const people = useMidpointStore((s) => s.people)
  const purpose = useMidpointStore((s) => s.purpose)
  const preferFoods = useMidpointStore((s) => s.preferFoods)
  const excludeFoods = useMidpointStore((s) => s.excludeFoods)
  const budget = useMidpointStore((s) => s.budget)
  const vibe = useMidpointStore((s) => s.vibe)
  const movePriority = useMidpointStore((s) => s.movePriority)
  const isLoading = useMidpointStore((s) => s.isLoading)
  const setLoading = useMidpointStore((s) => s.setLoading)
  const setResult = useMidpointStore((s) => s.setResult)

  const [error, setError] = useState<string | null>(null)
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null)

  const disabled = !purpose || isLoading

  const handleSubmit = async () => {
    if (disabled) return

    const locations = people
      .map((person) => person.location.trim())
      .filter(Boolean)

    if (locations.length < DEFAULT_PEOPLE_COUNT) {
      setError('모든 참석자의 출발 위치를 입력해 주세요')
      return
    }

    setError(null)
    setLoadingStatus('위치 분석 중...')
    setLoading(true)

    try {
      const result = await getAIRecommendation(
        {
          locations,
          purpose,
          preferFoods,
          excludeFoods,
          budget,
          vibe,
          movePriority,
        },
        { onStatus: setLoadingStatus },
      )
      setResult(result)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '추천을 가져오지 못했습니다',
      )
    } finally {
      setLoadingStatus(null)
      setLoading(false)
    }
  }

  return (
    <>
      <LoadingOverlay visible={isLoading} statusMessage={loadingStatus} />

      <div className="sticky bottom-0 box-border w-full max-w-[100vw] border-t border-white/[0.06] bg-[#0F172A]/90 px-4 py-4 backdrop-blur-lg sm:px-6">
        {error ? (
          <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-500 hover:to-emerald-400 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
        >
          {isLoading ? '추천 생성 중...' : '✨ AI에게 추천받기'}
        </button>
      </div>
    </>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#0F172A]">
      <HeroSection />

      <main className="mx-auto box-border w-full min-w-0 max-w-2xl space-y-4 px-4 pb-28 pt-6 sm:space-y-5 sm:px-6 sm:pb-32 sm:pt-8">
        <PeopleSection />
        <PurposeSection />
        <FoodPreferencesSection />
        <ConditionsSection />
        <ResultSection />
      </main>

      <CtaSection />
    </div>
  )
}
