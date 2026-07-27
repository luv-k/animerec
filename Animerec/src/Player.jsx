import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

function Player() {
  const { id } = useParams() // episode_id
  const navigate = useNavigate()
  const [episode, setEpisode] = useState(null) // basic episode + show_id/show_title
  const [show, setShow] = useState(null)        // full show detail, incl. episode list
  const [similar, setSimilar] = useState([])
  const [resumeAt, setResumeAt] = useState(0)
  const videoRef = useRef(null)
  const lastSavedRef = useRef(0)

  useEffect(() => {
    fetch(`http://localhost:8000/episodes/${id}`)
      .then((res) => res.json())
      .then((epData) => {
        setEpisode(epData)
        return fetch(`http://localhost:8000/shows/${epData.show_id}`)
      })
      .then((res) => res.json())
      .then((showData) => {
        setShow(showData)
        return fetch(`http://localhost:8000/shows/${showData.id}/similar`)
      })
      .then((res) => res.json())
      .then((simData) => setSimilar(simData))
      .catch((error) => console.error("Failed to load watch page:", error))

    fetch("http://localhost:8000/watch-history", { credentials: "include" })
      .then((res) => res.json())
      .then((history) => {
        const existing = history.find((h) => h.episode_id === Number(id))
        if (existing) setResumeAt(existing.position_seconds)
      })
      .catch(() => {})
  }, [id])

  function handleLoadedMetadata() {
    if (resumeAt > 0 && videoRef.current) {
      videoRef.current.currentTime = resumeAt
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current
    if (!video) return
    if (video.currentTime - lastSavedRef.current < 5) return
    lastSavedRef.current = video.currentTime

    fetch("http://localhost:8000/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        episode_id: Number(id),
        position_seconds: video.currentTime,
        duration_seconds: video.duration || null,
      }),
    }).catch((error) => console.error("Failed to save progress:", error))
  }

  if (!episode || !show) return <p style={{ padding: "24px" }}>Loading...</p>

  return (
    <div style={{ padding: "20px 24px" }}>
      <button
        onClick={() => navigate(`/show/${show.id}`)}
        style={{ marginBottom: "16px", background: "none", border: "1px solid #333", color: "#e8e8e8", padding: "6px 14px", borderRadius: "6px", cursor: "pointer" }}
      >
        ← Back to show
      </button>

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
        {/* Main column: player + episode info + show metadata */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <video
            ref={videoRef}
            controls
            autoPlay
            width="100%"
            style={{ borderRadius: "10px", background: "#000", display: "block" }}
            src={`http://localhost:8000/stream/${id}`}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
          >
            Your browser doesn't support video playback.
          </video>

          {/* Episode info row */}
          <div style={{ marginTop: "16px", paddingBottom: "16px", borderBottom: "1px solid #1c1f26" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "6px" }}>
              {episode.episode_number}. {episode.title || `Episode ${episode.episode_number}`}
            </h2>
            {show.synopsis && (
              <p style={{ fontSize: "13px", color: "#9aa0aa", lineHeight: "1.5", maxWidth: "700px" }}>
                {show.synopsis}
              </p>
            )}
          </div>

          {/* Show metadata block */}
          <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
            <img
              src={show.poster_url}
              alt={show.title}
              style={{ width: "140px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }}
            />
            <div>
              <h1
                onClick={() => navigate(`/show/${show.id}`)}
                style={{ fontSize: "22px", marginBottom: "8px", cursor: "pointer" }}
              >
                {show.title}
              </h1>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                {show.genres.map((g) => (
                  <span key={g} style={{ fontSize: "12px", background: "#1c1f26", padding: "4px 10px", borderRadius: "12px" }}>{g}</span>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "6px 24px", fontSize: "13px" }}>
                {show.status && <div><span style={{ color: "#9aa0aa" }}>Status: </span>{show.status.replace(/_/g, " ")}</div>}
                {show.total_episodes && <div><span style={{ color: "#9aa0aa" }}>Episodes: </span>{show.total_episodes}</div>}
                {show.start_date && <div><span style={{ color: "#9aa0aa" }}>Start Date: </span>{show.start_date}</div>}
                {show.end_date && <div><span style={{ color: "#9aa0aa" }}>End Date: </span>{show.end_date}</div>}
                <div><span style={{ color: "#9aa0aa" }}>Rating: </span>★ {show.avg_rating}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: episode list + recommendations */}
        <div style={{ width: "300px", flexShrink: 0 }}>
          <h3 style={{ fontSize: "15px", marginBottom: "10px" }}>Episodes</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "320px", overflowY: "auto", marginBottom: "24px" }}>
            {show.episodes.map((ep) => (
              <div
                key={ep.id}
                onClick={() => ep.watchable && navigate(`/watch/${ep.id}`)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: ep.id === episode.id ? "#2a2f3a" : "#1c1f26",
                  padding: "10px 12px", borderRadius: "6px",
                  cursor: ep.watchable ? "pointer" : "not-allowed",
                  opacity: ep.watchable ? 1 : 0.5,
                  border: ep.id === episode.id ? "1px solid #4a5264" : "1px solid transparent",
                }}
              >
                <span style={{ fontSize: "13px" }}>EP {ep.episode_number}</span>
                {ep.id === episode.id && <span style={{ fontSize: "11px", color: "#9aa0aa" }}>Now Playing</span>}
              </div>
            ))}
          </div>

          {similar.length > 0 && (
            <>
              <h3 style={{ fontSize: "15px", marginBottom: "10px" }}>Recommendations</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {similar.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/show/${s.id}`)}
                    style={{ display: "flex", gap: "10px", cursor: "pointer" }}
                  >
                    <img src={s.poster_url} alt={s.title} style={{ width: "48px", height: "64px", objectFit: "cover", borderRadius: "6px" }} />
                    <div>
                      <p style={{ fontSize: "13px", lineHeight: "1.3" }}>{s.title}</p>
                      <p style={{ fontSize: "12px", color: "#9aa0aa" }}>★ {s.avg_rating}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Player