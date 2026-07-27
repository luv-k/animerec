function ShowCardSkeleton() {
  return (
    <div style={{ width: "180px" }}>
      <div style={{
        width: "100%",
        height: "250px",
        borderRadius: "10px",
        background: "linear-gradient(90deg, #1c1f26 25%, #24282f 50%, #1c1f26 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s ease infinite",
      }} />
      <div style={{
        width: "70%", height: "12px", marginTop: "10px", borderRadius: "4px",
        background: "#1c1f26",
      }} />
    </div>
  )
}

export function SkeletonRow({ count = 6 }) {
  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
      {Array.from({ length: count }).map((_, i) => (
        <ShowCardSkeleton key={i} />
      ))}
    </div>
  )
}

export default ShowCardSkeleton