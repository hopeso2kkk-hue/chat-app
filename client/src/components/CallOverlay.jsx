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
  const remoteVideoRef = useRef(null)

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

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
      {remoteStream && screenActive && (
        <video className="screen-video" ref={remoteVideoRef} autoPlay playsInline muted={false} />
      )}
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
