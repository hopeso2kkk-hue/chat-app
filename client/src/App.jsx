import { useEffect, useRef, useState } from 'react'
import { socket } from './lib/socket'
import { useWebRTC } from './hooks/useWebRTC'
import Login from './components/Login'
import DMList from './components/DMList'
import ChatWindow from './components/ChatWindow'
import CallOverlay from './components/CallOverlay'

export default function App() {
  const [me, setMe] = useState(null)
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState({})
  const meRef = useRef(null)
  const myNameRef = useRef(null)
  const call = useWebRTC()

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

    return () => {
      socket.off('connect')
      socket.off('user:login-ok')
      socket.off('users:update')
      socket.off('message:receive')
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

  if (!me) {
    return <Login onLogin={login} />
  }

  const peer = users.find((u) => u.id === selected)
  const incomingPeer = call.incoming ? users.find((u) => u.id === call.incoming.from) : null

  return (
    <div className="app">
      <DMList users={users} me={me} selected={selected} onSelect={setSelected} />
      <ChatWindow
        peer={peer}
        me={me}
        messages={selected ? messages[selected] || [] : []}
        onSend={handleSend}
        onCall={call.startCall}
      />
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
