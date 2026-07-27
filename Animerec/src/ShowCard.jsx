import { useState } from 'react'

function ShowCard({ title, genres, rating, posterUrl }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#1c1f26",
        borderRadius: "10px",
        overflow: "hidden",
        width: "180px",
        cursor: "pointer",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered ? "0 8px 20px rgba(0,0,0,0.4)" : "none",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
      }}
    >
      <div style={{ position: "relative" }}>
        <img
          src={posterUrl}
          alt={title}
          style={{ width: "100%", height: "250px", objectFit: "cover", display: "block" }}
        />
        {hovered && (
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent 50%)",
          }} />
        )}
      </div>
      <div style={{ padding: "10px" }}>
        <h3 style={{ fontSize: "14px", marginBottom: "6px", lineHeight: "1.3", fontWeight: 600 }}>
          {title}
        </h3>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#9aa0aa" }}>
          <span>{genres?.[0]}</span>
          <span>★ {rating}</span>
        </div>
      </div>
    </div>
  )
}

export default ShowCard