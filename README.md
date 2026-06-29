# Moim

AI 기반 소셜 모임 플래너. 참석자들의 출발 위치, 모임 목적, 음식 취향, 예산·분위기 조건을 바탕으로 서울에서 최적의 만남 지역과 맛집을 추천합니다. 공유 링크로 친구들과 식당 투표도 할 수 있습니다.

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Zustand
- Framer Motion
- React Router
- OpenAI API (`gpt-4o-search-preview`)

## Local Setup

### Prerequisites

- Node.js 20.19+ (or 22.12+)
- npm

### Install & Run

```bash
git clone <repository-url>
cd midpoint-meet
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 을 엽니다.

## Environment Variables

프로젝트 루트에 `.env` 파일을 생성합니다. `.env.example`을 참고하세요.

```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_SHARE_BASE_URL=http://localhost:5173
```

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_OPENAI_API_KEY` | Yes | OpenAI API key for restaurant recommendations |
| `VITE_SHARE_BASE_URL` | No | Base URL for share links (defaults to `https://yourdomain.com`) |

> `.env` 파일은 git에 커밋하지 마세요. API 키는 클라이언트에 노출되므로, 프로덕션에서는 백엔드 프록시 사용을 권장합니다.

환경 변수 변경 후 dev 서버를 재시작해야 합니다.

```bash
npm run dev
```

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Type-check and build for production
npm run preview  # Preview production build locally
```

## Vercel Deployment

1. [Vercel](https://vercel.com)에 GitHub 저장소를 연결합니다.
2. **Framework Preset:** Vite
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. **Environment Variables** (Project Settings → Environment Variables):
   - `VITE_OPENAI_API_KEY` — OpenAI API key
   - `VITE_SHARE_BASE_URL` — 배포된 도메인 (예: `https://your-app.vercel.app`)
6. Deploy

`vercel.json`에 SPA 라우팅 rewrite가 설정되어 있어 `/vote/:shareId` 같은 클라이언트 라우트가 정상 동작합니다.

### Deploy via CLI (optional)

```bash
npm i -g vercel
vercel
vercel --prod
```

## Routes

| Path | Page |
|------|------|
| `/` | Home — 모임 조건 입력 & AI 추천 |
| `/vote/:shareId` | Vote — 공유 링크 식당 투표 |
| `*` | 404 |

## License

Private
