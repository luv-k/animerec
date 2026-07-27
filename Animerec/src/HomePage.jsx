import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ShowCard from './ShowCard'
import GenrePills from './GenrePills'
import HeroBanner from './HeroBanner'
import RecommendedRow from './RecommendedRow'
import WatchHistoryRow from './WatchHistoryRow'
import TopAiringSidebar from './TopAiringSidebar'
import SearchBar from './SearchBar'
import { SkeletonRow } from './ShowCardSkeleton'

function HomePage() {
  const [shows, setShows] = useState([])
  const [showsLoading, setShowsLoading] = useState(true)
  const [selectedGenre, setSelectedGenre] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch("http://localhost:8000/shows")
      .then((response) => response.json())
      .then((data) => setShows(data))
      .catch((error) => console.error("Failed to fetch shows:", error))
      .finally(() => setShowsLoading(false))
  }, [])

  const allGenres = [...new Set(shows.flatMap((s) => s.genres))].sort()
  const visibleShows = selectedGenre
    ? shows.filter((s) => s.genres.includes(selectedGenre))
    : shows
  const featuredShows = [...shows].sort((a, b) => b.avg_rating - a.avg_rating).slice(0, 5)

  return (
    <div>
      {/* Wrapper is position:relative so the header can float on top of the hero banner */}
      <div style={{ position: "relative" }}>
        <header style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center",
          padding: "16px 24px",
          background: "linear-gradient(to bottom, rgba(15,17,21,0.75), transparent)",
        }}>
          <h1 style={{ fontSize: "24px", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>ANIMEREC</h1>
          <SearchBar />
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              onClick={() => navigate("/watchlist")}
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.2)", color: "#e8e8e8", padding: "6px 14px", borderRadius: "6px", cursor: "pointer" }}
            >
              Watchlist
            </button>
            <button
              onClick={() => navigate("/profile")}
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.2)", color: "#e8e8e8", padding: "6px 14px", borderRadius: "6px", cursor: "pointer" }}
            >
              Profile
            </button>
          </div>
        </header>

        <HeroBanner shows={featuredShows} />
      </div>

      <div style={{ padding: "0 24px 24px" }}>
        <div style={{ display: "flex", gap: "32px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <WatchHistoryRow />
            <RecommendedRow />
            <GenrePills genres={allGenres} selected={selectedGenre} onSelect={setSelectedGenre} />

            {showsLoading ? (
              <SkeletonRow count={8} />
            ) : visibleShows.length === 0 ? (
              <p style={{ color: "#9aa0aa", padding: "20px 0" }}>No shows found.</p>
            ) : (
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                {visibleShows.map((show) => (
                  <div key={show.id} onClick={() => navigate(`/show/${show.id}`)}>
                    <ShowCard
                      title={show.title}
                      genres={show.genres}
                      rating={show.avg_rating}
                      posterUrl={show.poster_url}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <TopAiringSidebar />
        </div>
      </div>
    </div>
  )
}

export default HomePage