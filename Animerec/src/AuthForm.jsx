import { useState } from 'react'

function AuthForm({ onLoginSuccess }) {
  const [mode, setMode] = useState("login") // "login" | "register"
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (mode === "register") {
        const registerRes = await fetch("http://localhost:8000/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        })
        if (!registerRes.ok) {
          const data = await registerRes.json()
          throw new Error(data.detail || "Registration failed")
        }
      }

      const loginRes = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      })
      if (!loginRes.ok) {
        throw new Error("Incorrect username or password")
      }
      onLoginSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0f1115",
    }}>
      <div style={{
        width: "360px",
        background: "#1c1f26",
        borderRadius: "14px",
        padding: "32px",
      }}>
        <h1 style={{ fontSize: "22px", marginBottom: "6px", textAlign: "center" }}>
          ANIMEREC
        </h1>
        <p style={{ fontSize: "13px", color: "#9aa0aa", textAlign: "center", marginBottom: "24px" }}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </p>

        <form onSubmit={handleSubmit}>
          <label style={fieldLabelStyle}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            required
          />

          <label style={fieldLabelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            required
            minLength={8}
          />

          {error && (
            <p style={{ color: "#ff6b6b", fontSize: "13px", marginTop: "10px" }}>{error}</p>
          )}

          <button type="submit" disabled={loading} style={submitButtonStyle}>
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p style={{ fontSize: "13px", color: "#9aa0aa", textAlign: "center", marginTop: "18px" }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <span
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError("") }}
            style={{ color: "#e8e8e8", cursor: "pointer", fontWeight: "bold" }}
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </span>
        </p>
      </div>
    </div>
  )
}

const fieldLabelStyle = {
  display: "block",
  fontSize: "13px",
  color: "#9aa0aa",
  marginBottom: "6px",
  marginTop: "14px",
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #333",
  background: "#0f1115",
  color: "#e8e8e8",
  fontSize: "14px",
  outline: "none",
}

const submitButtonStyle = {
  width: "100%",
  marginTop: "22px",
  padding: "11px",
  borderRadius: "8px",
  border: "none",
  background: "#e8e8e8",
  color: "#0f1115",
  fontWeight: "bold",
  fontSize: "14px",
  cursor: "pointer",
}

export default AuthForm