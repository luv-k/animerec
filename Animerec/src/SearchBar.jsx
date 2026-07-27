import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

function SearchBar() {
  const [value, setValue] = useState("")
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const navigate = useNavigate()
  const containerRef = useRef(null)

  // debounced live suggestions as you type
  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([])
      return
    }
    const timeoutId = setTimeout(() => {
      fetch(`http://localhost:8000/shows?search=${encodeURIComponent(value)}`)
        .then((res) => res.json())
        .then((data) => setSuggestions(data.slice(0, 6)))
        .catch(() => setSuggestions([]))
    }, 250)
    return () => clearTimeout(timeoutId)
  }, [value])

  // close the dropdown if you click anywhere outside it
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function goToResultsPage() {
    if (!value.trim()) return
    setShowDropdown(false)
    navigate(`/search?q=${encodeURIComponent(value)}`)
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") goToResultsPage()
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "360px" }}>
      <input
        type="text"
        placeholder="Search shows..."
        value={value}
        onChange={(e) => { setValue(e.target.value); setShowDropdown(true) }}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        style={{
          padding: "9px 14px",
          borderRadius: "20px",
          border: "1px solid #333",
          background: "#1c1f26",
          color: "#e8e8e8",
          fontSize: "14px",
          width: "100%",
          outline: "none",
        }}
      />

      {showDropdown && suggestions.length > 0 && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          right: 0,
          background: "#1c1f26",
          border: "1px solid #333",
          borderRadius: "10px",
          overflow: "hidden",
          zIndex: 20,
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        }}>
          {suggestions.map((show) => (
            <div
              key={show.id}
              onClick={() => { setShowDropdown(false); setValue(""); navigate(`/show/${show.id}`) }}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "8px 12px", cursor: "pointer",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#24282f"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <img src={show.poster_url} alt={show.title} style={{ width: "32px", height: "44px", objectFit: "cover", borderRadius: "4px" }} />
              <div>
                <p style={{ fontSize: "13px" }}>{show.title}</p>
                <p style={{ fontSize: "11px", color: "#9aa0aa" }}>{show.genres?.[0]}</p>
              </div>
            </div>
          ))}
          <div
            onClick={goToResultsPage}
            style={{ padding: "10px 12px", fontSize: "12px", color: "#9aa0aa", cursor: "pointer", borderTop: "1px solid #333" }}
          >
            See all results for "{value}" →
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchBar