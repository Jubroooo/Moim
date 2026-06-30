import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getDatabase, type Database } from 'firebase/database'

let app: FirebaseApp | null = null
let database: Database | null = null

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  }
}

export function isFirebaseConfigured(): boolean {
  const { apiKey, projectId, databaseURL } = getFirebaseConfig()
  return Boolean(
    apiKey &&
      projectId &&
      databaseURL &&
      apiKey !== 'your_key_here' &&
      databaseURL !== 'your_database_url_here',
  )
}

function getFirebaseApp(): FirebaseApp {
  if (app) return app

  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase 환경 변수(VITE_FIREBASE_*)를 .env 파일에 설정해 주세요',
    )
  }

  app = getApps().length > 0 ? getApps()[0]! : initializeApp(getFirebaseConfig())
  return app
}

export function getFirebaseDb(): Database {
  if (database) return database
  database = getDatabase(getFirebaseApp())
  return database
}

export function getVoteRefPath(shareId: string): string {
  return `votes/${shareId}`
}
