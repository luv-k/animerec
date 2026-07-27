import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function WatchHistoryRow() {
  const [history, setHistory] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch("http://localhost:8000/watch-history", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setHistory(data))
      .catch((error) => console.error("Failed to fetch watch history:", error))
  }, [])

  if (history.length === 0) return null

  return (
    <div style={{ marginBottom: "24px" }}>
      <h2 style={{ fontSize: "18px", marginBottom: "14px" }}>Continue Watching</h2>
      <div style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "8px" }}>
        {history.map((item) => (
          <div
            key={item.episode_id}
            onClick={() => navigate(`/watch/${item.episode_id}`)}
            style={{ width: "180px", cursor: "pointer", flexShrink: 0 }}
          >
            <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden" }}>
              <img
                src={item.poster_url}
                alt={item.title}
                style={{ width: "100%", height: "250px", objectFit: "cover", display: "block" }}
              />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "4px", background: "rgba(255,255,255,0.2)" }}>
                <div style={{ width: `${item.progress_pct}%`, height: "100%", background: "#e8e8e8" }} />
              </div>
            </div>
            <p style={{ fontSize: "13px", marginTop: "8px" }}>{item.title}</p>
            <p style={{ fontSize: "12px", color: "#9aa0aa" }}>Episode {item.episode_number}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default WatchHistoryRow