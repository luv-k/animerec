import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ShowCard from './ShowCard'

function WatchlistPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetch("http://localhost:8000/watchlist", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setItems(data))
      .catch((error) => console.error("Failed to fetch watchlist:", error))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: "24px" }}>
      <button
        onClick={() => navigate("/")}
        style={{ marginBottom: "20px", background: "none", border: "1px solid #333", color: "#e8e8e8", padding: "6px 14px", borderRadius: "6px", cursor: "pointer" }}
      >
        ← Back
      </button>

      <h1 style={{ marginBottom: "20px" }}>My Watchlist</h1>

      {loading ? (
        <p style={{ color: "#9aa0aa" }}>Loading...</p>
      ) : items.length === 0 ? (
        <p style={{ color: "#9aa0aa" }}>Your watchlist is empty. Add shows from their detail page.</p>
      ) : (
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {items.map((show) => (
            <div key={show.show_id} onClick={() => navigate(`/show/${show.show_id}`)}>
              <ShowCard
                title={show.title}
                genres={[]}
                rating={show.avg_rating}
                posterUrl={show.poster_url}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WatchlistPage