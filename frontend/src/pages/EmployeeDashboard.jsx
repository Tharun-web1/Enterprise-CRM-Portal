import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useMessenger } from '../context/MessengerContext';
import { useNotification } from '../context/NotificationContext';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import TeamsMessenger from './TeamsMessenger';
import UserProfile from './UserProfile';
import { SkeletonCard, SkeletonStats } from '../components/Skeleton';
import {
  Briefcase, CheckSquare, CheckCircle, Send, FileText,
  AlertCircle, ChevronRight, User, MessageSquare, ExternalLink, X,
  Camera, Upload, Clock, Phone, Mail, Sparkles, RefreshCw, Eye, CalendarCheck
} from 'lucide-react';
import TaskDiscussionAndAttachments from '../components/TaskDiscussionAndAttachments';
import AttendanceAndLeavesView from '../components/AttendanceAndLeavesView';
import './EmployeeDashboard.css';

const EmployeeDashboard = () => {
  const { user, requestLogout } = useAuth();
  const { unreadCount } = useMessenger();
  const { showSuccess, showError } = useNotification();
  const [joinedProjects, setJoinedProjects] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Status Filter state
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Task Details Modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailTask, setDetailTask] = useState(null);

  const handleOpenTaskDetailModal = (task) => {
    setDetailTask(task);
    setIsDetailModalOpen(true);
  };

  const handleCloseTaskDetailModal = () => {
    setIsDetailModalOpen(false);
    setDetailTask(null);
  };

  // Tab change with history pushState
  const handleTabChange = (newTab, isBackNav = false) => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    if (!isBackNav) {
      window.history.pushState({ tab: newTab }, null, `?tab=${newTab}`);
    }
    const mainArea = document.querySelector('.layout-main-area');
    if (mainArea) {
      mainArea.scrollTop = 0;
    }
  };

  // Report Form & Selfie Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [reportForm, setReportForm] = useState({
    status: 'IN_PROGRESS',
    requirements_needed: '',
    reporter_name: '',
    visited_person_name: '',
    visited_person_email: '',
    visited_person_phone: '',
    visited_person_company: '',
  });

  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const fetchEmployeeData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [projRes, taskRes] = await Promise.all([
        api.get('/projects/'),
        api.get('/tasks/'),
      ]);

      setJoinedProjects(projRes.data);
      setAssignedTasks(taskRes.data);
    } catch (err) {
      console.error('Error fetching Employee data:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
    const interval = setInterval(() => {
      fetchEmployeeData(true);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    let initialTab = 'overview';
    if (tabParam === 'messenger' || params.get('invite') || window.location.pathname.includes('/messenger')) {
      initialTab = 'messenger';
    } else if (tabParam === 'profile' || window.location.pathname.includes('/profile')) {
      initialTab = 'profile';
    } else if (tabParam && ['overview', 'projects', 'tasks', 'leaves'].includes(tabParam)) {
      initialTab = tabParam;
    }
    setActiveTab(initialTab);
    if (!window.history.state || !window.history.state.tab) {
      window.history.replaceState({ tab: initialTab, isHome: initialTab === 'overview' }, null, window.location.href);
    }
  }, []);

  // Handle browser back button (popstate)
  useEffect(() => {
    const handlePopState = (e) => {
      const targetTab = e.state?.tab;
      if (targetTab && targetTab !== activeTab) {
        setActiveTab(targetTab);
      } else if (!targetTab || (e.state?.isHome && activeTab === 'overview')) {
        requestLogout();
        window.history.pushState({ tab: 'overview', isHome: true }, null, window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeTab, requestLogout]);

  const navItems = [
    { id: 'overview', label: 'Overview Summary', icon: Briefcase },
    { id: 'projects', label: 'My Projects', icon: Briefcase, count: joinedProjects.length },
    { id: 'tasks', label: 'My Assigned Tasks', icon: CheckSquare, count: assignedTasks.length },
    { id: 'leaves', label: 'Attendance & Leaves', icon: CalendarCheck },
    { id: 'messenger', label: 'Teams Messenger', icon: MessageSquare, count: unreadCount || undefined },
    { id: 'profile', label: 'My Profile', icon: User },
  ];

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setSelfieFile(null);
    setSelfiePreview(null);
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        mediaStreamRef.current = stream;
        setIsCameraActive(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.warn("Video play warning:", e));
          }
        }, 150);
      } else {
        setCameraError("Webcam not supported in this browser environment. Please click 'Upload Selfie File' below.");
      }
    } catch (err) {
      console.warn("Camera init error:", err);
      setCameraError("Unable to open camera device (" + err.message + "). Please click 'Upload Selfie File' below!");
    }
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `selfie_visit_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelfieFile(file);
        setSelfiePreview(URL.createObjectURL(blob));
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const handleSelfieFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      stopCamera();
      setSelfieFile(file);
      setSelfiePreview(URL.createObjectURL(file));
      setCameraError(null);
    }
  };

  const handleOpenReportModal = (task) => {
    setSelectedTask(task);
    stopCamera();
    setCameraError(null);
    setSelfieFile(null);
    setSelfiePreview(task.selfie_url || null);
    
    // Pre-fill visited person defaults from task client or previous submission
    const defaultClient = task.project_details?.client_details || {};
    setReportForm({
      status: task.status || 'IN_PROGRESS',
      requirements_needed: task.requirements_needed || '',
      reporter_name: task.reporter_name || (user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username || ''),
      visited_person_name: task.visited_person_name || defaultClient.name || '',
      visited_person_email: task.visited_person_email || defaultClient.email || '',
      visited_person_phone: task.visited_person_phone || defaultClient.phone || '',
      visited_person_company: task.visited_person_company || defaultClient.company || '',
    });
    setIsReportModalOpen(true);
  };

  const handleCloseReportModal = () => {
    stopCamera();
    setIsReportModalOpen(false);
    setSelectedTask(null);
  };

  const handleReportTaskSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      const formData = new FormData();
      formData.append('status', reportForm.status);
      formData.append('requirements_needed', reportForm.requirements_needed);
      formData.append('reporter_name', reportForm.reporter_name);
      formData.append('visited_person_name', reportForm.visited_person_name);
      formData.append('visited_person_email', reportForm.visited_person_email);
      formData.append('visited_person_phone', reportForm.visited_person_phone);
      formData.append('visited_person_company', reportForm.visited_person_company);

      if (selfieFile) {
        formData.append('selfie_image', selfieFile);
      }

      await api.post(`/tasks/${selectedTask.id}/report-task/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const taskTitle = selectedTask.title;
      const hours = reportForm.hours_logged;
      const reportedStatus = reportForm.status;

      handleCloseReportModal();
      fetchEmployeeData();

      showSuccess({
        title: 'Work Report Submitted',
        message: `Your report for "${taskTitle}" has been submitted for Team Lead review.`,
        details: [
          `Task: ${taskTitle}`,
          `Hours Logged: ${hours} hrs`,
          `Reported Status: ${reportedStatus}`,
          selfieFile ? 'Selfie Verification: Photo attached' : null
        ].filter(Boolean)
      });
    } catch (err) {
      showError({
        title: 'Report Submission Failed',
        message: 'Could not submit task work report.',
        error: err
      });
    }
  };

  const filteredTasks = assignedTasks.filter((t) => {
    if (statusFilter === 'ALL') return true;
    return t.status === statusFilter;
  });

  if (loading) {
    return (
      <div className="layout-wrapper">
        <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} navItems={navItems} />
        <div className="layout-main-area">
          <main className="main-content" style={{ padding: '2rem' }}>
            <div className="emp-header" style={{ marginBottom: '1.5rem' }}>
              <div style={{ width: '220px', height: '28px', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', marginBottom: '8px' }} />
              <div style={{ width: '320px', height: '16px', background: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
            </div>
            <SkeletonStats count={3} />
            <div style={{ marginTop: '2rem' }}>
              <SkeletonCard count={4} />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-wrapper">
      <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} navItems={navItems} />

      <div className="layout-main-area">
        <main className={`main-content${activeTab === 'messenger' ? ' messenger-active' : ''}`}>
          {/* Header - hidden on messenger and profile tabs */}
          {activeTab !== 'messenger' && activeTab !== 'profile' && activeTab !== 'leaves' && (
            <div className="emp-header">
              <h1>Employee Portal</h1>
              <p>Team Projects &amp; Assigned Tasks Overview</p>
            </div>
          )}
          {activeTab === 'leaves' && (
            <div className="emp-header">
              <h1>My Attendance &amp; Leaves</h1>
              <p>Daily shift punch, work hours stopwatch &amp; leave request management</p>
            </div>
          )}

          {/* TAB 1: OVERVIEW SUMMARY */}
          {activeTab === 'overview' && (
            <>
              {/* Metrics Overview */}
              <div className="metrics-grid">
                <div
                  className="glass-card metric-card interactive"
                  onClick={() => handleTabChange('projects')}
                  title="Click to view My Hired Projects"
                >
                  <div className="metric-icon icon-emerald"><Briefcase size={24} /></div>
                  <div>
                    <div className="metric-value">{joinedProjects.length}</div>
                    <div className="metric-label">Hired Projects</div>
                    <div className="metric-action-hint">View Projects <ChevronRight size={12} /></div>
                  </div>
                </div>

                <div
                  className="glass-card metric-card interactive"
                  onClick={() => handleTabChange('tasks')}
                  title="Click to view My Assigned Tasks"
                >
                  <div className="metric-icon icon-purple"><CheckSquare size={24} /></div>
                  <div>
                    <div className="metric-value">{assignedTasks.length}</div>
                    <div className="metric-label">Assigned Tasks</div>
                    <div className="metric-action-hint">View Tasks <ChevronRight size={12} /></div>
                  </div>
                </div>

                <div
                  className="glass-card metric-card interactive"
                  onClick={() => { handleTabChange('tasks'); setStatusFilter('COMPLETED'); }}
                  title="Click to view Completed Tasks"
                >
                  <div className="metric-icon icon-cyan"><CheckCircle size={24} /></div>
                  <div>
                    <div className="metric-value">{assignedTasks.filter(t => t.status === 'COMPLETED').length}</div>
                    <div className="metric-label">Completed Tasks</div>
                    <div className="metric-action-hint">View Tasks <ChevronRight size={12} /></div>
                  </div>
                </div>

              </div>

              {/* Projects Overview */}
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                My Hired Project Teams
              </h2>

              {joinedProjects.length === 0 ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <AlertCircle size={32} style={{ marginBottom: '0.5rem', color: 'var(--accent-amber)' }} />
                  <div>You haven't been hired into any project teams by a Team Lead yet.</div>
                </div>
              ) : (
                <div className="employee-projects-grid">
                  {joinedProjects.map((p) => (
                    <div key={p.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--primary)' }}>{p.title}</h3>
                          <span className={`badge badge-${p.status.toLowerCase().replace('_', '-')}`} style={{ flexShrink: 0 }}>{p.status}</span>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', minHeight: '2.2rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {p.description && p.description.trim().length > 3 ? p.description : 'Project team assigned for member collaboration and milestone progress.'}
                        </p>
                      </div>

                      <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                          Client: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{p.client_details?.name || 'N/A'}</span>
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          Team Lead: <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{p.team_lead_details?.first_name ? `${p.team_lead_details.first_name} ${p.team_lead_details.last_name}` : p.team_lead_details?.username}</span>
                        </div>
                        {p.pdf_url && (
                          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)' }}>
                            <a
                              href={p.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ width: '100%', justifyContent: 'center', gap: '4px', fontSize: '0.78rem' }}
                            >
                              <FileText size={13} color="#e11d48" /> View Spec PDF <ExternalLink size={11} />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* TAB 2: JOINED PROJECTS */}
          {activeTab === 'projects' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                My Project Teams ({joinedProjects.length})
              </h2>

              {joinedProjects.length === 0 ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <AlertCircle size={32} style={{ marginBottom: '0.5rem', color: 'var(--accent-amber)' }} />
                  <div>You haven't been hired into any project teams by a Team Lead yet.</div>
                </div>
              ) : (
                <div className="employee-projects-grid">
                  {joinedProjects.map((p) => (
                    <div key={p.id} className="glass-card" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{p.title}</h3>
                        <span className={`badge badge-${p.status.toLowerCase().replace('_', '-')}`}>{p.status}</span>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        {p.description}
                      </p>

                      <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                          Client: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{p.client_details?.name || 'N/A'}</span>
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          Team Lead: <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{p.team_lead_details?.first_name ? `${p.team_lead_details.first_name} ${p.team_lead_details.last_name}` : p.team_lead_details?.username}</span>
                        </div>
                        {p.pdf_url && (
                          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)' }}>
                            <a
                              href={p.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ width: '100%', justifyContent: 'center', gap: '4px', fontSize: '0.78rem' }}
                            >
                              <FileText size={13} color="#e11d48" /> View Spec PDF <ExternalLink size={11} />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ASSIGNED TASKS & REPORTING */}
          {activeTab === 'tasks' && (
            <div>
              <div className="task-filter-bar">
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>My Assigned Tasks ({filteredTasks.length})</h2>

                {/* Filter Pills */}
                <div className="filter-pills-group scroll-horizontal-pills">
                  {['ALL', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'NEEDS_REVISION', 'COMPLETED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                  {statusFilter !== 'ALL' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setStatusFilter('ALL')} style={{ marginLeft: 'auto', gap: '4px' }}>
                      <X size={14} /> Clear Filter
                    </button>
                  )}
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1.5rem' }}>
                {filteredTasks.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No tasks found under selected status filter.</p>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Task Title</th>
                          <th>Project</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Due Date</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTasks.map((t) => (
                          <tr
                            key={t.id}
                            className="interactive-row"
                            onClick={() => handleOpenTaskDetailModal(t)}
                            title="Click to view full Task Details"
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <Eye size={16} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                                <div>
                                  <div style={{ fontWeight: 800, color: 'var(--primary)', textDecoration: 'underline' }}>
                                    {t.title}
                                  </div>
                                  {t.description && (
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                      {t.description}
                                    </div>
                                  )}
                                  {t.review_feedback && (
                                    <div className="feedback-callout-box" style={{ marginTop: '4px' }}>
                                      <strong>⚠️ Team Lead Revision Request:</strong> {t.review_feedback}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>{t.project_title}</td>
                            <td><span className={`badge badge-${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                            <td><span className={`badge badge-${t.status.toLowerCase().replace('_', '-')}`}>{t.status.replace('_', ' ')}</span></td>
                            <td>{t.due_date || 'N/A'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleOpenTaskDetailModal(t)} title="View Task Details">
                                  <Eye size={14} /> View
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={() => handleOpenReportModal(t)} title="Update / Report Task">
                                  <Send size={14} /> Update / Report
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'leaves' && (
            <AttendanceAndLeavesView role="EMPLOYEE" />
          )}

          {activeTab === 'messenger' && (
            <TeamsMessenger activeTab={activeTab} />
          )}

          {activeTab === 'profile' && (
            <UserProfile />
          )}
        </main>
      </div>

      {/* MODAL: VIEW TASK DETAILS */}
      <Modal isOpen={isDetailModalOpen} onClose={handleCloseTaskDetailModal} title={`Task Details: ${detailTask?.title || ''}`}>
        {detailTask && (
          <div className="task-detail-modal-body">
            {/* Header Info Banner */}
            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  {detailTask.title}
                </h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className={`badge badge-${detailTask.priority?.toLowerCase()}`}>{detailTask.priority}</span>
                  <span className={`badge badge-${detailTask.status?.toLowerCase().replace('_', '-')}`}>{detailTask.status?.replace('_', ' ')}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '0.82rem', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Project: </span>
                  <strong style={{ color: 'var(--primary)' }}>{detailTask.project_title || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Due Date: </span>
                  <strong>{detailTask.due_date || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Assigned By: </span>
                  <strong>
                    {detailTask.assigned_by_details?.first_name
                      ? `${detailTask.assigned_by_details.first_name} ${detailTask.assigned_by_details.last_name}`
                      : (detailTask.assigned_by_details?.username || 'Team Lead / Manager')}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Hours Logged: </span>
                  <strong>{detailTask.hours_logged || '0.00'} hrs</strong>
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Task Description
              </h4>
              <div style={{ background: 'var(--bg-card)', padding: '0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                {detailTask.description || 'No detailed description provided for this task.'}
              </div>
            </div>

            {/* Team Lead Feedback Callout (If Revision Requested) */}
            {detailTask.review_feedback && (
              <div className="feedback-callout-box" style={{ marginBottom: '1.25rem' }}>
                <strong>⚠️ Team Lead Revision Feedback:</strong>
                <div style={{ marginTop: '4px', fontSize: '0.88rem' }}>{detailTask.review_feedback}</div>
              </div>
            )}

            {/* Blockers / Requirements Needed */}
            {detailTask.requirements_needed && (
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, color: '#d97706', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Sparkles size={14} /> Requirements / Blockers Requested:
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{detailTask.requirements_needed}</div>
              </div>
            )}

            {/* Latest Field Visit & Report Details */}
            {(detailTask.visited_person_name || detailTask.selfie_url) && (
              <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} /> Field Visit &amp; Verification Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', fontSize: '0.82rem' }}>
                  {detailTask.visited_person_name && (
                    <div><span style={{ color: 'var(--text-muted)' }}>Visited Person: </span><strong>{detailTask.visited_person_name}</strong></div>
                  )}
                  {detailTask.visited_person_company && (
                    <div><span style={{ color: 'var(--text-muted)' }}>Company: </span><strong>{detailTask.visited_person_company}</strong></div>
                  )}
                  {detailTask.visited_person_email && (
                    <div><span style={{ color: 'var(--text-muted)' }}>Email: </span><strong>{detailTask.visited_person_email}</strong></div>
                  )}
                  {detailTask.visited_person_phone && (
                    <div><span style={{ color: 'var(--text-muted)' }}>Phone: </span><strong>{detailTask.visited_person_phone}</strong></div>
                  )}
                  {detailTask.reporter_name && (
                    <div><span style={{ color: 'var(--text-muted)' }}>Visited By: </span><strong>{detailTask.reporter_name}</strong></div>
                  )}
                </div>

                {detailTask.selfie_url && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={detailTask.selfie_url} alt="Selfie Verification" style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>✓ Selfie Photo Verified</div>
                      <a href={detailTask.selfie_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'underline' }}>View Full Image</a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Task Discussion & Attachments */}
            <TaskDiscussionAndAttachments
              task={detailTask}
              onTaskUpdated={(updated) => {
                setDetailTask(updated);
                setAssignedTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
              }}
            />

            {/* Action Toolbar */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCloseTaskDetailModal}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleCloseTaskDetailModal();
                  handleOpenReportModal(detailTask);
                }}
              >
                <Send size={15} /> Update / Report This Task
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: REPORT / UPDATE TASK & FIELD VISIT */}
      <Modal isOpen={isReportModalOpen} onClose={handleCloseReportModal} title={`Field Visit & Task Report Form: ${selectedTask?.title}`}>
        <form onSubmit={handleReportTaskSubmit}>
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {selectedTask?.review_feedback && (
            <div className="feedback-callout-box" style={{ marginBottom: '1.25rem' }}>
              <strong>⚠️ Team Lead Revision Feedback:</strong>
              <div style={{ marginTop: '2px' }}>{selectedTask.review_feedback}</div>
            </div>
          )}

          {/* Section 1: Details of Visited Person (Client / Contact) */}
          <div style={{ background: 'var(--bg-input)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} /> Details of Visited Person / Client Contact
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Visited Person Name *</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                  placeholder="e.g. John Smith (Client Lead)"
                  value={reportForm.visited_person_name}
                  onChange={(e) => setReportForm({ ...reportForm, visited_person_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Visited Person Email</label>
                <input
                  type="email"
                  className="form-input"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                  placeholder="john@clientcorp.com"
                  value={reportForm.visited_person_email}
                  onChange={(e) => setReportForm({ ...reportForm, visited_person_email: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Visited Person Phone</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                  placeholder="e.g. +1 555-0199"
                  value={reportForm.visited_person_phone}
                  onChange={(e) => setReportForm({ ...reportForm, visited_person_phone: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Company / Role</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                  placeholder="e.g. Acme Corp / CTO"
                  value={reportForm.visited_person_company}
                  onChange={(e) => setReportForm({ ...reportForm, visited_person_company: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Visiting Employee Identification */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>Assigned Employee (Visit Conducted By)</label>
            <input
              type="text"
              className="form-input"
              value={reportForm.reporter_name}
              onChange={(e) => setReportForm({ ...reportForm, reporter_name: e.target.value })}
              required
            />
          </div>

          {/* Section 3: Task Status */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Task Status *</label>
            <select
              className="form-select"
              value={reportForm.status}
              onChange={(e) => setReportForm({ ...reportForm, status: e.target.value })}
              required
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="NEEDS_REVISION">Needs Revision</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          {/* Section 5: Requirements / Assistance Needed */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} color="#f59e0b" />
              <span>Requirements Needed / Blockers (Optional)</span>
            </label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Specify any software licenses, hardware, server credentials, or unblocking needed from Team Lead..."
              value={reportForm.requirements_needed}
              onChange={(e) => setReportForm({ ...reportForm, requirements_needed: e.target.value })}
            />
          </div>

          {/* Section 6: Verification Selfie / Photo with Visited Person */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={14} color="var(--primary)" />
              <span>Selfie Photo Verification (With Visited Person) *</span>
            </label>

            <div style={{ background: 'var(--bg-input)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {cameraError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-rose)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '10px' }}>
                  {cameraError}
                </div>
              )}

              {isCameraActive ? (
                <div style={{ textAlign: 'center' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', maxHeight: '220px', borderRadius: '6px', background: '#000', objectFit: 'cover' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={captureSnapshot}>
                      <Camera size={14} /> Snap Photo
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={stopCamera}>
                      Close Camera
                    </button>
                  </div>
                </div>
              ) : selfiePreview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <img src={selfiePreview} alt="Selfie preview" style={{ width: '75px', height: '75px', borderRadius: '8px', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>✓ Selfie Photo Attached</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={startCamera}>
                        <RefreshCw size={12} /> Open Camera
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSelfieFile(null); setSelfiePreview(null); }}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={startCamera}>
                    <Camera size={14} /> Open Live Webcam
                  </button>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>OR</span>
                  <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                    <Upload size={14} /> Take Photo / Upload Selfie File
                    <input type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={handleSelfieFileChange} />
                  </label>
                </div>
              )}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', padding: '0.85rem' }}>
            <Send size={16} /> Submit Task &amp; Visit Report Form
          </button>
        </form>
      </Modal>

    </div>
  );
};

export default EmployeeDashboard;
