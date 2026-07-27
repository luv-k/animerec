import { useState, useEffect } from 'react'

function CommentsSection({ showId }) {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState("")
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    loadComments()
  }, [showId])

  function loadComments() {
    fetch(`http://localhost:8000/shows/${showId}/comments`)
      .then((res) => res.json())
      .then((data) => setComments(data))
      .catch((error) => console.error("Failed to load comments:", error))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!newComment.trim()) return

    setPosting(true)
    fetch(`http://localhost:8000/shows/${showId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ body: newComment }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to post comment")
        setNewComment("")
        loadComments()
      })
      .catch((error) => console.error(error))
      .finally(() => setPosting(false))
  }

  function formatDate(isoString) {
    const date = new Date(isoString)
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  return (
    <div style={{ marginTop: "32px", maxWidth: "600px" }}>
      <h2 style={{ marginBottom: "14px" }}>Comments</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts..."
          rows={3}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #333",
            background: "#1c1f26",
            color: "#e8e8e8",
            fontSize: "14px",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={posting || !newComment.trim()}
          style={{
            marginTop: "8px",
            background: "#e8e8e8",
            color: "#0f1115",
            border: "none",
            padding: "8px 18px",
            borderRadius: "6px",
            fontWeight: "bold",
            fontSize: "13px",
            cursor: posting ? "default" : "pointer",
            opacity: posting || !newComment.trim() ? 0.6 : 1,
          }}
        >
          {posting ? "Posting..." : "Post Comment"}
        </button>
      </form>

      {comments.length === 0 ? (
        <p style={{ color: "#9aa0aa", fontSize: "14px" }}>No comments yet — be the first.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {comments.map((c) => (
            <div key={c.id} style={{ background: "#1c1f26", padding: "12px 14px", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontWeight: "bold", fontSize: "13px" }}>{c.username}</span>
                <span style={{ fontSize: "12px", color: "#9aa0aa" }}>{formatDate(c.created_at)}</span>
              </div>
              <p style={{ fontSize: "14px", lineHeight: "1.4" }}>{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CommentsSection