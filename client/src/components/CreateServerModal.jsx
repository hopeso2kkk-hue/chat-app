import { useState } from 'react'

export default function CreateServerModal({ onClose, onCreate }) {
  const [name, setName] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onCreate(trimmed)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Criar servidor</h2>
        <p className="login-hint">O servidor já vem com um canal de texto e um canal de voz.</p>
        <input
          className="login-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do servidor"
          maxLength={30}
          autoFocus
        />
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary">
            Criar
          </button>
        </div>
      </form>
    </div>
  )
}
