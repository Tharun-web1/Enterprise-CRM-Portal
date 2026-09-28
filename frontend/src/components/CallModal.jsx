import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Shield, AlertCircle, X, ScreenShare } from 'lucide-react';
import './CallModal.css';

const CallModal = ({ activeCall, incomingCall, onAcceptCall, onDeclineCall, onEndCall }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [mediaError, setMediaError] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Call duration timer
  useEffect(() => {
    let timer;
    if (activeCall && activeCall.status === 'ACCEPTED') {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [activeCall?.status]);

  // Web Audio Ringtone for Incoming Ringing Calls
  useEffect(() => {
    let audioCtx = null;
    let ringInterval = null;

    if (incomingCall && incomingCall.status === 'RINGING') {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();

          const playChime = () => {
            if (!audioCtx || audioCtx.state === 'closed') return;
            const now = audioCtx.currentTime;

            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(440, now);
            osc2.frequency.setValueAtTime(480, now);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(audioCtx.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.8);
            osc2.stop(now + 0.8);
          };

          playChime();
          ringInterval = setInterval(playChime, 2000);
        }
      } catch (err) {
        console.warn("Ringtone audio synthesis warning:", err);
      }
    }

    return () => {
      if (ringInterval) clearInterval(ringInterval);
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [incomingCall?.id, incomingCall?.status]);

  // Stop Screen Share helper
  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    // Revert main video back to webcam stream
    if (remoteVideoRef.current && mediaStreamRef.current) {
      remoteVideoRef.current.srcObject = mediaStreamRef.current;
    }
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      setMediaError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setMediaError("Screen sharing is not supported in your browser or environment.");
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });

      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);

      // Display screen stream on the main screen view
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = screenStream;
      }

      // Handle native browser "Stop sharing" floating banner click
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      if (screenVideoTrack) {
        screenVideoTrack.onended = () => {
          stopScreenShare();
        };
      }
    } catch (err) {
      console.warn("Screen sharing error:", err);
      if (err.name !== 'NotAllowedError') {
        setMediaError("Unable to share screen. Permission denied or window selection cancelled.");
      }
    }
  };

  // Request webcam & mic media stream
  useEffect(() => {
    if (activeCall) {
      const isVideoCall = activeCall.call_type === 'VIDEO';
      const constraints = {
        video: isVideoCall,
        audio: true
      };

      setMediaError(null);

      // Support modern navigator.mediaDevices as well as legacy browser vendor prefixes
      const getUserMediaFn = (
        (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)) ||
        (navigator.getUserMedia ? (c) => new Promise((res, rej) => navigator.getUserMedia.call(navigator, c, res, rej)) : null) ||
        (navigator.webkitGetUserMedia ? (c) => new Promise((res, rej) => navigator.webkitGetUserMedia.call(navigator, c, res, rej)) : null) ||
        (navigator.mozGetUserMedia ? (c) => new Promise((res, rej) => navigator.mozGetUserMedia.call(navigator, c, res, rej)) : null)
      );

      if (getUserMediaFn) {
        getUserMediaFn(constraints)
          .then(stream => {
            mediaStreamRef.current = stream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
            if (remoteVideoRef.current && isVideoCall && !isScreenSharing) {
              remoteVideoRef.current.srcObject = stream;
            }
          })
          .catch(err => {
            console.warn("Media access warning:", err);
            if (isVideoCall) {
              // Try audio-only fallback
              getUserMediaFn({ video: false, audio: true })
                .then(audioStream => {
                  mediaStreamRef.current = audioStream;
                  setIsVideoOff(true);
                  setMediaError("Camera access unavailable. Switched call to Audio mode.");
                })
                .catch(aErr => {
                  console.warn("Audio access warning:", aErr);
                  setMediaError("Microphone device permission unavailable. Call active in fallback mode.");
                });
            } else {
              setMediaError("Microphone device permission unavailable. Call active in fallback mode.");
            }
          });
      } else {
        const isNotSecure = window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        if (isNotSecure) {
          setMediaError("Browser restricted Media Devices API on HTTP IP address. Open app over HTTPS or localhost to use Camera & Mic.");
        } else {
          setMediaError("Media devices API not supported by browser. Call active in fallback mode.");
        }
      }
    }

    return () => {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [activeCall?.id, activeCall?.call_type]);

  // Reset controls state on new call
  useEffect(() => {
    if (activeCall) {
      setIsMuted(false);
      setIsVideoOff(false);
      setIsScreenSharing(false);
    }
  }, [activeCall?.id]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted;
      });
    }
    setIsMuted(nextMuted);
  };

  const toggleVideo = () => {
    const nextVideoOff = !isVideoOff;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !nextVideoOff;
      });
    }
    setIsVideoOff(nextVideoOff);
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // INCOMING CALL RINGING MODAL
  if (incomingCall && incomingCall.status === 'RINGING') {
    const callerName = incomingCall.caller_details?.first_name
      ? `${incomingCall.caller_details.first_name} ${incomingCall.caller_details.last_name}`
      : (incomingCall.caller_details?.username || 'Team Member');

    return (
      <div className="call-overlay">
        <div className="call-box incoming-call-box">
          <div className="incoming-pulse-avatar">
            {incomingCall.call_type === 'VIDEO' ? <Video size={36} color="#fff" /> : <Phone size={36} color="#fff" />}
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '1rem', color: '#fff' }}>
            Incoming {incomingCall.call_type === 'VIDEO' ? 'Video' : 'Audio'} Call
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {callerName} is calling you on Teams Messenger...
          </p>

          <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center' }}>
            <button className="call-btn btn-decline" onClick={() => onDeclineCall(incomingCall.id)}>
              <PhoneOff size={20} /> Decline
            </button>
            <button className="call-btn btn-accept" onClick={() => onAcceptCall(incomingCall.id)}>
              <Phone size={20} /> Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE CALL MODAL
  if (activeCall) {
    const partner = activeCall.caller_details?.id === activeCall.current_user_id
      ? activeCall.receiver_details
      : activeCall.caller_details;
    const partnerName = partner?.first_name ? `${partner.first_name} ${partner.last_name}` : (partner?.username || 'Team Member');
    const partnerInitials = partner?.first_name ? `${partner.first_name[0]}${partner.last_name ? partner.last_name[0] : ''}`.toUpperCase() : (partner?.username ? partner.username.slice(0, 2).toUpperCase() : 'TM');

    return (
      <div className="call-overlay">
        <div className="call-box active-call-box">
          {/* Header */}
          <div className="call-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                {activeCall.call_type === 'VIDEO' ? '📹 Video Call' : '📞 Audio Call'} with {partnerName}
              </h3>
              <div style={{ fontSize: '0.8rem', color: activeCall.status === 'ACCEPTED' ? 'var(--accent-emerald)' : 'var(--accent-amber)', marginTop: '2px', fontWeight: 700 }}>
                {activeCall.status === 'RINGING' ? '🔔 Ringing partner...' : `Connected • ${formatTime(callDuration)}`}
              </div>
            </div>
            <div className="call-encryption-badge">
              <Shield size={13} /> Encrypted P2P
            </div>
          </div>

          {/* Media Stream Container */}
          <div className="call-video-grid">
            {mediaError && (
              <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10, background: 'rgba(239, 68, 68, 0.92)', color: '#fff', padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} /> <span>{mediaError}</span>
                </div>
                <button
                  onClick={() => setMediaError(null)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 2, display: 'flex' }}
                  title="Dismiss message"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {isScreenSharing && (
              <div className="screen-share-badge">
                <ScreenShare size={14} /> You are sharing your screen
              </div>
            )}

            {/* Main Video / Audio Screen */}
            <div className="main-video-wrapper">
              {activeCall.call_type === 'VIDEO' && activeCall.status === 'ACCEPTED' ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
              ) : (
                <div className="ringing-placeholder">
                  <div className="call-avatar-circle">
                    {partnerInitials}
                  </div>
                  <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
                    {activeCall.status === 'RINGING' ? `Calling ${partnerName}...` : partnerName}
                  </p>
                  {activeCall.call_type === 'AUDIO' && activeCall.status === 'ACCEPTED' && (
                    <div style={{ color: 'var(--accent-emerald)', fontSize: '0.85rem', marginTop: '4px', fontWeight: 600 }}>
                      Audio Stream Connected
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Self PIP Camera Preview (For Video Calls) */}
            {activeCall.call_type === 'VIDEO' && (
              <div className="pip-video-wrapper">
                <video ref={localVideoRef} autoPlay muted playsInline className={`local-video ${isVideoOff ? 'hidden' : ''}`} />
                {isVideoOff && (
                  <div className="pip-video-off">
                    <VideoOff size={20} color="#fff" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Call Controls Toolbar */}
          <div className="call-toolbar">
            <button className={`control-btn ${isMuted ? 'active-red' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute Mic' : 'Mute Mic'}>
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {activeCall.call_type === 'VIDEO' && (
              <button className={`control-btn ${isVideoOff ? 'active-red' : ''}`} onClick={toggleVideo} title={isVideoOff ? 'Turn On Camera' : 'Turn Off Camera'}>
                {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}

            {activeCall.call_type === 'VIDEO' && activeCall.status === 'ACCEPTED' && (
              <button
                className={`control-btn ${isScreenSharing ? 'active-blue' : ''}`}
                onClick={toggleScreenShare}
                title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
              >
                <ScreenShare size={20} />
              </button>
            )}

            <button className="control-btn btn-end-call" onClick={() => onEndCall(activeCall.id)} title="End Call">
              <PhoneOff size={22} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default CallModal;
