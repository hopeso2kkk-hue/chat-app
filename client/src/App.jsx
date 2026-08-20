import { useEffect, useRef, useState } from 'react'
import { socket } from './lib/socket'
import Login from './components/Login'
import DMList from './components/DMList'
import ChatWindow from './components/ChatWindow'

export default function App() {
  const [me, setMe] = useState(null)
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState({}) // { userId: [{from,to,text,time}] }
  const meRef = useRef(null)

  function handleLogin(name) {
    socket.emit('user:login', name)
  }

  useEffect(() => {
    socket.on('user:login-ok', (user) => {
      setMe(user)
      meRef.current = user
      localStorage.setItem('chatUser', user.id)
    })

    socket.on('users:update', (list) => {
      setUsers(list)
      setSelected((cur) => (cur && list.some((u) => u.id === cur) ? cur : cur))
    })

    socket.on('message:receive', (msg) => {
      setMessages((prev) => {
        const key = msg.from === meRef.current?.id ? msg.to : msg.from
        return { ...prev, [key]: [...(prev[key] || []), msg] }
      })
    })

    return () => {
      socket.off('user:login-ok')
      socket.off('users:update')
      socket.off('message:receive')
    }
  }, [])

  function handleSend(to, text) {
    const msg = { from: me.id, to, text, time: Date.now() }
    socket.emit('message:send', { to, text })
    setMessages((prev) => ({ ...prev, [to]: [...(prev[to] || []), msg] }))
  }

  if (!me) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="app">
      <DMList users={users} me={me} selected={selected} onSelect={setSelected} />
      <ChatWindow
        peer={users.find((u) => u.id === selected)}
        me={me}
        messages={selected ? messages[selected] || [] : []}
        onSend={handleSend}
      />
    </div>
  )
}
