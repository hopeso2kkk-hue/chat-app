import { useCallback, useEffect, useRef, useState } from 'react'
import { socket } from '../lib/socket'
import { TURN_CONFIG } from '../config'
import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor'
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url'
import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url'
import rnnoiseSimdWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url'

const ICE_SERVERS = [TURN_CONFIG]

const SCREEN_QUALITIES = {
  '480p': { width: { ideal: 854, max: 854 }, height: { ideal: 480, max: 480 } },
  '720p': { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 } },
  '1080p': { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 } },
  '1440p': { width: { ideal: 2560, max: 2560 }, height: { ideal: 1440, max: 1440 } },
}

// Canais de voz de servidor: cada membro conecta uma RTCPeerConnection a
// cada outro membro (mesh). Quem entra espera ofertas dos que já estão;
// quem já está chama o novato. Suporta supressão de ruído (Krisp/RNNoise)
// e transmissão de tela (com renegociação por par).
export function useVoiceChannel() {
  const pcsRef = useRef(new Map()) // peerId -> RTCPeerConnection
  const localRef = useRef(null) // microfone bruto
  const sendStreamRef = useRef(null) // stream que vai para as PCs (pode ser processada)
  const channelRef = useRef(null) // { serverId, channelId, channelName }
  const screenTrackRef = useRef(null)
  const screenSendersRef = useRef(new Map()) // peerId -> RTCRtpSender (vídeo da tela)
  const audioCtxRef = useRef(null)
  const sourceRef = useRef(null)
  const nodeRef = useRef(null)
  const destRef = useRef(null)

  const [active, setActive] = useState(null)
  const [members, setMembers] = useState([])
  const [streams, setStreams] = useState({}) // peerId -> MediaStream
  const [muted, setMuted] = useState(false)
  const [screenActive, setScreenActive] = useState(false)
  const [screenQuality, setScreenQualityState] = useState('1080p')
  const screenQualityRef = useRef(screenQuality)

  useEffect(() => {
    screenQualityRef.current = screenQuality
  }, [screenQuality])
  const [settings, setSettings] = useState({
    suppression: 'standard',
    echoCancellation: true,
    autoGainControl: true,
  })
  const settingsRef = useRef(settings)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const teardownKrisp = useCallback(() => {
    try {
      nodeRef.current?.destroy?.()
      sourceRef.current?.disconnect()
      nodeRef.current?.disconnect()
      destRef.current?.disconnect()
    } catch {}
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    sourceRef.current = null
    nodeRef.current = null
    destRef.current = null
  }, [])

  const cleanup = useCallback(() => {
    pcsRef.current.forEach((pc) => pc.close())
    pcsRef.current = new Map()
    localRef.current?.getTracks().forEach((t) => t.stop())
    localRef.current = null
    sendStreamRef.current = null
    screenTrackRef.current?.stop()
    screenTrackRef.current = null
    screenSendersRef.current = new Map()
    teardownKrisp()
    channelRef.current = null
    setMembers([])
    setStreams({})
    setActive(null)
    setMuted(false)
    setScreenActive(false)
  }, [teardownKrisp])

  const ensureLocal = useCallback(async () => {
    if (!localRef.current) {
      const s = settingsRef.current
      localRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: s.echoCancellation,
          autoGainControl: s.autoGainControl,
          noiseSuppression: s.suppression !== 'krisp' && s.suppression !== 'off',
        },
      })
    }
    return localRef.current
  }, [])

  const setupKrisp = useCallback(async (raw) => {
    if (destRef.current) return destRef.current.stream
    const ctx = new AudioContext({ sampleRate: 48000 })
    await ctx.audioWorklet.addModule(rnnoiseWorkletPath)
    const wasmBinary = await loadRnnoise({ url: rnnoiseWasmPath, simdUrl: rnnoiseSimdWasmPath })
    const source = ctx.createMediaStreamSource(raw)
    const node = new RnnoiseWorkletNode(ctx, { wasmBinary, maxChannels: 2 })
    const dest = ctx.createMediaStreamDestination()
    source.connect(node)
    node.connect(dest)
    audioCtxRef.current = ctx
    sourceRef.current = source
    nodeRef.current = node
    destRef.current = dest
    return dest.stream
  }, [])

  const ensureSend = useCallback(async () => {
    const raw = await ensureLocal()
    if (settingsRef.current.suppression === 'krisp') {
      const dest = await setupKrisp(raw)
      sendStreamRef.current = dest
    } else {
      sendStreamRef.current = raw
    }
    return sendStreamRef.current
  }, [ensureLocal, setupKrisp])

  const addLocalTracks = useCallback((pc) => {
    const stream = sendStreamRef.current
    if (!stream) return
    stream.getTracks().forEach((t) => {
      if (!pc.getSenders().some((s) => s.track === t)) pc.addTrack(t, stream)
    })
  }, [])

  const applyToPcs = useCallback(async () => {
    const audioTrack = sendStreamRef.current?.getAudioTracks()[0]
    if (!audioTrack) return
    for (const pc of pcsRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'audio')
      if (sender) {
        try {
          await sender.replaceTrack(audioTrack)
        } catch {}
      }
    }
  }, [])

  const createPC = useCallback((peerId, channelId) => {
    let pc = pcsRef.current.get(peerId)
    if (pc) return pc
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('server:voice-ice', { channelId, to: peerId, candidate: e.candidate })
    }
    pc.ontrack = (e) => {
      const track = e.track
      setStreams((prev) => {
        const existing = prev[peerId]
        if (existing && existing.getTracks().includes(track)) return prev
        const stream = existing || new MediaStream()
        stream.addTrack(track)
        return { ...prev, [peerId]: stream }
      })
      track.onended = () => {
        setStreams((prev) => {
          const s = prev[peerId]
          if (!s) return prev
          s.removeTrack(track)
          return { ...prev }
        })
      }
    }
    pcsRef.current.set(peerId, pc)
    return pc
  }, [])

  const connectToPeer = useCallback(
    async (peerId, channelId) => {
      const pc = createPC(peerId, channelId)
      try {
        await ensureSend()
        addLocalTracks(pc)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('server:voice-offer', { channelId, to: peerId, offer })
      } catch {}
    },
    [createPC, ensureSend, addLocalTracks]
  )

  const renegotiatePeer = useCallback(async (peerId) => {
    const pc = pcsRef.current.get(peerId)
    const channelId = channelRef.current?.channelId
    if (!pc || !channelId) return
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('server:voice-offer', { channelId, to: peerId, offer })
    } catch {}
  }, [])

  const stopScreen = useCallback(async () => {
    const videoTrack = screenTrackRef.current
    screenTrackRef.current = null
    for (const [peerId, sender] of screenSendersRef.current) {
      const pc = pcsRef.current.get(peerId)
      if (pc) {
        try {
          pc.removeTrack(sender)
        } catch {}
      }
    }
    screenSendersRef.current = new Map()
    videoTrack?.stop()
    setScreenActive(false)
    for (const peerId of pcsRef.current.keys()) {
      await renegotiatePeer(peerId)
    }
  }, [renegotiatePeer])

  const applyScreenQuality = useCallback((quality) => {
    const track = screenTrackRef.current
    if (!track) return
    const preset = SCREEN_QUALITIES[quality] || SCREEN_QUALITIES['1080p']
    track.applyConstraints({ width: preset.width, height: preset.height, frameRate: { max: 60 } }).catch(() => {})
  }, [])

  const startScreen = useCallback(
    async (quality) => {
      if (screenTrackRef.current) return
      let display
      try {
        display = await navigator.mediaDevices.getDisplayMedia({ video: true })
      } catch {
        return
      }
      const videoTrack = display.getVideoTracks()[0]
      if (!videoTrack) return
      const q = SCREEN_QUALITIES[quality] ? quality : screenQualityRef.current
      screenQualityRef.current = q
      setScreenQualityState(q)
      const preset = SCREEN_QUALITIES[q]
      try {
        await videoTrack.applyConstraints({
          width: preset.width,
          height: preset.height,
          frameRate: { max: 60 },
        })
      } catch {}
      screenTrackRef.current = videoTrack
      videoTrack.onended = () => stopScreen()
      const local = await ensureLocal()
      for (const peerId of pcsRef.current.keys()) {
        const pc = pcsRef.current.get(peerId)
        const sender = pc.addTrack(videoTrack, local)
        screenSendersRef.current.set(peerId, sender)
      }
      setScreenActive(true)
      for (const peerId of pcsRef.current.keys()) {
        await renegotiatePeer(peerId)
      }
    },
    [ensureLocal, renegotiatePeer, stopScreen]
  )

  const setScreenQuality = useCallback(
    (quality) => {
      setScreenQualityState(quality)
      screenQualityRef.current = quality
      applyScreenQuality(quality)
    },
    [applyScreenQuality]
  )

  const join = useCallback(
    async (serverId, channelId, channelName) => {
      if (channelRef.current) {
        socket.emit('server:voice-leave', { channelId: channelRef.current.channelId })
        cleanup()
      }
      channelRef.current = { serverId, channelId, channelName }
      try {
        await ensureSend()
      } catch {
        channelRef.current = null
        setActive(null)
        return
      }
      socket.emit('server:voice-join', { serverId, channelId })
      setActive({ serverId, channelId, channelName })
    },
    [cleanup, ensureSend]
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

  const setSuppression = useCallback(
    async (mode) => {
      settingsRef.current = { ...settingsRef.current, suppression: mode }
      setSettings(settingsRef.current)
      try {
        if (mode === 'krisp') {
          const raw = await ensureLocal()
          const dest = await setupKrisp(raw)
          sendStreamRef.current = dest
        } else {
          teardownKrisp()
          const raw = await ensureLocal()
          sendStreamRef.current = raw
        }
        localRef.current?.getAudioTracks().forEach((t) => {
          t.applyConstraints({ noiseSuppression: mode !== 'krisp' && mode !== 'off' }).catch(() => {})
        })
        await applyToPcs()
      } catch {}
    },
    [ensureLocal, setupKrisp, teardownKrisp, applyToPcs]
  )

  const toggleSetting = useCallback((key) => {
    const next = { ...settingsRef.current, [key]: !settingsRef.current[key] }
    settingsRef.current = next
    setSettings(next)
    localRef.current?.getAudioTracks().forEach((t) => {
      t.applyConstraints({ [key]: next[key] }).catch(() => {})
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
      screenSendersRef.current.delete(id)
    })

    socket.on('server:voice-offer', async ({ channelId, from, offer }) => {
      if (!channelRef.current || channelRef.current.channelId !== channelId) return
      const pc = createPC(from, channelId)
      try {
        await pc.setRemoteDescription(offer)
        await ensureSend()
        addLocalTracks(pc)
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
  }, [cleanup, connectToPeer, createPC, ensureSend, addLocalTracks])

  useEffect(() => () => cleanup(), [cleanup])

  return {
    active,
    members,
    streams,
    muted,
    settings,
    screenActive,
    join,
    leave,
    toggleMute,
    setSuppression,
    toggleSetting,
    screenQuality,
    startScreen,
    stopScreen,
    setScreenQuality,
  }
}
