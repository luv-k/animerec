import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ShowCard from './ShowCard'

function RecommendedRow() {
  const [recs, setRecs] = useState([])
  const [reason, setReason] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch("http://localhost:8000/recommendations", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setRecs(data)
        setReason(data[0]?.reason ?? null)
      })
      .catch((error) => console.error("Failed to fetch recommendations:", error))
  }, [])

  if (recs.length === 0) return null

  return (
    <div style={{ marginBottom: "24px" }}>
      <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>Recommended for you</h2>
      <p style={{ fontSize: "13px", color: "#9aa0aa", marginBottom: "14px" }}>
        {reason === "popular"
          ? "Rate a few shows to get personalized picks"
          : "Based on your ratings and similar viewers"}
      </p>
      <div style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "8px" }}>
        {recs.map((rec) => (
          <div key={rec.id} onClick={() => navigate(`/show/${rec.id}`)}>
            <ShowCard
              title={rec.title}
              genres={rec.genres}
              rating={rec.score}
              posterUrl={rec.poster_url}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default RecommendedRow
