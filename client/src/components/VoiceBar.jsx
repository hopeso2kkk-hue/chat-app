export default function VoiceBar({ active, members, streams, muted, onToggleMute, onLeave }) {
  return (
    <div className="voice-bar">
      {Object.entries(streams).map(([peerId, stream]) => (
        <audio
          key={peerId}
          className="voice-audio-hidden"
          autoPlay
          ref={(el) => {
            if (el && el.srcObject !== stream) {
              el.srcObject = stream
              el.play().catch(() => {})
            }
          }}
        />
      ))}
      <div className="voice-bar-info">
        <div className="voice-bar-title">
          <span className="voice-live-dot" /> Conectado a {active.channelName}
        </div>
        <div className="voice-bar-members">
          {members.map((m) => (
            <span key={m.id} className="voice-member">
              {m.name}
            </span>
          ))}
        </div>
      </div>
      <div className="voice-bar-controls">
        <button
          className={`call-btn round ${muted ? 'off' : ''}`}
          onClick={onToggleMute}
          title={muted ? 'Ativar microfone' : 'Silenciar'}
        >
          {muted ? '🎙️ mudo' : '🎙️'}
        </button>
        <button className="call-btn round hangup" onClick={onLeave} title="Sair do canal de voz">
          📞
        </button>
      </div>
    </div>
  )
}
