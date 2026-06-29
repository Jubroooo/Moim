import {
  buildVoteOgDescription,
  buildVoteOgMetadata,
  buildVoteOgTitle,
  getOgImageUrl,
  getSiteBaseUrl,
} from './og'
import type { MidpointResult } from '../types'

const KAKAO_SDK_URL = 'https://developers.kakao.com/sdk/js/kakao.js'

interface KakaoShareLink {
  mobileWebUrl: string
  webUrl: string
}

interface KakaoShareContent {
  title: string
  description: string
  imageUrl: string
  link: KakaoShareLink
}

interface KakaoShareButton {
  title: string
  link: KakaoShareLink
}

interface KakaoShareFeedPayload {
  objectType: 'feed'
  content: KakaoShareContent
  buttons: KakaoShareButton[]
}

interface KakaoShareApi {
  init: (key: string) => void
  isInitialized: () => boolean
  Share: {
    sendDefault: (payload: KakaoShareFeedPayload) => void
  }
}

declare global {
  interface Window {
    Kakao?: KakaoShareApi
  }
}

let sdkLoadPromise: Promise<void> | null = null

function getKakaoJsKey(): string | null {
  const key = import.meta.env.VITE_KAKAO_JS_KEY
  if (!key || key === 'your_key_here') return null
  return key
}

function loadKakaoSdk(): Promise<void> {
  if (window.Kakao) return Promise.resolve()

  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-kakao-sdk="true"]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error('카카오 SDK 로드 실패')),
        { once: true },
      )
      return
    }

    const script = document.createElement('script')
    script.src = KAKAO_SDK_URL
    script.async = true
    script.dataset.kakaoSdk = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('카카오 SDK 로드 실패'))
    document.head.appendChild(script)
  })

  return sdkLoadPromise
}

function initKakaoSdk(): void {
  const key = getKakaoJsKey()
  if (!key || !window.Kakao) return

  if (!window.Kakao.isInitialized()) {
    window.Kakao.init(key)
  }
}

export function isKakaoShareAvailable(): boolean {
  return getKakaoJsKey() !== null
}

export async function shareVoteLinkToKakao(
  shareUrl: string,
  result: MidpointResult,
): Promise<void> {
  const key = getKakaoJsKey()
  if (!key) {
    throw new Error('VITE_KAKAO_JS_KEY를 .env 파일에 설정해 주세요')
  }

  await loadKakaoSdk()
  initKakaoSdk()

  if (!window.Kakao?.isInitialized()) {
    throw new Error('카카오 SDK 초기화에 실패했습니다')
  }

  const metadata = buildVoteOgMetadata(result)
  const title = buildVoteOgTitle(metadata)
  const description = buildVoteOgDescription(metadata)
  const imageUrl = getOgImageUrl(getSiteBaseUrl())

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title,
      description,
      imageUrl,
      link: {
        mobileWebUrl: shareUrl,
        webUrl: shareUrl,
      },
    },
    buttons: [
      {
        title: '투표하러 가기',
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      },
    ],
  })
}
