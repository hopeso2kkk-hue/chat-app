import { useRef, useEffect } from 'react'

export default function CallOverlay({
  peerName,
  incoming,
  inCall,
  remoteStream,
  muted,
  screenActive,
  onAnswer,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleScreen,
}) {
  const audioRef = useRef(null)
  const videoRef = useRef(null)

  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream
      audioRef.current.play().catch(() => {})
    }
  }, [remoteStream])

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream
      videoRef.current.play().catch(() => {})
    }
  }, [remoteStream, screenActive])

  if (incoming) {
    return (
      <div className="call-banner incoming">
        <span>📞 {peerName} está chamando...</span>
        <div className="call-banner-actions">
          <button className="call-btn accept" onClick={onAnswer}>
            Atender
          </button>
          <button className="call-btn decline" onClick={onDecline}>
            Recusar
          </button>
        </div>
      </div>
    )
  }

  if (!inCall) return null

  return (
    <div className="call-overlay">
      <audio ref={audioRef} autoPlay />
      {screenActive && <video className="screen-video" ref={videoRef} autoPlay playsInline muted />}
      <div className="call-controls">
        <span className="call-peer">Chamada com {peerName}</span>
        <div className="call-buttons">
          <button className={`call-btn round ${muted ? 'off' : ''}`} onClick={onToggleMute}>
            {muted ? '🎙️ mudo' : '🎙️'}
          </button>
          <button className={`call-btn round ${screenActive ? 'on' : ''}`} onClick={onToggleScreen}>
            {screenActive ? '🖥️ parar' : '🖥️'}
          </button>
          <button className="call-btn round hangup" onClick={onEnd}>
            📞
          </button>
        </div>
      </div>
    </div>
  )
}
