function GenrePills({ genres, selected, onSelect }) {
  return (
    <div style={{ display: "flex", gap: "8px", overflowX: "auto", padding: "16px 0" }}>
      <button
        onClick={() => onSelect(null)}
        style={{
          padding: "8px 16px",
          borderRadius: "20px",
          border: "none",
          background: selected === null ? "#e8e8e8" : "#1c1f26",
          color: selected === null ? "#0f1115" : "#e8e8e8",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        All
      </button>
      {genres.map((genre) => (
        <button
          key={genre}
          onClick={() => onSelect(genre)}
          style={{
            padding: "8px 16px",
            borderRadius: "20px",
            border: "none",
            background: selected === genre ? "#e8e8e8" : "#1c1f26",
            color: selected === genre ? "#0f1115" : "#e8e8e8",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {genre}
        </button>
      ))}
    </div>
  )
}

export default GenrePills
