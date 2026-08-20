import { useCallback, useEffect, useRef, useState } from 'react'
import { socket } from '../lib/socket'
import { TURN_CONFIG } from '../config'

const ICE_SERVERS = [TURN_CONFIG]

// Canais de voz de servidor: cada membro conecta uma RTCPeerConnection a
// cada outro membro (mesh). Quem entra espera ofertas dos que já estão;
// quem já está chama o novato.
export function useVoiceChannel() {
  const pcsRef = useRef(new Map()) // peerId -> RTCPeerConnection
  const localRef = useRef(null)
  const channelRef = useRef(null) // { serverId, channelId, channelName }
  const [active, setActive] = useState(null)
  const [members, setMembers] = useState([])
  const [streams, setStreams] = useState({}) // peerId -> MediaStream
  const [muted, setMuted] = useState(false)

  const cleanup = useCallback(() => {
    pcsRef.current.forEach((pc) => pc.close())
    pcsRef.current = new Map()
    localRef.current?.getTracks().forEach((t) => t.stop())
    localRef.current = null
    channelRef.current = null
    setMembers([])
    setStreams({})
    setActive(null)
    setMuted(false)
  }, [])

  const ensureLocal = useCallback(async () => {
    if (!localRef.current) {
      localRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    }
    return localRef.current
  }, [])

  const createPC = useCallback((peerId, channelId) => {
    let pc = pcsRef.current.get(peerId)
    if (pc) return pc
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('server:voice-ice', { channelId, to: peerId, candidate: e.candidate })
    }
    pc.ontrack = (e) => {
      setStreams((prev) => (prev[peerId] === e.streams[0] ? prev : { ...prev, [peerId]: e.streams[0] }))
    }
    pcsRef.current.set(peerId, pc)
    return pc
  }, [])

  const connectToPeer = useCallback(
    async (peerId, channelId) => {
      const pc = createPC(peerId, channelId)
      try {
        const stream = await ensureLocal()
        stream.getTracks().forEach((t) => pc.addTrack(t, stream))
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('server:voice-offer', { channelId, to: peerId, offer })
      } catch {}
    },
    [createPC, ensureLocal]
  )

  const join = useCallback(
    async (serverId, channelId, channelName) => {
      if (channelRef.current) {
        socket.emit('server:voice-leave', { channelId: channelRef.current.channelId })
        cleanup()
      }
      channelRef.current = { serverId, channelId, channelName }
      try {
        await ensureLocal()
      } catch {
        channelRef.current = null
        setActive(null)
        return
      }
      socket.emit('server:voice-join', { serverId, channelId })
      setActive({ serverId, channelId, channelName })
    },
    [cleanup, ensureLocal]
  )

  const leave = useCallback(() => {
    if (channelRef.current) {
      socket.emit('server:voice-leave', { channelId: channelRef.current.channelId })
    }
    cleanup()
  }, [cleanup])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next))
      return next
    })
  }, [])

  useEffect(() => {
    socket.on('server:voice-members', ({ channelId, members: list }) => {
      if (!channelRef.current || channelRef.current.channelId !== channelId) return
      setMembers(list)
    })

    socket.on('server:voice-member-joined', ({ channelId, member }) => {
      if (!channelRef.current || channelRef.current.channelId !== channelId) return
      if (member.id === socket.id) return
      setMembers((prev) => (prev.some((m) => m.id === member.id) ? prev : [...prev, member]))
      connectToPeer(member.id, channelId)
    })

    socket.on('server:voice-member-left', ({ channelId, id }) => {
      if (!channelRef.current || channelRef.current.channelId !== channelId) return
      setMembers((prev) => prev.filter((m) => m.id !== id))
      setStreams((prev) => {
        if (!prev[id]) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
      const pc = pcsRef.current.get(id)
      if (pc) {
        pc.close()
        pcsRef.current.delete(id)
      }
    })

    socket.on('server:voice-offer', async ({ channelId, from, offer }) => {
      if (!channelRef.current || channelRef.current.channelId !== channelId) return
      const pc = createPC(from, channelId)
      try {
        await pc.setRemoteDescription(offer)
        const stream = await ensureLocal()
        stream.getTracks().forEach((t) => pc.addTrack(t, stream))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('server:voice-answer', { channelId, to: from, answer })
      } catch {}
    })

    socket.on('server:voice-answer', ({ from, answer }) => {
      const pc = pcsRef.current.get(from)
      if (pc) pc.setRemoteDescription(answer).catch(() => {})
    })

    socket.on('server:voice-ice', ({ channelId, from, candidate }) => {
      if (!channelRef.current || channelRef.current.channelId !== channelId) return
      const pc = pcsRef.current.get(from)
      if (pc) pc.addIceCandidate(candidate).catch(() => {})
    })

    socket.on('disconnect', () => cleanup())

    return () => {
      socket.off('server:voice-members')
      socket.off('server:voice-member-joined')
      socket.off('server:voice-member-left')
      socket.off('server:voice-offer')
      socket.off('server:voice-answer')
      socket.off('server:voice-ice')
      socket.off('disconnect')
    }
  }, [cleanup, connectToPeer, createPC, ensureLocal])

  useEffect(() => () => cleanup(), [cleanup])

  return { active, members, streams, muted, join, leave, toggleMute }
}
