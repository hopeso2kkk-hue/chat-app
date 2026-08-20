import { useEffect, useRef, useState } from 'react'

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms) {
  const total = Math.floor(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function ChatWindow({ peer, me, messages, onSend, onCall }) {
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const bottomRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const startTimeRef = useRef(0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, peer?.id])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(peer.id, { type: 'text', text: trimmed })
    setText('')
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    chunksRef.current = []
    const recorder = new MediaRecorder(stream)
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = sendAudio
    recorder.start()
    recorderRef.current = recorder
    startTimeRef.current = Date.now()
    setElapsed(0)
    setRecording(true)
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current)
    }, 500)
  }

  function stopRecording() {
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    clearInterval(timerRef.current)
    setRecording(false)
  }

  function sendAudio() {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      if (base64) onSend(peer.id, { type: 'audio', audio: base64 })
    }
    reader.readAsDataURL(blob)
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
                  {m.type === 'audio' ? (
                    <audio className="msg-audio" controls src={`data:audio/webm;base64,${m.audio}`} />
                  ) : (
                    <span className="msg-text">{m.text}</span>
                  )}
                  <span className="msg-time">{formatTime(m.time)}</span>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <form className="chat-input-wrap" onSubmit={handleSubmit}>
            <div className="chat-input-row">
              {recording ? (
                <>
                  <span className="rec-timer">🔴 {formatDuration(elapsed)}</span>
                  <button type="button" className="mic-btn recording" onClick={stopRecording} title="Parar e enviar">
                    ⏹
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="mic-btn"
                    onClick={startRecording}
                    title="Gravar mensagem de áudio"
                  >
                    🎤
                  </button>
                  <input
                    className="chat-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`Enviar mensagem para ${peer.name}`}
                    maxLength={1000}
                  />
                </>
              )}
            </div>
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
