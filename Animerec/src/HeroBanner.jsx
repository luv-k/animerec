import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function HeroBanner({ shows }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const navigate = useNavigate()

  // Advance to the next show every 5 seconds, looping back to 0 at the end.
  useEffect(() => {
    if (!shows || shows.length <= 1) return

    const intervalId = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % shows.length)
    }, 5000)

    // Cleanup: React runs this before the effect re-fires or the component
    // unmounts. Without it, every re-run of this effect would stack up
    // another interval running in the background -- a memory leak.
    return () => clearInterval(intervalId)
  }, [shows])

  if (!shows || shows.length === 0) return null
  const show = shows[currentIndex]

  return (
    <div style={{
      position: "relative",
      height: "560px",
      overflow: "hidden",
      backgroundImage: `url(${show.poster_url})`,
      backgroundSize: "cover",
      backgroundPosition: "center 15%",
      transition: "background-image 0.4s ease",
    }}>
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to top, #0f1115 8%, rgba(15,17,21,0.5) 45%, rgba(15,17,21,0.15) 75%, rgba(15,17,21,0.35) 100%)",
      }} />
      <div style={{ position: "absolute", bottom: "24px", left: "24px", right: "24px" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          {show.genres?.map((g) => (
            <span key={g} style={{ fontSize: "12px", background: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: "12px" }}>
              {g}
            </span>
          ))}
        </div>
        <h2 style={{ fontSize: "32px", marginBottom: "10px" }}>{show.title}</h2>
        <button
          onClick={() => navigate(`/show/${show.id}`)}
          style={{
            background: "#e8e8e8",
            color: "#0f1115",
            border: "none",
            padding: "10px 24px",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          ▶ Watch Now
        </button>
      </div>

      {/* dot indicators, also clickable to jump directly to a show */}
      <div style={{ position: "absolute", bottom: "24px", right: "24px", display: "flex", gap: "6px" }}>
        {shows.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            style={{
              width: "8px", height: "8px", borderRadius: "50%", border: "none",
              background: i === currentIndex ? "#e8e8e8" : "rgba(255,255,255,0.3)",
              cursor: "pointer", padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default HeroBanner