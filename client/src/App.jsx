import { useEffect, useRef, useState } from 'react'
import { socket } from './lib/socket'
import { useWebRTC } from './hooks/useWebRTC'
import { useVoiceChannel } from './hooks/useVoiceChannel'
import Login from './components/Login'
import ServerBar from './components/ServerBar'
import ServerPanel from './components/ServerPanel'
import ServerChat from './components/ServerChat'
import CreateServerModal from './components/CreateServerModal'
import VoiceBar from './components/VoiceBar'
import DMList from './components/DMList'
import ChatWindow from './components/ChatWindow'
import CallOverlay from './components/CallOverlay'

export default function App() {
  const [me, setMe] = useState(null)
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState({})
  const [servers, setServers] = useState([])
  const [selectedServerId, setSelectedServerId] = useState(null)
  const [selectedChannelId, setSelectedChannelId] = useState(null)
  const [serverMessages, setServerMessages] = useState({})
  const [showCreate, setShowCreate] = useState(false)
  const [voiceRooms, setVoiceRooms] = useState([])
  const meRef = useRef(null)
  const myNameRef = useRef(null)
  const call = useWebRTC()
  const voice = useVoiceChannel()

  function login(name) {
    myNameRef.current = name
    localStorage.setItem('chatName', name)
    socket.emit('user:login', name)
  }

  useEffect(() => {
    const saved = localStorage.getItem('chatName')
    if (saved) {
      myNameRef.current = saved
      socket.emit('user:login', saved)
    }
  }, [])

  useEffect(() => {
    socket.on('connect', () => {
      if (myNameRef.current) socket.emit('user:login', myNameRef.current)
    })

    socket.on('user:login-ok', (user) => {
      setMe(user)
      meRef.current = user
    })

    socket.on('users:update', (list) => setUsers(list))

    socket.on('message:receive', (msg) => {
      setMessages((prev) => {
        const key = msg.from === meRef.current?.id ? msg.to : msg.from
        return { ...prev, [key]: [...(prev[key] || []), msg] }
      })
    })

    socket.on('servers:update', (list) => setServers(list))

    socket.on('server:created', (server) => {
      setSelectedServerId(server.id)
      setSelectedChannelId(server.channels.find((c) => c.type === 'text')?.id ?? null)
    })

    socket.on('server:members-update', ({ serverId, members }) => {
      setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, members } : s)))
    })

    socket.on('server:message', (msg) => {
      setServerMessages((prev) => ({
        ...prev,
        [msg.channelId]: [...(prev[msg.channelId] || []), msg],
      }))
    })

    socket.on('voice:rooms', (rooms) => setVoiceRooms(rooms))

    return () => {
      socket.off('connect')
      socket.off('user:login-ok')
      socket.off('users:update')
      socket.off('message:receive')
      socket.off('servers:update')
      socket.off('server:created')
      socket.off('server:members-update')
      socket.off('server:message')
      socket.off('voice:rooms')
    }
  }, [])

  function handleSend(to, payload) {
    const msg = {
      from: me.id,
      to,
      type: payload.type || 'text',
      text: payload.text || null,
      audio: payload.audio || null,
      time: Date.now(),
    }
    socket.emit('message:send', { to, type: msg.type, text: msg.text, audio: msg.audio })
    setMessages((prev) => ({ ...prev, [to]: [...(prev[to] || []), msg] }))
  }

  function createServer(name) {
    socket.emit('server:create', name)
    setShowCreate(false)
  }

  function selectServer(id) {
    socket.emit('server:join', id)
    setSelectedServerId(id)
    setSelectedChannelId(null)
  }

  function selectDM() {
    setSelectedServerId(null)
    setSelectedChannelId(null)
  }

  function leaveServer() {
    if (!selectedServerId) return
    socket.emit('server:leave', selectedServerId)
    if (voice.active?.serverId === selectedServerId) voice.leave()
    setSelectedServerId(null)
    setSelectedChannelId(null)
  }

  function joinVoice(channelId) {
    const server = servers.find((s) => s.id === selectedServerId)
    const ch = server?.channels.find((c) => c.id === channelId)
    if (server && ch) voice.join(server.id, channelId, ch.name)
  }

  function sendServerMessage(text) {
    socket.emit('server:message', { serverId: selectedServerId, channelId: selectedChannelId, text })
  }

  if (!me) {
    return <Login onLogin={login} />
  }

  const server = servers.find((s) => s.id === selectedServerId)
  const activeChannel = server?.channels.find((c) => c.id === selectedChannelId)
  const peer = users.find((u) => u.id === selected)
  const incomingPeer = call.incoming ? users.find((u) => u.id === call.incoming.from) : null

  return (
    <div className="app">
      <ServerBar
        servers={servers}
        selectedServerId={selectedServerId}
        onSelectDM={selectDM}
        onSelectServer={selectServer}
        onCreateServer={() => setShowCreate(true)}
      />
      {server ? (
        <>
          <ServerPanel
            server={server}
            selectedChannelId={selectedChannelId}
            voiceChannelId={voice.active?.channelId ?? null}
            voiceRooms={voiceRooms}
            me={me}
            onSelectChannel={setSelectedChannelId}
            onJoinVoice={joinVoice}
            onLeaveVoice={voice.leave}
            onLeaveServer={leaveServer}
          />
          {activeChannel ? (
            <ServerChat
              server={server}
              channel={activeChannel}
              me={me}
              users={users}
              messages={serverMessages[activeChannel.id] || []}
              onSend={sendServerMessage}
            />
          ) : (
            <div className="chat chat-placeholder">
              <div className="chat-placeholder-title">{server.name}</div>
              <div className="chat-placeholder-sub">Escolha um canal de texto para conversar.</div>
            </div>
          )}
        </>
      ) : (
        <>
          <DMList users={users} me={me} selected={selected} onSelect={setSelected} />
          <ChatWindow
            peer={peer}
            me={me}
            messages={selected ? messages[selected] || [] : []}
            onSend={handleSend}
            onCall={call.startCall}
          />
        </>
      )}
      {voice.active && !call.inCall && (
        <VoiceBar
          active={voice.active}
          members={voice.members}
          streams={voice.streams}
          muted={voice.muted}
          settings={voice.settings}
          screenActive={voice.screenActive}
          screenQuality={voice.screenQuality}
          me={me}
          onToggleMute={voice.toggleMute}
          onStartScreen={voice.startScreen}
          onStopScreen={voice.stopScreen}
          onSetScreenQuality={voice.setScreenQuality}
          onLeave={voice.leave}
          onSetSuppression={voice.setSuppression}
          onToggleSetting={voice.toggleSetting}
        />
      )}
      {showCreate && <CreateServerModal onClose={() => setShowCreate(false)} onCreate={createServer} />}
      <CallOverlay
        peerName={incomingPeer?.name || peer?.name || '...'}
        incoming={incomingPeer}
        inCall={call.inCall}
        remoteStream={call.remoteStream}
        muted={call.muted}
        screenActive={call.screenActive}
        onAnswer={call.answerCall}
        onDecline={call.declineCall}
        onEnd={call.endCall}
        onToggleMute={call.toggleMute}
        onToggleScreen={call.toggleScreen}
      />
    </div>
  )
}
