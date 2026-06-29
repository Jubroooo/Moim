import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

interface ToastProps {
  message: string
  visible: boolean
  onClose: () => void
}

export default function Toast({ message, visible, onClose }: ToastProps) {
  useEffect(() => {
    if (!visible) return

    const timer = setTimeout(onClose, 3200)
    return () => clearTimeout(timer)
  }, [visible, onClose])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          className="fixed bottom-24 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-emerald-500/30 bg-emerald-950/95 px-4 py-3 text-center text-sm font-medium text-emerald-100 shadow-lg shadow-emerald-500/10 backdrop-blur-md"
          role="status"
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
