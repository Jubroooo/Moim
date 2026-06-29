import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F172A] px-4">
      <div className="max-w-sm text-center">
        <p className="text-6xl font-bold text-emerald-400/80">404</p>
        <h1 className="mt-4 text-xl font-bold text-white">
          페이지를 찾을 수 없어요
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          주소가 잘못되었거나 페이지가 이동되었을 수 있어요.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
        >
          Moim 홈으로
        </Link>
      </div>
    </div>
  )
}
