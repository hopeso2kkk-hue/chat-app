import { useCallback, useEffect, useRef, useState } from 'react'
import { socket } from '../lib/socket'
import { TURN_CONFIG } from '../config'

const ICE_SERVERS = [TURN_CONFIG]

export function useWebRTC() {
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerRef = useRef(null)
  const remoteStreamRef = useRef(new MediaStream())
  const pendingCandidatesRef = useRef([])
  const videoSenderRef = useRef(null)
  const [inCall, setInCall] = useState(false)
  const [incoming, setIncoming] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [muted, setMuted] = useState(false)
  const [screenActive, setScreenActive] = useState(false)

  const flushCandidates = useCallback(() => {
    const pc = pcRef.current
    if (!pc || !pc.remoteDescription) return
    const queued = pendingCandidatesRef.current
    pendingCandidatesRef.current = []
    queued.forEach((c) => pc.addIceCandidate(c).catch(() => {}))
  }, [])

  const addRemoteCandidate = useCallback((candidate) => {
    const pc = pcRef.current
    if (pc && pc.remoteDescription) {
      pc.addIceCandidate(candidate).catch(() => {})
    } else {
      pendingCandidatesRef.current.push(candidate)
    }
  }, [])

  const renegotiate = useCallback(async () => {
    const pc = pcRef.current
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socket.emit('call:renegotiate', { to: peerRef.current, offer })
  }, [])

  const cleanup = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    remoteStreamRef.current?.getTracks().forEach((t) => t.stop())
    remoteStreamRef.current = new MediaStream()
    pendingCandidatesRef.current = []
    videoSenderRef.current = null
    peerRef.current = null
    setRemoteStream(null)
    setInCall(false)
    setScreenActive(false)
    setMuted(false)
  }, [])

  const createPC = useCallback((peerId) => {
    peerRef.current = peerId
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('call:ice', { to: peerId, candidate: e.candidate })
    }
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => {
        if (!remoteStreamRef.current.getTracks().includes(t)) {
          remoteStreamRef.current.addTrack(t)
        }
      })
      setRemoteStream(remoteStreamRef.current)
    }
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
    flushCandidates()
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    socket.emit('call:answer', { to: from, answer })
    setIncoming(null)
    setInCall(true)
  }, [incoming, createPC, flushCandidates])

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
      await videoSenderRef.current?.replaceTrack(null)
      videoSenderRef.current = null
      localStreamRef.current?.getVideoTracks().forEach((t) => {
        t.stop()
        localStreamRef.current.removeTrack(t)
      })
      setScreenActive(false)
      return
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    const videoTrack = stream.getVideoTracks()[0]
    localStreamRef.current?.addTrack(videoTrack)
    if (videoSenderRef.current) {
      await videoSenderRef.current.replaceTrack(videoTrack)
    } else {
      videoSenderRef.current = pcRef.current?.addTrack(videoTrack, localStreamRef.current)
      await renegotiate()
    }
    videoTrack.onended = () => setScreenActive(false)
    setScreenActive(true)
  }, [screenActive, renegotiate])

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
        flushCandidates()
      } catch {}
    })
    socket.on('call:ice', ({ candidate }) => addRemoteCandidate(candidate))
    socket.on('call:renegotiate', async ({ from, offer }) => {
      try {
        await pcRef.current?.setRemoteDescription(offer)
        const answer = await pcRef.current?.createAnswer()
        await pcRef.current?.setLocalDescription(answer)
        socket.emit('call:renegotiate-answer', { to: from, answer })
      } catch {}
    })
    socket.on('call:renegotiate-answer', async ({ answer }) => {
      try {
        await pcRef.current?.setRemoteDescription(answer)
        flushCandidates()
      } catch {}
    })
    socket.on('call:end', () => cleanup())
    socket.on('call:decline', () => cleanup())
    socket.on('call:busy', () => cleanup())
    return () => {
      socket.off('call:offer')
      socket.off('call:answer')
      socket.off('call:ice')
      socket.off('call:renegotiate')
      socket.off('call:renegotiate-answer')
      socket.off('call:end')
      socket.off('call:decline')
      socket.off('call:busy')
    }
  }, [addRemoteCandidate, cleanup, flushCandidates])

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
