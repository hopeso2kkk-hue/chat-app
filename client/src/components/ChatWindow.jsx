import { useEffect, useRef, useState } from 'react'

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChatWindow({ peer, me, messages, onSend, onCall }) {
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, peer?.id])

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(peer.id, trimmed)
    setText('')
  }

  return (
    <main className="chat">
      {peer ? (
        <>
          <header className="chat-header">
            <span className="chat-title">
              <span className="avatar small">{peer.name.charAt(0).toUpperCase()}</span>
              {peer.name}
            </span>
            <button className="call-btn call-start" onClick={() => onCall(peer.id)}>
              📞
            </button>
          </header>

          <div className="chat-messages">
            {messages.map((m, i) => {
              const mine = m.from === me.id
              return (
                <div key={i} className={`msg ${mine ? 'mine' : ''}`}>
                  <span className="msg-author">{mine ? 'Você' : peer.name}</span>
                  <span className="msg-text">{m.text}</span>
                  <span className="msg-time">{formatTime(m.time)}</span>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <form className="chat-input-wrap" onSubmit={handleSubmit}>
            <input
              className="chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Enviar mensagem para ${peer.name}`}
              maxLength={1000}
            />
          </form>
        </>
      ) : (
        <div className="chat-placeholder">
          <div className="chat-placeholder-title">Selecione uma conversa</div>
          <div className="chat-placeholder-sub">Clique em alguém na lista ao lado para começar a conversar.</div>
        </div>
      )}
    </main>
  )
}
