import { useState } from 'react'

export default function ServerPanel({
  server,
  selectedChannelId,
  voiceChannelId,
  me,
  onSelectChannel,
  onJoinVoice,
  onLeaveVoice,
  onLeaveServer,
}) {
  const [textOpen, setTextOpen] = useState(true)
  const [voiceOpen, setVoiceOpen] = useState(true)

  const textChannels = server.channels.filter((c) => c.type === 'text')
  const voiceChannels = server.channels.filter((c) => c.type === 'voice')

  return (
    <aside className="server-panel">
      <div className="server-panel-header">{server.name}</div>
      <div className="server-panel-body">
        <div className="channel-group">
          <button className="channel-group-title" onClick={() => setTextOpen((v) => !v)}>
            {textOpen ? '▾' : '▸'} Canais de texto
          </button>
          {textOpen &&
            textChannels.map((c) => (
              <button
                key={c.id}
                className={`channel-item ${selectedChannelId === c.id ? 'active' : ''}`}
                onClick={() => onSelectChannel(c.id)}
              >
                <span className="channel-hash">#</span> {c.name}
              </button>
            ))}
        </div>
        <div className="channel-group">
          <button className="channel-group-title" onClick={() => setVoiceOpen((v) => !v)}>
            {voiceOpen ? '▾' : '▸'} Canais de voz
          </button>
          {voiceOpen &&
            voiceChannels.map((c) => {
              const joined = voiceChannelId === c.id
              return (
                <button
                  key={c.id}
                  className={`channel-item voice ${joined ? 'active' : ''}`}
                  onClick={() => (joined ? onLeaveVoice() : onJoinVoice(c.id))}
                >
                  <span className="channel-hash">{joined ? '🔊' : '🔈'}</span> {c.name}
                </button>
              )
            })}
        </div>
      </div>
      <div className="server-panel-footer">
        <span className="server-members">{server.members.length} membro(s) online</span>
        {server.ownerId === me.id && <span className="server-owner-badge">👑 Dono</span>}
        <button className="server-leave-btn" onClick={onLeaveServer}>
          Sair do servidor
        </button>
      </div>
    </aside>
  )
}
