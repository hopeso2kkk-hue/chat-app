import { useState } from 'react'

export default function Login({ onLogin }) {
  const [name, setName] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onLogin(trimmed)
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Chat</h1>
        <p className="login-hint">Qual é o seu nome?</p>
        <input
          className="login-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: Ana"
          maxLength={20}
          autoFocus
        />
        <button className="btn-primary" type="submit">
          Entrar
        </button>
      </form>
    </div>
  )
}
