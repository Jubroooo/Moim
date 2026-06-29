const BOT_USER_AGENT =
  /bot|crawler|spider|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|WhatsApp|Discordbot|KakaoTalkScrap|kakaotalk-scrap|Yeti|NaverBot/i

export const config = {
  matcher: '/vote/:shareId',
}

export default async function middleware(request: Request) {
  const userAgent = request.headers.get('user-agent') ?? ''
  if (!BOT_USER_AGENT.test(userAgent)) {
    return
  }

  const url = new URL(request.url)
  const shareId = url.pathname.match(/^\/vote\/([^/]+)/)?.[1]
  if (!shareId) {
    return
  }

  const ogUrl = new URL('/api/og/vote', url.origin)
  ogUrl.searchParams.set('shareId', shareId)
  url.searchParams.forEach((value, key) => {
    ogUrl.searchParams.set(key, value)
  })

  return fetch(ogUrl.toString())
}
