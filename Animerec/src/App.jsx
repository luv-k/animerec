import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthForm from './AuthForm'
import HomePage from './HomePage'
import ShowDetail from './ShowDetail'
import Player from './Player'
import ProfilePage from './ProfilePage'
import WatchlistPage from './WatchlistPage'
import SearchResultsPage from './SearchResultsPage'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    fetch("http://localhost:8000/me", { credentials: "include" })
      .then((res) => setIsLoggedIn(res.ok))
      .finally(() => setCheckingAuth(false))
  }, [])

  if (checkingAuth) {
    return <p style={{ padding: "20px" }}>Loading...</p>
  }

  if (!isLoggedIn) {
    return <AuthForm onLoginSuccess={() => setIsLoggedIn(true)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/show/:id" element={<ShowDetail />} />
        <Route path="/watch/:id" element={<Player />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/search" element={<SearchResultsPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App