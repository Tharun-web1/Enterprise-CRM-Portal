import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useMessenger } from '../context/MessengerContext';
import { useNotification } from '../context/NotificationContext';
import Modal from '../components/Modal';
import {
  MessageSquare, Video, Phone, Plus, Send,
  Copy, Sparkles, X, Users, Hash, Edit3, Trash2,
  Paperclip, Smile, FileText, Image as ImageIcon, Download, AlertTriangle, MoreVertical, ArrowLeft, Search, ChevronRight
} from 'lucide-react';
import { SkeletonMessage } from '../components/Skeleton';
import Spinner from '../components/Spinner';
import './TeamsMessenger.css';

const EMOJI_CATEGORIES = [
  { name: 'Frequently Used', emojis: ['😊', '😂', '👍', '❤️', '🔥', '🎉', '🚀', '👏', '🥳', '😎', '🤩', '💡', '🙏', '💯'] },
  { name: 'Work & Tech', emojis: ['💻', '📁', '📝', '📊', '📈', '⚡', '🔧', '🔍', '🎯', '💼', '📌', '📅', '💬', '📞', '🎥'] },
  { name: 'Reactions & Hands', emojis: ['✅', '❌', '❓', '❗', '✨', '⭐', '🔔', '🙌', '💪', '🤝', '👌', '✌️', '👇', '👉'] }
];

const TeamsMessenger = () => {
  const { user: currentUser } = useAuth();
  const { startCall, acceptCall, declineCall, endCall } = useMessenger();
  const { showSuccess, showError, showWarning, showConfirm } = useNotification();
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'

  // Quick Search & Role Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE'

  // Toggle mobile top-bar hiding during active chat thread on mobile
  useEffect(() => {
    document.body.classList.add('messenger-page-active');
    if (mobileView === 'chat') {
      document.body.classList.add('mobile-in-chat');
    } else {
      document.body.classList.remove('mobile-in-chat');
    }
    return () => {
      document.body.classList.remove('messenger-page-active');
      document.body.classList.remove('mobile-in-chat');
    };
  }, [mobileView]);


  const [groups, setGroups] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Ref so polling always reads latest group
  const activeGroupRef = useRef(null);
  useEffect(() => { activeGroupRef.current = activeGroup; }, [activeGroup]);

  // Invites & Modals State
  const [inviteGroupDetail, setInviteGroupDetail] = useState(null);
  const [inviteUserStatus, setInviteUserStatus] = useState(null);
  
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({ name: '', description: '', invited_user_ids: [] });

  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [editGroupForm, setEditGroupForm] = useState({ name: '', description: '', member_ids: [] });

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);

  // Attachment & Emoji State
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);

  // ─── Fetch initial data ───────────────────────────────────────────────
  const fetchInitialData = useCallback(async () => {
    try {
      const [groupsRes, usersRes] = await Promise.all([
        api.get('/chat-groups/'),
        api.get('/users/'),
      ]);
      const grps = groupsRes.data || [];
      setGroups(grps);
      setAllUsers(usersRes.data || []);
      if (grps.length > 0 && !activeGroupRef.current) {
        setActiveGroup(grps[0]);
      }
    } catch (err) {
      console.error('Messenger init error:', err);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  // ─── Polling using ref ─────────────────────────────────────────────────
  const pollUpdates = useCallback(async () => {
    const currentGroup = activeGroupRef.current;
    if (currentGroup) {
      try {
        const msgRes = await api.get('/chat-messages/?group=' + currentGroup.id);
        setMessages(msgRes.data || []);
      } catch (_) {}
    }
    try {
      const [groupsRes, usersRes] = await Promise.all([
        api.get('/chat-groups/'),
        api.get('/users/'),
      ]);
      const grps = groupsRes.data || [];
      setGroups(grps);
      setAllUsers(usersRes.data || []);
      if (currentGroup) {
        const updated = grps.find(g => g.id === currentGroup.id);
        if (updated) setActiveGroup(updated);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchInitialData();
    checkUrlInviteToken();
    const interval = setInterval(pollUpdates, 3000);
    return () => clearInterval(interval);
  }, [fetchInitialData, pollUpdates]);

  useEffect(() => {
    setShowGroupMenu(false);
    if (activeGroup) fetchMessages(activeGroup.id);
    else setMessages([]);
  }, [activeGroup?.id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Invite token handler ─────────────────────────────────────────────
  const checkUrlInviteToken = async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (!token) return;
    try {
      const res = await api.get('/chat-groups/by-token/?token=' + token);
      if (res.data?.group) {
        setInviteGroupDetail(res.data.group);
        setInviteUserStatus(res.data.user_status);
      }
    } catch (_) {}
  };

  const fetchMessages = async (groupId) => {
    setLoadingMessages(true);
    try {
      const res = await api.get('/chat-messages/?group=' + groupId);
      setMessages(res.data || []);
    } catch (_) {}
    finally { setLoadingMessages(false); }
  };

  // ─── File Attachment & Message Send Handlers ─────────────────────────
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!messageInput.trim() && !selectedFile) || !activeGroup) return;

    let attachmentUrl = null;

    if (selectedFile) {
      setUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await api.post('/upload-chat-attachment/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        attachmentUrl = uploadRes.data.attachment_url;
      } catch (err) {
        setUploadingFile(false);
        showError({
          title: 'Attachment Upload Failed',
          message: 'Could not upload selected file.',
          error: err
        });
        return;
      }
      setUploadingFile(false);
    }

    const text = messageInput.trim() || (selectedFile ? `Shared file: ${selectedFile.name}` : '');
    setMessageInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowEmojiPicker(false);

    try {
      await api.post('/chat-messages/', {
        group: activeGroup.id,
        message_text: text,
        attachment_url: attachmentUrl
      });
      fetchMessages(activeGroup.id);
    } catch (err) {
      showError({
        title: 'Message Delivery Failed',
        message: 'Could not send chat message.',
        error: err
      });
    }
  };

  const handleAddEmoji = (emoji) => {
    setMessageInput(prev => prev + emoji);
  };

  const handleStartP2P = async (targetUser) => {
    try {
      const res = await api.post('/chat-groups/get-or-create-p2p/', { target_user_id: targetUser.id });
      setActiveGroup(res.data);
      const gr = await api.get('/chat-groups/');
      setGroups(gr.data || []);
    } catch (err) {
      showError({
        title: 'Direct Message Error',
        message: 'Could not open private chat with user.',
        error: err
      });
    }
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!newGroupForm.name) return;
    try {
      const res = await api.post('/chat-groups/', newGroupForm);
      const groupName = res.data.name;
      setIsCreateGroupOpen(false);
      setNewGroupForm({ name: '', description: '', invited_user_ids: [] });
      const gr = await api.get('/chat-groups/');
      setGroups(gr.data || []);
      setActiveGroup(res.data);
      showSuccess({
        title: 'Channel Created',
        message: `Team channel "${groupName}" has been created successfully.`
      });
    } catch (err) {
      showError({
        title: 'Channel Creation Failed',
        message: 'Could not create team channel.',
        error: err
      });
    }
  };

  // ─── Group Edit & Delete Handlers ─────────────────────────────────────
  const handleOpenEditGroup = () => {
    if (!activeGroup) return;
    const memberIds = activeGroup.members?.map(m => m.user) || [];
    setEditGroupForm({
      name: activeGroup.name || '',
      description: activeGroup.description || '',
      member_ids: memberIds
    });
    setIsEditGroupOpen(true);
  };

  const handleEditGroupSubmit = async (e) => {
    e.preventDefault();
    if (!editGroupForm.name || !activeGroup) return;
    try {
      const res = await api.put(`/chat-groups/${activeGroup.id}/`, editGroupForm);
      setIsEditGroupOpen(false);
      setActiveGroup(res.data);
      const gr = await api.get('/chat-groups/');
      setGroups(gr.data || []);
      showSuccess({
        title: 'Channel Updated',
        message: `Team channel "${res.data.name}" has been updated successfully.`
      });
    } catch (err) {
      showError({
        title: 'Channel Update Failed',
        message: 'Could not save channel changes.',
        error: err
      });
    }
  };

  const handleDeleteGroupSubmit = async () => {
    if (!activeGroup) return;
    const groupName = activeGroup.name;
    try {
      await api.delete(`/chat-groups/${activeGroup.id}/`);
      setIsDeleteConfirmOpen(false);
      const grRes = await api.get('/chat-groups/');
      const grps = grRes.data || [];
      setGroups(grps);
      setActiveGroup(grps.length > 0 ? grps[0] : null);
      showSuccess({
        title: 'Channel Deleted',
        message: `Team channel "${groupName}" has been deleted.`
      });
    } catch (err) {
      showError({
        title: 'Deletion Failed',
        message: 'Could not delete team channel.',
        error: err
      });
    }
  };

  const handleJoinInviteGroup = async () => {
    if (!inviteGroupDetail) return;
    try {
      const res = await api.post('/chat-groups/join-by-token/', { token: inviteGroupDetail.invite_token });
      setInviteUserStatus('JOINED');
      const gr = await api.get('/chat-groups/');
      setGroups(gr.data || []);
      setActiveGroup(res.data.group);
      showSuccess({
        title: 'Joined Channel',
        message: `You have successfully joined "${res.data.group?.name || 'the channel'}".`
      });
    } catch (err) {
      showError({
        title: 'Join Failed',
        message: 'Could not join channel with this invite link.',
        error: err
      });
    }
  };

  const handleCopyInviteLink = (group) => {
    const link = window.location.origin + window.location.pathname + '?invite=' + group.invite_token;
    navigator.clipboard.writeText(link);
    showSuccess({
      title: 'Invite Link Copied',
      message: 'Channel invite link copied to your clipboard.'
    });
  };

  // ─── Display & Attachment helpers ────────────────────────────────────
  const getGroupName = (group) => {
    if (!group) return '';
    if (group.group_type === 'P2P') {
      const other = group.members?.find(m => m.user !== currentUser?.id);
      const d = other?.user_details;
      if (d) return d.first_name ? d.first_name + ' ' + d.last_name : d.username;
    }
    return group.name;
  };

  const getGroupMeta = (group) => {
    if (!group) return '';
    if (group.group_type === 'P2P') {
      const other = group.members?.find(m => Number(m.user) !== Number(currentUser?.id));
      const otherId = other?.user || other?.user_details?.id;
      const d = other?.user_details;
      const uObj = allUsers.find(u => Number(u.id) === Number(otherId));
      const isOnline = uObj ? Boolean(uObj.is_online) : Boolean(d?.is_online);
      const designationOrRole = uObj?.designation || d?.designation || uObj?.role || d?.role || 'Team Member';
      return `${designationOrRole} · ${isOnline ? 'Online' : 'Offline'}`;
    }
    return group.description || (group.members?.length || 0) + ' members';
  };

  const renderGroupAvatar = (group, extraClass = '') => {
    if (!group) return null;
    if (group.group_type === 'P2P') {
      const other = group.members?.find(m => Number(m.user) !== Number(currentUser?.id));
      const otherId = other?.user || other?.user_details?.id;
      const d = other?.user_details;
      const uObj = allUsers.find(u => Number(u.id) === Number(otherId));
      const isOnline = uObj ? Boolean(uObj.is_online) : Boolean(d?.is_online);
      const initials = (uObj?.first_name && uObj?.last_name)
        ? (uObj.first_name[0] + uObj.last_name[0]).toUpperCase()
        : (d?.first_name && d?.last_name)
          ? (d.first_name[0] + d.last_name[0]).toUpperCase()
          : ((uObj?.username || d?.username || 'U').slice(0, 2).toUpperCase());
      return (
        <div className={`group-avatar p2p-avatar ${extraClass}`}>
          {initials}
          <span className={`status-indicator ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online' : 'Offline'} />
        </div>
      );
    }
    if (group.group_type === 'PROJECT') {
      return (
        <div className={`group-avatar project-avatar ${extraClass}`}>
          <Hash size={extraClass ? 16 : 18} />
        </div>
      );
    }
    return (
      <div className={`group-avatar custom-avatar ${extraClass}`}>
        <Users size={extraClass ? 15 : 17} />
      </div>
    );
  };

  const isImageAttachment = (url) => {
    if (!url) return false;
    const cleanUrl = url.toLowerCase();
    return (
      cleanUrl.endsWith('.jpg') ||
      cleanUrl.endsWith('.jpeg') ||
      cleanUrl.endsWith('.png') ||
      cleanUrl.endsWith('.gif') ||
      cleanUrl.endsWith('.webp') ||
      cleanUrl.endsWith('.svg') ||
      cleanUrl.startsWith('data:image/')
    );
  };

  const getFullMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return 'http://localhost:8000' + url;
  };

  const getFileNameFromUrl = (url) => {
    if (!url) return 'Attached File';
    const parts = url.split('/');
    return parts[parts.length - 1];
  };

  // ─── Call handlers ────────────────────────────────────────────────────
  const handleInitiateCall = async (callType, targetUser = null) => {
    let receiverId = targetUser?.id;

    if (!receiverId && activeGroup) {
      if (activeGroup.group_type === 'P2P') {
        const other = activeGroup.members?.find(m => m.user !== currentUser?.id);
        receiverId = other?.user;
      } else if (activeGroup.members && activeGroup.members.length > 0) {
        const other = activeGroup.members.find(m => m.user !== currentUser?.id);
        receiverId = other?.user;
      }
    }

    if (!receiverId) {
      showWarning({
        title: 'Call Recipient Required',
        message: 'Please select a team member or open a Direct Message to start a call.'
      });
      return;
    }

    try {
      await startCall(receiverId, callType, activeGroup?.id || null);
    } catch (err) {
      showError({
        title: 'Call Initiation Failed',
        message: 'Could not connect the call.',
        error: err
      });
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────
  if (initialLoading) {
    return (
      <div className="messenger-workspace" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="messenger-empty-icon" style={{ margin: '0 auto 1rem' }}>
            <MessageSquare size={34} color="var(--primary)" style={{ opacity: 0.6 }} />
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
            Loading Teams Messenger...
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Connecting to workspace...
          </div>
        </div>
      </div>
    );
  }

  const projectGroups = groups.filter(g => g.group_type === 'PROJECT');
  const customGroups = groups.filter(g => g.group_type === 'CUSTOM');
  const dmUsers = allUsers.filter(u => Number(u.id) !== Number(currentUser?.id));

  const term = searchTerm.toLowerCase().trim();

  const filteredProjectGroups = projectGroups.filter(g => {
    if (!term) return true;
    return (g.name || '').toLowerCase().includes(term) || (g.description || '').toLowerCase().includes(term);
  });

  const filteredCustomGroups = customGroups.filter(g => {
    if (!term) return true;
    return (g.name || '').toLowerCase().includes(term) || (g.description || '').toLowerCase().includes(term);
  });

  const filteredDmUsers = dmUsers.filter(u => {
    if (roleFilter !== 'ALL') {
      const uRole = (u.role || '').toUpperCase();
      if (roleFilter === 'MANAGER' && uRole !== 'MANAGER') return false;
      if (roleFilter === 'TEAM_LEAD' && uRole !== 'TEAM_LEAD' && uRole !== 'TL') return false;
      if (roleFilter === 'EMPLOYEE' && uRole !== 'EMPLOYEE' && uRole !== 'STAFF') return false;
    }
    if (!term) return true;
    const name = `${u.first_name || ''} ${u.last_name || ''} ${u.username || ''}`.toLowerCase();
    const desig = (u.designation || '').toLowerCase();
    const role = (u.role || '').toLowerCase();
    const dept = (u.department || '').toLowerCase();
    return name.includes(term) || desig.includes(term) || role.includes(term) || dept.includes(term);
  });


  return (
    <div className="messenger-workspace">

      {/* ── Group Invitation Banner ───────────────────── */}
      {inviteGroupDetail && (
        <div className="invite-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Sparkles size={18} color="var(--accent-amber)" />
            <span>
              <strong>Group Invitation:</strong> Join{' '}
              <strong style={{ color: 'var(--primary)' }}>{inviteGroupDetail.name}</strong> on Teams Messenger
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {inviteUserStatus === 'JOINED'
              ? <span className="badge badge-active">Already Joined</span>
              : <button className="btn btn-primary btn-sm" onClick={handleJoinInviteGroup}>Join Now</button>
            }
            <button className="btn btn-secondary btn-sm" onClick={() => setInviteGroupDetail(null)}>
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Two-column layout ─────────────────────────── */}
      <div className="messenger-container">

        {/* ════════ LEFT SIDEBAR ════════ */}
        <div className={`messenger-sidebar ${mobileView === 'chat' ? 'mobile-hide' : ''}`}>

          {/* Header */}
          <div className="ms-header">
            <div className="ms-logo-row">
              <div className="ms-logo-icon">
                <MessageSquare size={18} color="var(--primary)" />
              </div>
              <div className="ms-title-wrap">
                <span className="ms-title">Teams Messenger</span>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm ms-new-group-btn"
              onClick={() => setIsCreateGroupOpen(true)}
              title="Create New Group"
            >
              <Plus size={13} />
              <span className="btn-label">New Group</span>
            </button>
          </div>

          {/* Quick Search & Role Filter Header */}
          <div className="ms-search-header">
            <div className="ms-search-input-box">
              <Search size={15} className="ms-search-icon" />
              <input
                type="text"
                placeholder="Search teammate, role, or channel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="ms-clear-btn" onClick={() => setSearchTerm('')} title="Clear search">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Role Filter Pills */}
            <div className="scroll-horizontal-pills">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'MANAGER', label: 'Managers' },
                { id: 'TEAM_LEAD', label: 'Team Leads' },
                { id: 'EMPLOYEE', label: 'Employees' },
              ].map((rf) => (
                <button
                  key={rf.id}
                  onClick={() => setRoleFilter(rf.id)}
                  className={`filter-pill ${roleFilter === rf.id ? 'active' : ''}`}
                >
                  {rf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contacts + Channels */}
          <div className="ms-groups-scroll">

            {/* Project Channels */}
            {filteredProjectGroups.length > 0 && (
              <>
                <div className="group-section-title">
                  <span>📁 Project Channels</span>
                  <span className="section-count-badge">{filteredProjectGroups.length}</span>
                </div>
                {filteredProjectGroups.map(g => (
                  <div
                    key={g.id}
                    className={'group-item' + (activeGroup?.id === g.id ? ' active' : '')}
                    onClick={() => { setActiveGroup(g); setMobileView('chat'); }}
                  >
                    <div className="group-avatar project-avatar">
                      <Hash size={18} />
                    </div>
                    <div className="group-info">
                      <div className="group-name-row">
                        <span className="group-name">{g.name}</span>
                        <span className="channel-type-badge">Project</span>
                      </div>
                      <div className="group-meta">{g.members?.length || 0} members</div>
                    </div>
                    <ChevronRight size={15} className="group-item-chevron" />
                  </div>
                ))}
              </>
            )}

            {/* Custom Groups */}
            {filteredCustomGroups.length > 0 && (
              <>
                <div className="group-section-title">
                  <span>💬 Custom Groups</span>
                  <span className="section-count-badge">{filteredCustomGroups.length}</span>
                </div>
                {filteredCustomGroups.map(g => (
                  <div
                    key={g.id}
                    className={'group-item' + (activeGroup?.id === g.id ? ' active' : '')}
                    onClick={() => { setActiveGroup(g); setMobileView('chat'); }}
                  >
                    <div className="group-avatar custom-avatar">
                      <Users size={17} />
                    </div>
                    <div className="group-info">
                      <div className="group-name-row">
                        <span className="group-name">{g.name}</span>
                        <span className="channel-type-badge group">Group</span>
                      </div>
                      <div className="group-meta">{g.members?.length || 0} members</div>
                    </div>
                    <ChevronRight size={15} className="group-item-chevron" />
                  </div>
                ))}
              </>
            )}

            {/* Direct Messages */}
            <div className="group-section-title">
              <span>💬 Direct Messages</span>
              <span className="section-count-badge">{filteredDmUsers.length}</span>
            </div>
            {filteredDmUsers.length === 0 && (
              <div className="ms-empty-search">
                <Search size={22} className="ms-empty-search-icon" />
                <p>{searchTerm || roleFilter !== 'ALL' ? 'No teammates found matching search/filter.' : 'No teammates available.'}</p>
                {(searchTerm || roleFilter !== 'ALL') && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setSearchTerm(''); setRoleFilter('ALL'); }}
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            )}
            {filteredDmUsers.map(u => {
              const p2pGrp = groups.find(g => g.group_type === 'P2P' && g.members?.some(m => Number(m.user) === Number(u.id)));
              const isSelected = activeGroup && (
                activeGroup.id === p2pGrp?.id ||
                (activeGroup.group_type === 'P2P' && activeGroup.members?.some(m => Number(m.user) === Number(u.id)))
              );
              const uName = u.first_name ? u.first_name + ' ' + u.last_name : u.username;
              const initials = (u.first_name && u.last_name)
                ? (u.first_name[0] + u.last_name[0]).toUpperCase()
                : u.username.slice(0, 2).toUpperCase();

              return (
                <div
                  key={u.id}
                  className={'group-item' + (isSelected ? ' active' : '')}
                  onClick={() => { handleStartP2P(u); setMobileView('chat'); }}
                >
                  <div className="group-avatar p2p-avatar">
                    {initials}
                    <span className={`status-indicator ${u.is_online ? 'online' : 'offline'}`} title={u.is_online ? 'Online' : 'Offline'} />
                  </div>
                  <div className="group-info">
                    <div className="group-name-row">
                      <span className="group-name">{uName}</span>
                      <span className="role-micro-badge">{u.role?.toLowerCase() || 'employee'}</span>
                    </div>
                    <div className="group-meta">
                      <span>{u.designation || u.department || 'Team Member'}</span>
                      <span className={`dm-status-text ${u.is_online ? 'online' : 'offline'}`}> · {u.is_online ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className="group-item-chevron" />
                </div>
              );
            })}
          </div>
        </div>

        {/* ════════ RIGHT CHAT PANEL ════════ */}
        <div className={`messenger-main ${mobileView === 'list' ? 'mobile-hide' : ''}`}>
          {activeGroup ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <div className="chat-header-left">
                  <button
                    className="mobile-back-btn"
                    onClick={() => setMobileView('list')}
                    title="Back to Contacts"
                    aria-label="Back"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  {renderGroupAvatar(activeGroup, 'chat-header-avatar')}

                  <div className="chat-header-info">
                    <h3>{getGroupName(activeGroup)}</h3>
                    <div className="chat-header-meta">
                      {activeGroup.group_type === 'P2P' && (() => {
                        const other = activeGroup.members?.find(m => Number(m.user) !== Number(currentUser?.id));
                        const otherId = other?.user || other?.user_details?.id;
                        const uObj = allUsers.find(u => Number(u.id) === Number(otherId));
                        const isOnline = uObj ? Boolean(uObj.is_online) : Boolean(other?.user_details?.is_online);
                        return <span className={`online-dot-inline ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Online' : 'Offline'} />;
                      })()}
                      <span>{getGroupMeta(activeGroup)}</span>
                    </div>
                  </div>
                </div>

                <div className="chat-action-btns">
                  {/* Call & Video Call available in all chats & channels */}
                  <button
                    className="chat-action-btn"
                    onClick={() => handleInitiateCall('AUDIO')}
                    title="Start Audio Call"
                  >
                    <Phone size={14} color="var(--accent-cyan)" />
                    <span className="btn-text">Call</span>
                  </button>
                  <button
                    className="chat-action-btn primary"
                    onClick={() => handleInitiateCall('VIDEO')}
                    title="Start Video Call"
                  >
                    <Video size={14} />
                    <span className="btn-text">Video</span>
                  </button>

                  {/* 3-Dots Group Options Dropdown */}
                  {activeGroup.group_type !== 'P2P' && (
                    <div className="group-options-dropdown-container">
                      <button
                        className={'btn btn-secondary btn-sm' + (showGroupMenu ? ' active' : '')}
                        style={{ padding: '0.35rem 0.5rem' }}
                        onClick={() => setShowGroupMenu(!showGroupMenu)}
                        title="Group Options"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {showGroupMenu && (
                        <div className="group-options-menu">
                          <button
                            className="group-menu-item"
                            onClick={() => { setShowGroupMenu(false); handleOpenEditGroup(); }}
                          >
                            <Edit3 size={14} />
                            <span>Edit Group</span>
                          </button>
                          
                          {activeGroup.invite_token && (
                            <button
                              className="group-menu-item"
                              onClick={() => { setShowGroupMenu(false); handleCopyInviteLink(activeGroup); }}
                            >
                              <Copy size={14} />
                              <span>Copy Invite Link</span>
                            </button>
                          )}

                          <button
                            className="group-menu-item danger"
                            onClick={() => { setShowGroupMenu(false); setIsDeleteConfirmOpen(true); }}
                          >
                            <Trash2 size={14} />
                            <span>Delete Group</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Messages Body */}
              <div className="messages-body">
                {loadingMessages ? (
                  <SkeletonMessage />
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👋</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                      Start a conversation
                    </div>
                    <div style={{ fontSize: '0.82rem' }}>
                      Say hello to <strong>{getGroupName(activeGroup)}</strong>!
                    </div>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isSelf = msg.sender === currentUser?.id;
                    if (msg.is_system_message) {
                      const isCall = msg.message_text.includes('Call') || msg.message_text.includes('📞') || msg.message_text.includes('📹') || msg.message_text.includes('📵');
                      return (
                        <div key={msg.id} className={isCall ? "call-msg-card" : "system-msg-pill"}>
                          {msg.message_text}
                        </div>
                      );
                    }
                    const senderName = msg.sender_details?.first_name
                      ? msg.sender_details.first_name + ' ' + msg.sender_details.last_name
                      : (msg.sender_details?.username || 'User');
                    const t = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    const fullMediaUrl = getFullMediaUrl(msg.attachment_url);
                    const isImg = isImageAttachment(msg.attachment_url);

                    return (
                      <div key={msg.id} className={'message-row ' + (isSelf ? 'self' : 'other')}>
                        <div className="message-bubble">
                          {!isSelf && <div className="msg-sender-name">{senderName}</div>}

                          {/* Message Attachment Rendering */}
                          {msg.attachment_url && (
                            <div className="msg-attachment-box">
                              {isImg ? (
                                <a href={fullMediaUrl} target="_blank" rel="noreferrer" className="msg-image-link">
                                  <img src={fullMediaUrl} alt="Attachment" className="msg-image-preview" />
                                </a>
                              ) : (
                                <div className="msg-file-card">
                                  <div className="msg-file-info">
                                    <FileText size={20} color="var(--primary)" />
                                    <span className="msg-file-name">{getFileNameFromUrl(msg.attachment_url)}</span>
                                  </div>
                                  <a href={fullMediaUrl} target="_blank" rel="noreferrer" download className="msg-file-download">
                                    <Download size={14} /> Download
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="msg-text">{msg.message_text}</div>
                          <div className="msg-time">{t}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Input bar footer */}
              <div className="chat-input-area">

                {/* File attachment preview chip */}
                {selectedFile && (
                  <div className="attachment-preview-bar">
                    <div className="att-info">
                      {selectedFile.type.startsWith('image/') ? <ImageIcon size={16} color="var(--primary)" /> : <FileText size={16} color="var(--primary)" />}
                      <span className="att-filename">{selectedFile.name}</span>
                      <span className="att-filesize">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button className="att-remove-btn" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Emoji Picker Popover */}
                {showEmojiPicker && (
                  <div className="emoji-picker-popover">
                    <div className="emoji-picker-header">
                      <span>Pick an Emoji</span>
                      <button className="emoji-close-btn" onClick={() => setShowEmojiPicker(false)}>
                        <X size={13} />
                      </button>
                    </div>
                    <div className="emoji-picker-body">
                      {EMOJI_CATEGORIES.map(cat => (
                        <div key={cat.name} className="emoji-category">
                          <div className="emoji-cat-title">{cat.name}</div>
                          <div className="emoji-grid">
                            {cat.emojis.map(e => (
                              <button key={e} type="button" className="emoji-btn" onClick={() => handleAddEmoji(e)}>
                                {e}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <form className="chat-input-footer" onSubmit={handleSendMessage}>
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />

                  {/* Attachment button */}
                  <button
                    type="button"
                    className={'btn-chat-tool' + (selectedFile ? ' active' : '')}
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach image or file"
                  >
                    <Paperclip size={18} />
                  </button>

                  {/* Emoji picker button */}
                  <button
                    type="button"
                    className={'btn-chat-tool' + (showEmojiPicker ? ' active' : '')}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    title="Insert emoji"
                  >
                    <Smile size={18} />
                  </button>

                  <input
                    type="text"
                    className="chat-input"
                    placeholder={uploadingFile ? 'Uploading file attachment...' : 'Message ' + getGroupName(activeGroup) + '...'}
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    autoComplete="off"
                    disabled={uploadingFile}
                  />

                  <button
                    type="submit"
                    className="btn btn-primary chat-send-btn"
                    disabled={(!messageInput.trim() && !selectedFile) || uploadingFile}
                    title="Send message"
                  >
                    {uploadingFile ? (
                      <Spinner size="xs" color="#ffffff" />
                    ) : (
                      <>
                        <Send size={15} />
                        <span className="send-text">Send</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Empty / Welcome state */
            <div className="messenger-empty">
              <div className="messenger-empty-icon">
                <MessageSquare size={36} color="var(--primary)" style={{ opacity: 0.7 }} />
              </div>
              <h3>Teams Messenger</h3>
              <p>
                Select a project channel, group, or teammate from the sidebar to start real-time messaging, audio & video calls.
              </p>
              <button
                className="btn btn-primary"
                style={{ marginTop: '0.5rem', gap: '0.4rem' }}
                onClick={() => setIsCreateGroupOpen(true)}
              >
                <Plus size={15} /> Create New Group
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Group Modal ───────────────────────── */}
      <Modal isOpen={isCreateGroupOpen} onClose={() => setIsCreateGroupOpen(false)} title="Create New Group Chat">
        <form onSubmit={handleCreateGroupSubmit}>
          <div className="form-group">
            <label className="form-label">Group Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Frontend Team, Design Squad"
              value={newGroupForm.name}
              onChange={e => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="What's this group for?"
              value={newGroupForm.description}
              onChange={e => setNewGroupForm({ ...newGroupForm, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Invite Members</label>
            <div style={{
              maxHeight: '170px', overflowY: 'auto',
              border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.4rem'
            }}>
              {allUsers.filter(u => Number(u.id) !== Number(currentUser?.id)).map(u => (
                <label key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.5rem', cursor: 'pointer', fontSize: '0.84rem',
                  borderRadius: '7px', transition: 'background 0.12s'
                }}>
                  <input
                    type="checkbox"
                    checked={newGroupForm.invited_user_ids.includes(u.id)}
                    onChange={e => {
                      if (e.target.checked)
                        setNewGroupForm(p => ({ ...p, invited_user_ids: [...p.invited_user_ids, u.id] }));
                      else
                        setNewGroupForm(p => ({ ...p, invited_user_ids: p.invited_user_ids.filter(id => id !== u.id) }));
                    }}
                  />
                  <span>
                    {u.first_name ? u.first_name + ' ' + u.last_name : u.username}
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.3rem' }}>({u.role})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }}>
            <Plus size={14} /> Create Group & Send Invitations
          </button>
        </form>
      </Modal>

      {/* ── Edit Group Modal ─────────────────────────── */}
      <Modal isOpen={isEditGroupOpen} onClose={() => setIsEditGroupOpen(false)} title="Edit Group Options">
        <form onSubmit={handleEditGroupSubmit}>
          <div className="form-group">
            <label className="form-label">Group Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Group name"
              value={editGroupForm.name}
              onChange={e => setEditGroupForm({ ...editGroupForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Group description"
              value={editGroupForm.description}
              onChange={e => setEditGroupForm({ ...editGroupForm, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Manage Group Members</label>
            <div style={{
              maxHeight: '180px', overflowY: 'auto',
              border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.4rem'
            }}>
              {allUsers.filter(u => Number(u.id) !== Number(currentUser?.id)).map(u => (
                <label key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.5rem', cursor: 'pointer', fontSize: '0.84rem',
                  borderRadius: '7px', transition: 'background 0.12s'
                }}>
                  <input
                    type="checkbox"
                    checked={editGroupForm.member_ids.includes(u.id)}
                    onChange={e => {
                      if (e.target.checked)
                        setEditGroupForm(p => ({ ...p, member_ids: [...p.member_ids, u.id] }));
                      else
                        setEditGroupForm(p => ({ ...p, member_ids: p.member_ids.filter(id => id !== u.id) }));
                    }}
                  />
                  <span>
                    {u.first_name ? u.first_name + ' ' + u.last_name : u.username}
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.3rem' }}>({u.role})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsEditGroupOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Group Confirmation Modal ─────────── */}
      <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="Delete Group">
        <div style={{ padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#ef4444' }}>
            <AlertTriangle size={28} />
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
              Are you sure you want to delete this group?
            </div>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
            Deleting <strong style={{ color: 'var(--text-main)' }}>{activeGroup?.name}</strong> will remove all message history and remove all members. This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setIsDeleteConfirmOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ background: '#ef4444', borderColor: '#ef4444' }}
              onClick={handleDeleteGroupSubmit}
            >
              Delete Group
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default TeamsMessenger;
