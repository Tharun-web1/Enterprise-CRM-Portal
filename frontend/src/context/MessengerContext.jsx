import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import CallModal from '../components/CallModal';

const MessengerContext = createContext();

export const MessengerProvider = ({ children }) => {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const prevIncomingCallIdRef = useRef(null);

  // Request browser Notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Background polling for calls and unread messages
  const pollCallAndMessageData = useCallback(async () => {
    if (!user) return;

    // 1. Poll Call Sessions
    try {
      const callRes = await api.get('/call-sessions/');
      const calls = callRes.data || [];

      // Check for incoming call ringing for currentUser
      const incoming = calls.find(
        c => c.receiver === user.id && c.status === 'RINGING'
      );

      if (incoming) {
        const fullIncomingCall = { ...incoming, current_user_id: user.id };
        setIncomingCall(fullIncomingCall);

        // Native Browser Desktop Notification for incoming call
        if (
          prevIncomingCallIdRef.current !== incoming.id &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const callerName = incoming.caller_details?.first_name
            ? `${incoming.caller_details.first_name} ${incoming.caller_details.last_name}`
            : (incoming.caller_details?.username || 'Team Member');
          
          try {
            new Notification(`Incoming ${incoming.call_type === 'VIDEO' ? 'Video' : 'Audio'} Call`, {
              body: `${callerName} is calling you on Teams Messenger.`,
              icon: '/favicon.ico',
              requireInteraction: true,
            });
          } catch (_) {}
          prevIncomingCallIdRef.current = incoming.id;
        }
      } else {
        setIncomingCall(null);
        prevIncomingCallIdRef.current = null;
      }

      // Update active call status
      setActiveCall(prev => {
        if (!prev) {
          // Check if currentUser initiated a call that is still ringing or accepted
          const currentActive = calls.find(
            c => (c.caller === user.id || c.receiver === user.id) &&
                 (c.status === 'RINGING' || c.status === 'ACCEPTED')
          );
          if (currentActive && currentActive.caller === user.id) {
            return { ...currentActive, current_user_id: user.id };
          }
          return null;
        }

        const found = calls.find(c => c.id === prev.id);
        if (!found || found.status === 'ENDED' || found.status === 'DECLINED') {
          return null;
        }
        return { ...prev, ...found, current_user_id: user.id };
      });

    } catch (err) {
      console.warn("Background call polling error:", err);
    }

    // 2. Poll Unread Chat Messages
    try {
      const groupsRes = await api.get('/chat-groups/');
      const groups = groupsRes.data || [];
      let totalUnread = 0;
      groups.forEach(g => {
        if (g.unread_count) totalUnread += g.unread_count;
      });
      setUnreadCount(totalUnread);
    } catch (_) {}
  }, [user]);

  useEffect(() => {
    if (!user) {
      setActiveCall(null);
      setIncomingCall(null);
      setUnreadCount(0);
      return;
    }

    pollCallAndMessageData();
    const intervalMs = (activeCall || incomingCall) ? 1500 : 2000;
    const interval = setInterval(pollCallAndMessageData, intervalMs);
    return () => clearInterval(interval);
  }, [user, pollCallAndMessageData, activeCall, incomingCall]);

  // 30-Second Ringing Auto-Cut Timeout
  useEffect(() => {
    let timeoutTimer;
    const ringingCall = (activeCall && activeCall.status === 'RINGING') ? activeCall : ((incomingCall && incomingCall.status === 'RINGING') ? incomingCall : null);

    if (ringingCall && ringingCall.created_at) {
      const createdAtMs = new Date(ringingCall.created_at).getTime();
      const elapsedMs = Date.now() - createdAtMs;
      const remainingMs = Math.max(0, 30000 - elapsedMs);

      timeoutTimer = setTimeout(() => {
        if (ringingCall.caller === user?.id) {
          endCall(ringingCall.id);
        } else {
          declineCall(ringingCall.id);
        }
      }, remainingMs);
    }

    return () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
  }, [activeCall?.id, activeCall?.status, activeCall?.created_at, incomingCall?.id, incomingCall?.status, incomingCall?.created_at, user?.id]);


  // Call Handlers
  const startCall = async (receiverId, callType = 'VIDEO', groupId = null) => {
    try {
      const response = await api.post('/call-sessions/start-call/', {
        receiver_id: receiverId,
        call_type: callType,
        group_id: groupId,
      });
      const newCall = response.data;
      if (newCall) {
        setActiveCall({ ...newCall, current_user_id: user?.id });
      }
      return newCall;
    } catch (err) {
      console.error("Start call error:", err);
      throw err;
    }
  };

  const acceptCall = async (callId) => {
    try {
      let response;
      try {
        response = await api.post(`/call-sessions/${callId}/accept-call/`);
      } catch (_) {
        response = await api.post(`/call-sessions/${callId}/respond-call/`, { action: 'ACCEPT' });
      }
      const acceptedCall = response.data;
      setIncomingCall(null);
      setActiveCall({ ...acceptedCall, current_user_id: user?.id });
    } catch (err) {
      console.error("Accept call error:", err);
    }
  };

  const declineCall = async (callId) => {
    try {
      try {
        await api.post(`/call-sessions/${callId}/decline-call/`);
      } catch (_) {
        await api.post(`/call-sessions/${callId}/respond-call/`, { action: 'DECLINE' });
      }
      setIncomingCall(null);
    } catch (err) {
      console.error("Decline call error:", err);
    }
  };

  const endCall = async (callId) => {
    try {
      await api.post(`/call-sessions/${callId}/end-call/`);
      setActiveCall(null);
    } catch (err) {
      console.error("End call error:", err);
      setActiveCall(null);
    }
  };

  return (
    <MessengerContext.Provider
      value={{
        activeCall,
        incomingCall,
        unreadCount,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        refreshMessengerData: pollCallAndMessageData,
      }}
    >
      {children}
      {/* Global Call Modal Overlay for Incoming & Active Calls across all views */}
      <CallModal
        activeCall={activeCall}
        incomingCall={incomingCall}
        onAcceptCall={acceptCall}
        onDeclineCall={declineCall}
        onEndCall={endCall}
      />
    </MessengerContext.Provider>
  );
};

export const useMessenger = () => useContext(MessengerContext);
