import { useEffect, useRef, useState } from 'react'

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ServerChat({ server, channel, me, users, messages, onSend }) {
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  function authorName(id) {
    if (id === me.id) return 'Você'
    const u = users.find((x) => x.id === id)
    return u ? u.name : 'Alguém'
  }

  return (
    <main className="chat">
      <header className="chat-header">
        <span className="chat-title">
          <span className="channel-hash">#</span>
          {channel.name}
          <span className="chat-server-name">· {server.name}</span>
        </span>
      </header>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.from === me.id ? 'mine' : ''}`}>
            <span className="msg-author">{authorName(m.from)}</span>
            <span className="msg-text">{m.text}</span>
            <span className="msg-time">{formatTime(m.time)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-wrap" onSubmit={handleSubmit}>
        <input
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Enviar em #${channel.name}`}
          maxLength={1000}
        />
      </form>
    </main>
  )
}
