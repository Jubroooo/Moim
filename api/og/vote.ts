function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getBaseUrl(requestUrl: string): string {
  const configured = process.env.VITE_SHARE_BASE_URL?.replace(/\/$/, '')
  if (configured) return configured

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`

  return new URL(requestUrl).origin
}

function buildVoteHtml(options: {
  baseUrl: string
  shareId: string
  purpose: string
  region1: string
  region2: string
  restaurantCount: number
}): string {
  const {
    baseUrl,
    shareId,
    purpose,
    region1,
    region2,
    restaurantCount,
  } = options

  const pageUrl = `${baseUrl}/vote/${shareId}?purpose=${encodeURIComponent(purpose)}&r1=${encodeURIComponent(region1)}&r2=${encodeURIComponent(region2)}&n=${restaurantCount}`
  const title = escapeHtml(`Moim — ${purpose} 모임 장소 투표`)
  const description = escapeHtml(
    `${region1} vs ${region2} · 식당 후보 ${restaurantCount}개 · 지금 투표해주세요!`,
  )
  const imageUrl = escapeHtml(`${baseUrl}/og-image.png`)
  const canonicalUrl = escapeHtml(pageUrl)

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:site_name" content="Moim" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <link rel="image_src" href="${imageUrl}" />
    <meta http-equiv="refresh" content="0;url=${canonicalUrl}" />
  </head>
  <body>
    <p><a href="${canonicalUrl}">Moim 투표 페이지로 이동</a></p>
  </body>
</html>`
}

export default function handler(request: Request): Response {
  const url = new URL(request.url)
  const pathShareId = url.pathname.match(/\/api\/og\/vote\/([^/]+)/)?.[1]
  const shareId = url.searchParams.get('shareId') ?? pathShareId ?? ''

  const purpose = url.searchParams.get('purpose') ?? '모임'
  const region1 = url.searchParams.get('r1') ?? '지역 1'
  const region2 = url.searchParams.get('r2') ?? '지역 2'
  const countRaw = url.searchParams.get('n')
  const restaurantCount = countRaw ? Number.parseInt(countRaw, 10) : 6

  const baseUrl = getBaseUrl(request.url)
  const html = buildVoteHtml({
    baseUrl,
    shareId,
    purpose,
    region1,
    region2,
    restaurantCount: Number.isNaN(restaurantCount) ? 6 : restaurantCount,
  })

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

export const config = {
  runtime: 'edge',
}
