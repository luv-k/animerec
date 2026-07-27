import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import ShowCard from './ShowCard'

function SearchResultsPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get("q") || ""
  const [results, setResults] = useState([])
  const [similar, setSimilar] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    fetch(`http://localhost:8000/shows?search=${encodeURIComponent(query)}`)
      .then((res) => res.json())
      .then((data) => {
        setResults(data)
        // base "you might also like" on the top match, if there is one
        if (data.length > 0) {
          fetch(`http://localhost:8000/shows/${data[0].id}/similar`)
            .then((res) => res.json())
            .then((simData) => setSimilar(simData))
            .catch(() => setSimilar([]))
        } else {
          setSimilar([])
        }
      })
      .catch((error) => console.error("Search failed:", error))
      .finally(() => setLoading(false))
  }, [query])

  return (
    <div style={{ padding: "24px" }}>
      <button
        onClick={() => navigate("/")}
        style={{ marginBottom: "20px", background: "none", border: "1px solid #333", color: "#e8e8e8", padding: "6px 14px", borderRadius: "6px", cursor: "pointer" }}
      >
        ← Back
      </button>

      <h1 style={{ marginBottom: "20px" }}>Results for "{query}"</h1>

      {loading ? (
        <p style={{ color: "#9aa0aa" }}>Searching...</p>
      ) : results.length === 0 ? (
        <p style={{ color: "#9aa0aa" }}>No shows matched your search.</p>
      ) : (
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "36px" }}>
          {results.map((show) => (
            <div key={show.id} onClick={() => navigate(`/show/${show.id}`)}>
              <ShowCard title={show.title} genres={show.genres} rating={show.avg_rating} posterUrl={show.poster_url} />
            </div>
          ))}
        </div>
      )}

      {similar.length > 0 && (
        <>
          <h2 style={{ marginBottom: "14px" }}>You might also like</h2>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {similar.map((show) => (
              <div key={show.id} onClick={() => navigate(`/show/${show.id}`)}>
                <ShowCard title={show.title} genres={show.genres} rating={show.avg_rating} posterUrl={show.poster_url} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default SearchResultsPage