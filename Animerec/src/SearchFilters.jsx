function SearchFilters({ genres, filters, onChange }) {
  function update(key, value) {
    onChange({ ...filters, [key]: value })
  }

  function clearAll() {
    onChange({ sourceType: "", genre: "", minRating: "", status: "", sort: "relevance" })
  }

  return (
    <div style={{ width: "220px", flexShrink: 0 }}>
      <h3 style={{ fontSize: "15px", marginBottom: "14px" }}>Filters</h3>

      <FilterGroup label="Type">
        <select value={filters.sourceType} onChange={(e) => update("sourceType", e.target.value)} style={selectStyle}>
          <option value="">All</option>
          <option value="anime">Anime</option>
          <option value="western_animation">Western Animation</option>
        </select>
      </FilterGroup>

      <FilterGroup label="Genre">
        <select value={filters.genre} onChange={(e) => update("genre", e.target.value)} style={selectStyle}>
          <option value="">All genres</option>
          {genres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup label="Minimum Rating">
        <select value={filters.minRating} onChange={(e) => update("minRating", e.target.value)} style={selectStyle}>
          <option value="">Any</option>
          <option value="9">9+</option>
          <option value="8">8+</option>
          <option value="7">7+</option>
          <option value="6">6+</option>
        </select>
      </FilterGroup>

      <FilterGroup label="Status">
        <select value={filters.status} onChange={(e) => update("status", e.target.value)} style={selectStyle}>
          <option value="">Any</option>
          <option value="FINISHED">Finished</option>
          <option value="RELEASING">Releasing</option>
          <option value="NOT_YET_RELEASED">Not yet released</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="HIATUS">Hiatus</option>
        </select>
      </FilterGroup>

      <FilterGroup label="Sort by">
        <select value={filters.sort} onChange={(e) => update("sort", e.target.value)} style={selectStyle}>
          <option value="relevance">Best match</option>
          <option value="rating_desc">Rating: High to Low</option>
          <option value="rating_asc">Rating: Low to High</option>
          <option value="title_asc">Title: A-Z</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </FilterGroup>

      <button onClick={clearAll} style={clearButtonStyle}>
        Clear filters
      </button>
    </div>
  )
}

function FilterGroup({ label, children }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontSize: "12px", color: "#9aa0aa", marginBottom: "6px" }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const selectStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "6px",
  border: "1px solid #333",
  background: "#1c1f26",
  color: "#e8e8e8",
  fontSize: "13px",
  outline: "none",
}

const clearButtonStyle = {
  marginTop: "4px",
  background: "none",
  border: "1px solid #333",
  color: "#9aa0aa",
  padding: "7px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "12px",
  width: "100%",
}

export default SearchFilters