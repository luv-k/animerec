import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import CommentsSection from './CommentsSection'

function ShowDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [show, setShow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myRating, setMyRating] = useState(null)
  const [ratingSaved, setRatingSaved] = useState(false)
  const [inWatchlist, setInWatchlist] = useState(false)

  useEffect(() => {
    fetch(`http://localhost:8000/shows/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found")
        return res.json()
      })
      .then((data) => setShow(data))
      .catch(() => setShow(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    fetch("http://localhost:8000/watchlist", { credentials: "include" })
      .then((res) => res.json())
      .then((list) => setInWatchlist(list.some((item) => item.show_id === Number(id))))
      .catch(() => {})
  }, [id])

  function toggleWatchlist() {
    const method = inWatchlist ? "DELETE" : "POST"
    fetch(`http://localhost:8000/watchlist/${id}`, { method, credentials: "include" })
      .then((res) => {
        if (res.ok) setInWatchlist(!inWatchlist)
      })
      .catch((error) => console.error("Failed to update watchlist:", error))
  }

  function rateShow(score) {
    setMyRating(score)
    fetch("http://localhost:8000/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ show_id: Number(id), score }),
    })
      .then((res) => {
        if (res.ok) {
          setRatingSaved(true)
          setTimeout(() => setRatingSaved(false), 1500)
        }
      })
      .catch((error) => console.error("Failed to save rating:", error))
  }

  function removeRating() {
    fetch(`http://localhost:8000/ratings/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
      .then((res) => {
        if (res.ok) setMyRating(null)
      })
      .catch((error) => console.error("Failed to remove rating:", error))
  }

  if (loading) return <p style={{ padding: "24px" }}>Loading...</p>
  if (!show) return <p style={{ padding: "24px" }}>Show not found.</p>

  return (
    <div style={{ padding: "24px" }}>
      <button onClick={() => navigate("/")} style={{ marginBottom: "16px", background: "none", border: "1px solid #333", color: "#e8e8e8", padding: "6px 14px", borderRadius: "6px", cursor: "pointer" }}>
        ← Back
      </button>

      <div style={{ display: "flex", gap: "24px", marginBottom: "28px" }}>
        <img src={show.poster_url} alt={show.title} style={{ width: "220px", borderRadius: "10px", objectFit: "cover" }} />
        <div>
          <h1 style={{ fontSize: "28px", marginBottom: "10px" }}>{show.title}</h1>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            {show.genres.map((g) => (
              <span key={g} style={{ fontSize: "12px", background: "#1c1f26", padding: "4px 10px", borderRadius: "12px" }}>{g}</span>
            ))}
          </div>
          <p style={{ marginBottom: "10px" }}>★ {show.avg_rating}</p>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "13px", color: "#9aa0aa", marginBottom: "14px" }}>
            {show.total_episodes && <span>{show.total_episodes} episodes</span>}
            {show.status && <span>{show.status.replace(/_/g, " ")}</span>}
            {show.start_date && (
              <span>
                {show.start_date}{show.end_date ? ` – ${show.end_date}` : " – ongoing"}
              </span>
            )}
          </div>

          {show.synopsis && (
            <p style={{ fontSize: "14px", lineHeight: "1.5", color: "#cfd3da", marginBottom: "16px", maxWidth: "480px" }}>
              {show.synopsis}
            </p>
          )}

          <button
            onClick={toggleWatchlist}
            style={{
              marginBottom: "16px",
              background: inWatchlist ? "#e8e8e8" : "none",
              color: inWatchlist ? "#0f1115" : "#e8e8e8",
              border: "1px solid #333",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            {inWatchlist ? "✓ In Watchlist" : "+ Add to Watchlist"}
          </button>

          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontSize: "13px", color: "#9aa0aa", marginBottom: "6px" }}>
              Rate this show{ratingSaved && " — saved!"}
            </p>
            <div style={{ display: "flex", gap: "4px" }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => rateShow(n)}
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "6px",
                    border: "none",
                    background: myRating >= n ? "#e8e8e8" : "#1c1f26",
                    color: myRating >= n ? "#0f1115" : "#9aa0aa",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            {myRating !== null && (
              <button
                onClick={removeRating}
                style={{ marginTop: "8px", background: "none", border: "none", color: "#ff6b6b", fontSize: "12px", cursor: "pointer", padding: 0 }}
              >
                Remove my rating
              </button>
            )}
          </div>
        </div>
      </div>

      <h2 style={{ marginBottom: "14px" }}>Episodes</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "500px" }}>
        {show.episodes.map((ep) => (
          <div
            key={ep.id}
            onClick={() => ep.watchable && navigate(`/watch/${ep.id}`)}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#1c1f26", padding: "12px 16px", borderRadius: "8px",
              cursor: ep.watchable ? "pointer" : "not-allowed",
              opacity: ep.watchable ? 1 : 0.5,
            }}
          >
            <span>Episode {ep.episode_number}{ep.title && ep.title !== `Episode ${ep.episode_number}` ? ` — ${ep.title}` : ""}</span>
            <span style={{ fontSize: "13px", color: ep.watchable ? "#e8e8e8" : "#666" }}>
              {ep.watchable ? "▶ Watch" : "Unavailable"}
            </span>
          </div>
        ))}
      </div>

      {show.trailer_youtube_id && (
        <div style={{ marginTop: "28px", maxWidth: "600px" }}>
          <h2 style={{ marginBottom: "14px" }}>Trailer</h2>
          <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: "10px", overflow: "hidden" }}>
            <iframe
              src={`https://www.youtube.com/embed/${show.trailer_youtube_id}`}
              title={`${show.title} trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            />
          </div>
        </div>
      )}

      <CommentsSection showId={id} />
    </div>
  )
}

export default ShowDetail