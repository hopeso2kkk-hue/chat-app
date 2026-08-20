import { useCallback, useEffect, useRef, useState } from 'react'
import { socket } from '../lib/socket'

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

export function useWebRTC() {
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerRef = useRef(null)
  const [inCall, setInCall] = useState(false)
  const [incoming, setIncoming] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [muted, setMuted] = useState(false)
  const [screenActive, setScreenActive] = useState(false)

  const cleanup = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    peerRef.current = null
    setRemoteStream(null)
    setInCall(false)
    setScreenActive(false)
  }, [])

  const createPC = useCallback((peerId) => {
    peerRef.current = peerId
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('call:ice', { to: peerId, candidate: e.candidate })
    }
    pc.ontrack = (e) => setRemoteStream(e.streams[0])
    pcRef.current = pc
    return pc
  }, [])

  const startCall = useCallback(
    async (peerId) => {
      const pc = createPC(peerId)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('call:offer', { to: peerId, offer })
      setInCall(true)
    },
    [createPC]
  )

  const answerCall = useCallback(async () => {
    if (!incoming) return
    const { from, offer } = incoming
    const pc = createPC(from)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    localStreamRef.current = stream
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    await pc.setRemoteDescription(offer)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    socket.emit('call:answer', { to: from, answer })
    setIncoming(null)
    setInCall(true)
  }, [incoming, createPC])

  const declineCall = useCallback(() => {
    if (incoming) socket.emit('call:decline', { to: incoming.from })
    setIncoming(null)
    cleanup()
  }, [incoming, cleanup])

  const endCall = useCallback(() => {
    if (peerRef.current) socket.emit('call:end', { to: peerRef.current })
    cleanup()
  }, [cleanup])

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev
      localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next))
      return next
    })
  }, [])

  const toggleScreen = useCallback(async () => {
    if (screenActive) {
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video')
      await sender?.replaceTrack(null)
      localStreamRef.current?.getVideoTracks().forEach((t) => t.stop())
      localStreamRef.current?.getVideoTracks().forEach((t) => localStreamRef.current.removeTrack(t))
      setScreenActive(false)
      return
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    const videoTrack = stream.getVideoTracks()[0]
    localStreamRef.current?.addTrack(videoTrack, stream)
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video')
    await sender?.replaceTrack(videoTrack)
    videoTrack.onended = () => setScreenActive(false)
    setScreenActive(true)
  }, [screenActive])

  useEffect(() => {
    if (pcRef.current && incoming) {
      socket.emit('call:busy', { to: incoming.from })
      setIncoming(null)
    }
  }, [incoming])

  useEffect(() => {
    socket.on('call:offer', ({ from, offer }) => setIncoming({ from, offer }))
    socket.on('call:answer', async ({ answer }) => {
      try {
        await pcRef.current?.setRemoteDescription(answer)
      } catch {}
    })
    socket.on('call:ice', async ({ candidate }) => {
      try {
        await pcRef.current?.addIceCandidate(candidate)
      } catch {}
    })
    socket.on('call:end', () => cleanup())
    socket.on('call:decline', () => cleanup())
    socket.on('call:busy', () => cleanup())
    return () => {
      socket.off('call:offer')
      socket.off('call:answer')
      socket.off('call:ice')
      socket.off('call:end')
      socket.off('call:decline')
      socket.off('call:busy')
    }
  }, [cleanup])

  return {
    inCall,
    incoming,
    remoteStream,
    muted,
    screenActive,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleScreen,
  }
}
