import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetch("http://localhost:8000/profile", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setProfile(data))
      .catch((error) => console.error("Failed to fetch profile:", error))
  }, [])

  if (!profile) return <p style={{ padding: "24px" }}>Loading...</p>

  return (
    <div style={{ padding: "24px", maxWidth: "700px" }}>
      <button
        onClick={() => navigate("/")}
        style={{ marginBottom: "20px", background: "none", border: "1px solid #333", color: "#e8e8e8", padding: "6px 14px", borderRadius: "6px", cursor: "pointer" }}
      >
        ← Back
      </button>

      <h1 style={{ marginBottom: "20px" }}>{profile.username}</h1>

      <div style={{ display: "flex", gap: "24px", marginBottom: "28px" }}>
        <div style={{ background: "#1c1f26", padding: "16px 20px", borderRadius: "10px" }}>
          <p style={{ fontSize: "24px", fontWeight: 700 }}>{profile.rated_shows.length}</p>
          <p style={{ fontSize: "13px", color: "#9aa0aa" }}>Shows rated</p>
        </div>
        <div style={{ background: "#1c1f26", padding: "16px 20px", borderRadius: "10px" }}>
          <p style={{ fontSize: "24px", fontWeight: 700 }}>{profile.shows_completed}</p>
          <p style={{ fontSize: "13px", color: "#9aa0aa" }}>Completed</p>
        </div>
        <div style={{ background: "#1c1f26", padding: "16px 20px", borderRadius: "10px" }}>
          <p style={{ fontSize: "24px", fontWeight: 700 }}>{profile.shows_in_progress}</p>
          <p style={{ fontSize: "13px", color: "#9aa0aa" }}>In progress</p>
        </div>
      </div>

      <h2 style={{ marginBottom: "14px" }}>Your ratings</h2>
      {profile.rated_shows.length === 0 ? (
        <p style={{ color: "#9aa0aa" }}>You haven't rated anything yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {profile.rated_shows.map((show) => (
            <div
              key={show.show_id}
              onClick={() => navigate(`/show/${show.show_id}`)}
              style={{ display: "flex", alignItems: "center", gap: "14px", background: "#1c1f26", padding: "10px", borderRadius: "8px", cursor: "pointer" }}
            >
              <img src={show.poster_url} alt={show.title} style={{ width: "44px", height: "60px", objectFit: "cover", borderRadius: "6px" }} />
              <span style={{ flex: 1 }}>{show.title}</span>
              <span style={{ color: "#e8e8e8", fontWeight: 600 }}>★ {show.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProfilePage