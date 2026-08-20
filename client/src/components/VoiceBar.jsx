import { useState } from 'react'

export default function VoiceBar({
  active,
  members,
  streams,
  muted,
  settings,
  screenActive,
  onToggleMute,
  onToggleScreen,
  onLeave,
  onSetSuppression,
  onToggleSetting,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const screenStreams = Object.entries(streams).filter(([, s]) => s.getVideoTracks().length > 0)

  return (
    <>
      {screenStreams.length > 0 && (
        <div className="screen-share-area">
          {screenStreams.map(([peerId, stream]) => (
            <video
              key={peerId}
              className="screen-share-video"
              autoPlay
              playsInline
              ref={(el) => {
                if (el && el.srcObject !== stream) {
                  el.srcObject = stream
                  el.play().catch(() => {})
                }
              }}
            />
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
                {m.name}
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
            onClick={onToggleScreen}
            title={screenActive ? 'Parar de transmitir tela' : 'Transmitir tela'}
          >
            🖥️
          </button>
          <button className="call-btn round hangup" onClick={onLeave} title="Sair do canal de voz">
            📞
          </button>
        </div>
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
