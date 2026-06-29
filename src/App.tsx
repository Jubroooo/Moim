import { BrowserRouter, Route, Routes } from 'react-router-dom'

import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import VotePage from './pages/VotePage'

function App() {
  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/vote/:shareId" element={<VotePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
