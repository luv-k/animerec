import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function TopAiringSidebar() {
  const [shows, setShows] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch("http://localhost:8000/shows")
      .then((res) => res.json())
      .then((data) => {
        // no live "airing" data source yet -- highest rated stands in for now
        const sorted = [...data].sort((a, b) => b.avg_rating - a.avg_rating).slice(0, 5)
        setShows(sorted)
      })
      .catch((error) => console.error("Failed to fetch shows:", error))
  }, [])

  return (
    <div style={{ width: "260px", flexShrink: 0 }}>
      <h2 style={{ fontSize: "16px", marginBottom: "14px" }}>Top Rated</h2>
      {shows.map((show, i) => (
        <div
          key={show.id}
          onClick={() => navigate(`/show/${show.id}`)}
          style={{ display: "flex", gap: "10px", marginBottom: "12px", cursor: "pointer" }}
        >
          <img
            src={show.poster_url}
            alt={show.title}
            style={{ width: "48px", height: "64px", objectFit: "cover", borderRadius: "6px" }}
          />
          <div>
            <p style={{ fontSize: "13px", lineHeight: "1.3" }}>{i + 1}. {show.title}</p>
            <p style={{ fontSize: "12px", color: "#9aa0aa" }}>★ {show.avg_rating}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default TopAiringSidebar