import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { LOADING_STEP_MESSAGES } from '../lib/api'

const STEP_INTERVAL_MS = 2400

export default function LoadingOverlay({ visible }: { visible: boolean }) {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!visible) {
      setStepIndex(0)
      return
    }

    const interval = setInterval(() => {
      setStepIndex((current) =>
        current < LOADING_STEP_MESSAGES.length - 1 ? current + 1 : current,
      )
    }, STEP_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [visible])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/85 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="AI 추천 생성 중"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.06] p-6 backdrop-blur-md">
            <div className="mb-5 flex justify-center">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-400" />
                <div className="absolute inset-2 rounded-full bg-emerald-500/10" />
              </div>
            </div>

            <p className="text-center text-sm font-medium text-emerald-300">
              Moim AI가 추천 중
            </p>

            <div className="mt-4 space-y-2">
              {LOADING_STEP_MESSAGES.map((message, index) => {
                const isActive = index === stepIndex
                const isDone = index < stepIndex

                return (
                  <motion.div
                    key={message}
                    animate={{
                      opacity: isActive || isDone ? 1 : 0.35,
                      x: isActive ? 0 : -2,
                    }}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        isDone
                          ? 'bg-emerald-500 text-white'
                          : isActive
                            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40'
                            : 'bg-white/5 text-slate-500'
                      }`}
                    >
                      {isDone ? '✓' : index + 1}
                    </span>
                    <span
                      className={
                        isActive
                          ? 'font-medium text-white'
                          : isDone
                            ? 'text-slate-400'
                            : 'text-slate-500'
                      }
                    >
                      {message}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
