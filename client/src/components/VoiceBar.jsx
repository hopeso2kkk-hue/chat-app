import { useState } from 'react'

export default function VoiceBar({
  active,
  members,
  streams,
  muted,
  settings,
  screenActive,
  screenQuality,
  me,
  onToggleMute,
  onStartScreen,
  onStopScreen,
  onSetScreenQuality,
  onLeave,
  onSetSuppression,
  onToggleSetting,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [screenOpen, setScreenOpen] = useState(false)
  const QUALITIES = ['480p', '720p', '1080p', '1440p']
  const screenStreams = Object.entries(streams).filter(([, s]) =>
    s.getVideoTracks().some((t) => t.readyState === 'live')
  )

  return (
    <>
      {screenStreams.length > 0 && (
        <div className="screen-share-area">
          {screenStreams.map(([peerId, stream]) => (
            <div key={peerId} className="screen-share-tile">
              <video
                className="screen-share-video"
                autoPlay
                playsInline
                muted
                ref={(el) => {
                  if (el && el.srcObject !== stream) {
                    el.srcObject = stream
                    el.play().catch(() => {})
                  }
                }}
                onClick={(e) => {
                  const tile = e.currentTarget.closest('.screen-share-tile')
                  if (document.fullscreenElement) document.exitFullscreen()
                  else tile?.requestFullscreen?.()
                }}
              />
              <button
                className="screen-share-fullscreen"
                title="Tela cheia"
                onClick={(e) => {
                  const tile = e.currentTarget.closest('.screen-share-tile')
                  if (document.fullscreenElement) document.exitFullscreen()
                  else tile?.requestFullscreen?.()
                }}
              >
                ⛶
              </button>
            </div>
          ))}
        </div>
      )}
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
                <span className="avatar small">{m.name.charAt(0).toUpperCase()}</span>
                <span className="voice-member-name">{m.name}</span>
                {m.id === me?.id && <span className="voice-member-you">(você)</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="voice-bar-controls">
          <button
            className={`call-btn round ${settingsOpen ? 'on' : ''}`}
            onClick={() => setSettingsOpen((v) => !v)}
            title="Opções de voz"
          >
            ⚙️
          </button>
          <button
            className={`call-btn round ${muted ? 'off' : ''}`}
            onClick={onToggleMute}
            title={muted ? 'Ativar microfone' : 'Silenciar'}
          >
            {muted ? '🎙️ mudo' : '🎙️'}
          </button>
          <button
            className={`call-btn round ${screenActive ? 'on' : ''}`}
            onClick={() => setScreenOpen((v) => !v)}
            title={screenActive ? 'Transmissão de tela (clique para opções)' : 'Transmitir tela'}
          >
            🖥️
          </button>
          <button className="call-btn round hangup" onClick={onLeave} title="Sair do canal de voz">
            📞
          </button>
        </div>
        {screenOpen && (
          <div className="screen-quality-menu">
            <div className="screen-quality-title">
              {screenActive ? 'Qualidade da transmissão' : 'Qualidade para transmitir'}
            </div>
            {QUALITIES.map((q) => (
              <button
                key={q}
                className={`screen-quality-option ${screenQuality === q ? 'active' : ''}`}
                onClick={() => {
                  if (screenActive) onSetScreenQuality(q)
                  else onStartScreen(q)
                  setScreenOpen(false)
                }}
              >
                {q}
              </button>
            ))}
            {screenActive && (
              <button
                className="screen-quality-stop"
                onClick={() => {
                  onStopScreen()
                  setScreenOpen(false)
                }}
              >
                Parar transmissão
              </button>
            )}
          </div>
        )}
        {settingsOpen && (
          <div className="voice-settings">
            <div className="voice-settings-title">Opções de voz</div>
            <label className="voice-setting-row">
              <span>Supressão de ruído</span>
              <select value={settings.suppression} onChange={(e) => onSetSuppression(e.target.value)}>
                <option value="krisp">Krisp (IA)</option>
                <option value="standard">Padrão</option>
                <option value="off">Desligado</option>
              </select>
            </label>
            <label className="voice-setting-row">
              <span>Cancelamento de eco</span>
              <input
                type="checkbox"
                checked={settings.echoCancellation}
                onChange={() => onToggleSetting('echoCancellation')}
              />
            </label>
            <label className="voice-setting-row">
              <span>Controle automático de ganho</span>
              <input
                type="checkbox"
                checked={settings.autoGainControl}
                onChange={() => onToggleSetting('autoGainControl')}
              />
            </label>
          </div>
        )}
      </div>
    </>
  )
}
