import React, { useState, useEffect } from 'react';
import './TeamLeadDashboard.css';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useMessenger } from '../context/MessengerContext';
import { useNotification } from '../context/NotificationContext';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import TeamsMessenger from './TeamsMessenger';
import UserProfile from './UserProfile';
import {
  Briefcase, Users, CheckSquare, UserPlus, UserMinus, Plus, Clock,
  Calendar, Award, CheckCircle, FileText, ChevronRight, TrendingUp, Star, Zap, Activity, ArrowLeft, ExternalLink, Image, MessageSquare, User, X, Camera, CalendarCheck
} from 'lucide-react';
import TaskDiscussionAndAttachments from '../components/TaskDiscussionAndAttachments';
import AttendanceAndLeavesView from '../components/AttendanceAndLeavesView';
import { LinearProgressBar, RadialProgressRing, SegmentedTaskBar } from '../components/ProgressBar';
import { SkeletonCard, SkeletonStats, SkeletonTable } from '../components/Skeleton';
import Spinner from '../components/Spinner';

const TeamLeadDashboard = () => {
  const { requestLogout } = useAuth();
  const { unreadCount } = useMessenger();
  const { showSuccess, showError, showWarning, showConfirm } = useNotification();
  const [assignedProjects, setAssignedProjects] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

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

  // Modals
  const [isHireModalOpen, setIsHireModalOpen] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isAssignTaskModalOpen, setIsAssignTaskModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedProjectDetail, setSelectedProjectDetail] = useState(null);
  const [selectedReviewTask, setSelectedReviewTask] = useState(null);
  const [perfProjectFilter, setPerfProjectFilter] = useState('ALL');

  const [reviewForm, setReviewForm] = useState({
    action: 'REVISE',
    review_feedback: '',
    assigned_to: '',
    priority: 'MEDIUM'
  });

  const handleOpenReviewModal = (task) => {
    setSelectedReviewTask(task);
    setReviewForm({
      action: task.status === 'COMPLETED' ? 'APPROVE' : 'REVISE',
      review_feedback: task.review_feedback || '',
      assigned_to: task.assigned_to || '',
      priority: task.priority || 'MEDIUM'
    });
    setIsReviewModalOpen(true);
  };

  const handleReviewTaskSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReviewTask) return;
    try {
      await api.post(`/tasks/${selectedReviewTask.id}/review-task/`, reviewForm);
      const actionLabel = reviewForm.action === 'APPROVE' ? 'Approved & Completed' : 'Returned for Revision';
      const taskTitle = selectedReviewTask.title;
      setIsReviewModalOpen(false);
      setSelectedReviewTask(null);
      fetchTeamLeadData();
      showSuccess({
        title: 'Task Review Submitted',
        message: `Task "${taskTitle}" has been ${actionLabel.toLowerCase()}.`,
        details: [
          `Decision: ${actionLabel}`,
          reviewForm.rating ? `Performance Rating: ${reviewForm.rating} / 5 Stars` : null,
          reviewForm.review_notes ? `Notes: ${reviewForm.review_notes}` : null
        ].filter(Boolean)
      });
    } catch (err) {
      showError({
        title: 'Review Submission Failed',
        message: 'Could not submit task review.',
        error: err
      });
    }
  };

  const handleViewProjectDetail = (proj) => {
    setSelectedProjectDetail(proj);
    setActiveTab('project-detail');
  };

  // Helper: Extract unique hired employees across all projects assigned to this Team Lead
  const getHiredTeamMembers = () => {
    const map = new Map();
    assignedProjects.forEach(proj => {
      if (proj.members && Array.isArray(proj.members)) {
        proj.members.forEach(m => {
          const emp = m.employee_details;
          if (emp) {
            const empId = emp.id || m.employee || emp.username;
            if (empId) {
              if (!map.has(empId)) {
                map.set(empId, {
                  ...emp,
                  id: empId,
                  teams: [{ projectId: proj.id, projectTitle: proj.title, roleInTeam: m.role_in_team }]
                });
              } else {
                const existing = map.get(empId);
                if (!existing.teams.some(t => t.projectId === proj.id)) {
                  existing.teams.push({ projectId: proj.id, projectTitle: proj.title, roleInTeam: m.role_in_team });
                }
              }
            }
          }
        });
      }
    });
    return Array.from(map.values());
  };

  // Forms
  const [hireForm, setHireForm] = useState({ employee_id: '', role_in_team: 'Software Engineer' });
  const [addTaskForm, setAddTaskForm] = useState({
    title: '',
    description: '',
    project: '',
    priority: 'MEDIUM',
    due_date: ''
  });
  const [assignTaskForm, setAssignTaskForm] = useState({
    project: '',
    task_id: '',
    assigned_to: ''
  });

  const fetchTeamLeadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [projRes, empRes, taskRes] = await Promise.all([
        api.get('/projects/'),
        api.get('/users/?role=EMPLOYEE'),
        api.get('/tasks/'),
      ]);

      setAssignedProjects(projRes.data);
      setAvailableEmployees(empRes.data);
      setTeamTasks(taskRes.data);
    } catch (err) {
      console.error('Error fetching Team Lead data:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamLeadData();
    const interval = setInterval(() => {
      fetchTeamLeadData(true);
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
    } else if (tabParam && ['overview', 'projects', 'performance', 'tasks', 'attendance_leaves'].includes(tabParam)) {
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
    { id: 'projects', label: 'My Projects', icon: Briefcase, count: assignedProjects.length },
    { id: 'performance', label: 'Team Performance', icon: TrendingUp },
    { id: 'tasks', label: 'Task Delegation', icon: CheckSquare, count: teamTasks.length },
    { id: 'attendance_leaves', label: 'Attendance & Leaves', icon: CalendarCheck },
    { id: 'messenger', label: 'Teams Messenger', icon: MessageSquare, count: unreadCount || undefined },
    { id: 'profile', label: 'My Profile', icon: User },
  ];

  const handleHireEmployee = async (e) => {
    e.preventDefault();
    if (!selectedProject || !hireForm.employee_id) return;
    const emp = availableEmployees.find(u => String(u.id) === String(hireForm.employee_id));
    const empName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username : 'Employee';
    const projTitle = selectedProject.title;
    try {
      await api.post(`/projects/${selectedProject.id}/add-member/`, hireForm);
      setIsHireModalOpen(false);
      const chosenRole = hireForm.role_in_team || 'Software Engineer';
      setHireForm({ employee_id: '', role_in_team: 'Software Engineer' });
      fetchTeamLeadData();
      showSuccess({
        title: 'Team Member Allocated',
        message: `${empName} has been assigned to "${projTitle}".`,
        details: [
          `Employee: ${empName}`,
          `Project: ${projTitle}`,
          `Role in Team: ${chosenRole}`
        ]
      });
    } catch (err) {
      showError({
        title: 'Allocation Failed',
        message: 'Could not allocate employee to project.',
        error: err
      });
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!addTaskForm.project || !addTaskForm.title) return;
    const proj = assignedProjects.find(p => String(p.id) === String(addTaskForm.project));
    const projTitle = proj ? proj.title : 'Project';
    const taskTitle = addTaskForm.title;
    try {
      await api.post('/tasks/', {
        title: addTaskForm.title,
        description: addTaskForm.description,
        project: addTaskForm.project,
        priority: addTaskForm.priority,
        due_date: addTaskForm.due_date,
        assigned_to: null,
      });
      setIsAddTaskModalOpen(false);
      const chosenPriority = addTaskForm.priority;
      const chosenDueDate = addTaskForm.due_date;
      setAddTaskForm({ title: '', description: '', project: '', priority: 'MEDIUM', due_date: '' });
      fetchTeamLeadData();
      showSuccess({
        title: 'Task Created Successfully',
        message: `Task "${taskTitle}" has been added to ${projTitle}.`,
        details: [
          `Project: ${projTitle}`,
          `Priority: ${chosenPriority}`,
          chosenDueDate ? `Due Date: ${chosenDueDate}` : null
        ].filter(Boolean)
      });
    } catch (err) {
      showError({
        title: 'Task Creation Failed',
        message: 'Could not create new task.',
        error: err
      });
    }
  };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!assignTaskForm.task_id) return;
    const targetTask = teamTasks.find(t => String(t.id) === String(assignTaskForm.task_id));
    const targetEmp = targetTask?.project_details?.team_members?.find(m => String(m.id) === String(assignTaskForm.assigned_to))
      || availableEmployees.find(m => String(m.id) === String(assignTaskForm.assigned_to));
    const empName = targetEmp ? `${targetEmp.first_name || ''} ${targetEmp.last_name || ''}`.trim() || targetEmp.username : (assignTaskForm.assigned_to ? 'Team Member' : 'Unassigned');
    const taskTitle = targetTask ? targetTask.title : 'Task';

    try {
      await api.patch(`/tasks/${assignTaskForm.task_id}/`, {
        assigned_to: assignTaskForm.assigned_to ? assignTaskForm.assigned_to : null
      });
      setIsAssignTaskModalOpen(false);
      const isUnassigning = !assignTaskForm.assigned_to;
      setAssignTaskForm({ project: '', task_id: '', assigned_to: '' });
      fetchTeamLeadData();
      showSuccess({
        title: 'Task Assignment Updated',
        message: isUnassigning 
          ? `Task "${taskTitle}" has been unassigned.`
          : `Task "${taskTitle}" assigned to ${empName}.`,
        details: [
          `Task: ${taskTitle}`,
          `Assigned To: ${empName}`
        ]
      });
    } catch (err) {
      showError({
        title: 'Assignment Failed',
        message: 'Could not update task assignment.',
        error: err
      });
    }
  };

  const handleRemoveMember = (projectId, employeeId, employeeName) => {
    showConfirm({
      title: 'Remove Team Member',
      message: `Are you sure you want to remove ${employeeName} from this project team?`,
      details: [
        'Employee will be unassigned from incomplete tasks.',
        'They will be freed up and available for allocation to other projects.'
      ],
      confirmText: 'Remove Member',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await api.post(`/projects/${projectId}/remove-member/`, { employee_id: employeeId });
          fetchTeamLeadData();
          if (selectedProjectDetail && selectedProjectDetail.id === projectId) {
            const updatedRes = await api.get(`/projects/${projectId}/`);
            setSelectedProjectDetail(updatedRes.data);
          }
          showSuccess({
            title: 'Team Member Removed',
            message: `${employeeName} has been successfully removed from the project team.`
          });
        } catch (err) {
          showError({
            title: 'Removal Failed',
            message: 'Could not remove member from project.',
            error: err
          });
        }
      }
    });
  };

  const handleUpdateProjectStatus = async (projectId, newStatus) => {
    try {
      await api.patch(`/projects/${projectId}/`, { status: newStatus });
      fetchTeamLeadData();
      if (selectedProjectDetail && selectedProjectDetail.id === projectId) {
        const updatedRes = await api.get(`/projects/${projectId}/`);
        setSelectedProjectDetail(updatedRes.data);
      }
      if (newStatus === 'COMPLETED') {
        showSuccess({
          title: 'Project Completed! 🎉',
          message: 'Project has been marked as COMPLETED successfully.',
          details: [
            'All team members have been released and are now available for other project assignments.',
            'Project milestone is archived and recorded in performance metrics.'
          ]
        });
      } else {
        showSuccess({
          title: 'Project Status Updated',
          message: `Project status has been updated to ${newStatus}.`
        });
      }
    } catch (err) {
      showError({
        title: 'Status Update Failed',
        message: 'Could not update project status.',
        error: err
      });
    }
  };

  if (loading) {
    return (
      <div className="layout-wrapper">
        <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} navItems={navItems} />
        <div className="layout-main-area">
          <main className="main-content" style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ width: '240px', height: '28px', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', marginBottom: '8px' }} />
              <div style={{ width: '350px', height: '16px', background: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
            </div>
            <SkeletonStats count={4} />
            <div style={{ marginTop: '2rem' }}>
              <SkeletonTable rows={4} />
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
          {/* Dynamic Page Header Banner - hidden on messenger, profile & project-detail tabs */}
          {activeTab !== 'messenger' && activeTab !== 'profile' && activeTab !== 'project-detail' && (
            <div className="tl-header">
              <div className="tl-title-group">
                {activeTab === 'overview' && (
                  <>
                    <h1>Team Lead Workspace</h1>
                    <p>Overview summary, active project metrics &amp; team performance</p>
                  </>
                )}
                {activeTab === 'projects' && (
                  <>
                    <h1>My Assigned Projects</h1>
                    <p>Project oversight, team allocation &amp; hiring active employees</p>
                  </>
                )}
                {activeTab === 'performance' && (
                  <>
                    <h1>Hired Team Members Performance Board</h1>
                    <p>Real-time task completion progress, velocity metrics &amp; team allocation</p>
                  </>
                )}
                {activeTab === 'tasks' && (
                  <>
                    <h1>Task Delegation &amp; Progress Board</h1>
                    <p>Separate project task delegation tables &amp; employee progress tracking</p>
                  </>
                )}
                {activeTab === 'attendance_leaves' && (
                  <>
                    <h1>Attendance &amp; Team Leave Management</h1>
                    <p>Daily shift punch, team attendance roster &amp; leave request approvals</p>
                  </>
                )}
              </div>

              {(activeTab === 'performance' || activeTab === 'tasks') && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setIsAssignTaskModalOpen(true)}>
                    <UserPlus size={16} /> Assign Task
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: OVERVIEW SUMMARY */}
          {activeTab === 'overview' && (
            <>
              {/* Top Summary Metrics */}
              <div className="metrics-grid">
                <div
                  className="glass-card metric-card interactive"
                  onClick={() => setActiveTab('projects')}
                  title="Click to view My Assigned Projects"
                >
                  <div className="metric-icon icon-cyan"><Briefcase size={24} /></div>
                  <div>
                    <div className="metric-value">{assignedProjects.length}</div>
                    <div className="metric-label">Assigned Projects</div>
                    <div className="metric-action-hint">View Projects <ChevronRight size={12} /></div>
                  </div>
                </div>

                <div
                  className="glass-card metric-card interactive"
                  onClick={() => setActiveTab('tasks')}
                  title="Click to view Team Tasks"
                >
                  <div className="metric-icon icon-purple"><CheckSquare size={24} /></div>
                  <div>
                    <div className="metric-value">{teamTasks.length}</div>
                    <div className="metric-label">Active Team Tasks</div>
                    <div className="metric-action-hint">View Tasks <ChevronRight size={12} /></div>
                  </div>
                </div>

                <div
                  className="glass-card metric-card interactive"
                  onClick={() => setActiveTab('tasks')}
                  title="Click to view Completed Tasks"
                >
                  <div className="metric-icon icon-emerald"><CheckCircle size={24} /></div>
                  <div>
                    <div className="metric-value">{teamTasks.filter(t => t.status === 'COMPLETED').length}</div>
                    <div className="metric-label">Completed Tasks</div>
                    <div className="metric-action-hint">View Tasks <ChevronRight size={12} /></div>
                  </div>
                </div>
              </div>

              {/* Projects Overview */}
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                Active Assigned Projects
              </h2>

              {assignedProjects.length === 0 ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No projects have been assigned to you by the Manager yet.
                </div>
              ) : (
                <div className="projects-grid">
                  {assignedProjects.map((project) => {
                    const progressPct = project.progress_percentage ?? (project.task_count ? Math.round((project.completed_task_count / project.task_count) * 100) : 0);
                    return (
                      <div key={project.id} className="glass-card project-card" style={{ cursor: 'pointer' }} onClick={() => handleViewProjectDetail(project)}>
                        <div>
                          <div className="project-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
                            <div style={{ flex: 1, minWidth: '180px' }}>
                              <h3 className="project-title" style={{ color: 'var(--primary)', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{project.title}</h3>
                              <div className="project-client-name" style={{ marginTop: '4px' }}>
                                Client: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{project.client_details?.name || 'N/A'}</span>
                              </div>
                            </div>
                            <span className={`badge badge-${project.status.toLowerCase().replace('_', '-')}`} style={{ flexShrink: 0 }}>
                              {project.status}
                            </span>
                          </div>

                          <p className="project-desc" style={{ minHeight: '2.4rem', margin: '0.75rem 0 1rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {project.description && project.description.trim().length > 3 ? project.description : 'Active project assigned for team lead management, milestone tracking, and task delegation.'}
                          </p>

                          <div style={{ margin: '1rem 0 0.5rem 0' }}>
                            <LinearProgressBar progress={progressPct} showLabel={true} height={8} />
                          </div>
                        </div>

                        <div className="project-card-footer">
                          <span>Tasks Completed: <strong style={{ color: 'var(--accent-emerald)' }}>{project.completed_task_count} / {project.task_count}</strong></span>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', fontWeight: 700 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewProjectDetail(project);
                            }}
                          >
                            Open Project Page →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* TAB 2: ASSIGNED PROJECTS & TEAM HIRING */}
          {activeTab === 'projects' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                My Assigned Projects & Team Allocation
              </h2>

              {assignedProjects.length === 0 ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No projects have been assigned to you by the Manager yet.
                </div>
              ) : (
                <div className="projects-grid">
                  {assignedProjects.map((project) => {
                    const progressPct = project.progress_percentage ?? (project.task_count ? Math.round((project.completed_task_count / project.task_count) * 100) : 0);
                    return (
                      <div key={project.id} className="glass-card project-card" style={{ cursor: 'pointer' }} onClick={() => handleViewProjectDetail(project)}>
                        <div>
                          <div className="project-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
                            <div style={{ flex: 1, minWidth: '180px' }}>
                              <h3 className="project-title" style={{ color: 'var(--primary)', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>{project.title}</h3>
                              <div className="project-client-name" style={{ marginTop: '4px' }}>
                                Client: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{project.client_details?.name || 'N/A'}</span>
                              </div>
                            </div>
                            <RadialProgressRing progress={progressPct} size={54} strokeWidth={6} />
                          </div>

                          <p className="project-desc" style={{ minHeight: '2.2rem', margin: '0.5rem 0 1rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {project.description && project.description.trim().length > 3 ? project.description : 'Active project assigned for team lead management, milestone tracking, and task delegation.'}
                          </p>

                          {/* Team Roster Section */}
                          <div className="team-roster-box" onClick={(e) => e.stopPropagation()}>
                            <div className="team-roster-header">
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                Project Team Members ({project.members?.length || 0})
                              </span>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProject(project);
                                  setIsHireModalOpen(true);
                                }}
                              >
                                <UserPlus size={14} /> Hire Employee
                              </button>
                            </div>

                            {project.members && project.members.length > 0 ? (
                              <div className="team-members-chips">
                                {project.members.map((m) => {
                                  const emp = m.employee_details || {};
                                  const empId = emp.id || m.employee;
                                  const empName = emp.first_name ? `${emp.first_name} ${emp.last_name}` : (emp.username || 'Employee');
                                  return (
                                    <div key={m.id} className="member-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.8rem', boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)' }}>
                                      <User size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{empName}</span>
                                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', background: 'var(--bg-input)', padding: '1px 6px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>{m.role_in_team}</span>
                                      <button
                                        type="button"
                                        title={`Remove ${empName} from team`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveMember(project.id, empId, empName);
                                        }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'inline-flex', alignItems: 'center', padding: '2px', marginLeft: '4px' }}
                                      >
                                        <UserMinus size={13} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                                No employees hired to this project team yet. Click "Hire Employee" above.
                              </div>
                            )}
                          </div>

                          <div style={{ margin: '0.75rem 0' }}>
                            <LinearProgressBar progress={progressPct} showLabel={true} height={6} />
                          </div>
                        </div>

                        <div className="project-card-footer">
                          <span>Tasks Completed: <strong style={{ color: 'var(--accent-emerald)' }}>{project.completed_task_count} / {project.task_count}</strong></span>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewProjectDetail(project);
                            }}
                          >
                            Open Project Page →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: SEPARATE DEDICATED PROJECT DETAIL PAGE VIEW */}
          {activeTab === 'project-detail' && selectedProjectDetail && (
            <div className="glass-card tab-content-card" style={{ padding: '1.5rem' }}>
              {/* Top Navigation Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveTab('projects')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  <ArrowLeft size={16} /> Back to Projects
                </button>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {selectedProjectDetail.status !== 'COMPLETED' ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)', fontWeight: 700 }}
                      onClick={() => handleUpdateProjectStatus(selectedProjectDetail.id, 'COMPLETED')}
                      title="Mark project completed and release team members"
                    >
                      <CheckCircle size={14} /> Complete Project &amp; Release Team
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontWeight: 600 }}
                      onClick={() => handleUpdateProjectStatus(selectedProjectDetail.id, 'ACTIVE')}
                    >
                      Reopen Project (Active)
                    </button>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setSelectedProject(selectedProjectDetail);
                      setIsHireModalOpen(true);
                    }}
                  >
                    <UserPlus size={14} /> Hire Employee
                  </button>
                </div>
              </div>

              {/* Main Project Overview Card (Without Budget & Without Client Personal Info) */}
              <div style={{ background: 'var(--bg-input, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                        {selectedProjectDetail.title}
                      </h1>
                      <span className={`badge badge-${selectedProjectDetail.status.toLowerCase().replace('_', '-')}`} style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                        {selectedProjectDetail.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 600 }}>
                      Client Company: <strong style={{ color: 'var(--primary)' }}>{selectedProjectDetail.client_details?.name || 'N/A'}</strong>
                    </div>
                  </div>

                  {/* Completion Progress Ring */}
                  {(() => {
                    const prog = selectedProjectDetail.progress_percentage ?? (selectedProjectDetail.task_count ? Math.round((selectedProjectDetail.completed_task_count / selectedProjectDetail.task_count) * 100) : 0);
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <RadialProgressRing progress={prog} size={64} strokeWidth={7} />
                        <div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>{prog}% Completed</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{selectedProjectDetail.completed_task_count || 0} / {selectedProjectDetail.task_count || 0} Tasks Completed</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Project Description */}
                {selectedProjectDetail.description && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color, #e2e8f0)', fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: '1.55' }}>
                    <strong style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>Project Specifications & Description</strong>
                    {selectedProjectDetail.description}
                  </div>
                )}

                {/* Schedule Dates & PDF Documentation Link */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color, #e2e8f0)', alignItems: 'center' }}>
                  {selectedProjectDetail.start_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <Calendar size={16} color="var(--primary)" />
                      <span>Start Date: <strong style={{ color: 'var(--text-main)' }}>{selectedProjectDetail.start_date}</strong></span>
                    </div>
                  )}
                  {selectedProjectDetail.end_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <Clock size={16} color="var(--accent-amber)" />
                      <span>Target Deadline: <strong style={{ color: 'var(--text-main)' }}>{selectedProjectDetail.end_date}</strong></span>
                    </div>
                  )}
                  {selectedProjectDetail.pdf_url && (
                    <a
                      href={selectedProjectDetail.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-pdf-link"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      <FileText size={14} color="#e11d48" /> View PDF Documentation
                    </a>
                  )}
                </div>
              </div>

              {/* 2-Column Section Grid: Team Roster & Tasks Board */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                
                {/* COLUMN 1: PROJECT TEAM MEMBERS LIST */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={18} color="var(--primary)" /> Project Team Members ({selectedProjectDetail.members?.length || 0})
                    </h3>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => {
                        setSelectedProject(selectedProjectDetail);
                        setIsHireModalOpen(true);
                      }}
                    >
                      <UserPlus size={13} /> Hire Member
                    </button>
                  </div>

                  {selectedProjectDetail.members && selectedProjectDetail.members.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {selectedProjectDetail.members.map((m) => {
                        const emp = m.employee_details || {};
                        const fullName = emp.first_name ? `${emp.first_name} ${emp.last_name}` : (emp.username || 'Employee');
                        const initials = (emp.first_name && emp.last_name) ? `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase() : (emp.username ? emp.username.slice(0, 2).toUpperCase() : 'EM');
                        return (
                          <div key={m.id} style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--accent-violet))', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                                {initials}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{fullName}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {m.role_in_team} • {emp.designation || 'Engineer'} ({emp.experience_years ? `${emp.experience_years} yrs exp` : '1 yr exp'})
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                                {emp.username}
                              </span>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ color: '#ef4444', borderColor: '#fca5a5', padding: '0.2rem 0.5rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => handleRemoveMember(selectedProjectDetail.id, emp.id || m.employee, fullName)}
                                title="Remove member from project team"
                              >
                                <UserMinus size={13} /> Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ background: 'var(--bg-input, #f8fafc)', border: '1px dashed var(--border-color, #cbd5e1)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No employees hired to this project team yet. Click "Hire Member" above.
                    </div>
                  )}
                </div>

                {/* COLUMN 2: PROJECT TASKS & DELEGATION */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckSquare size={18} color="var(--accent-emerald)" /> Project Tasks ({teamTasks.filter(t => t.project === selectedProjectDetail.id || t.project_details?.id === selectedProjectDetail.id).length})
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        onClick={() => {
                          setAddTaskForm(prev => ({ ...prev, project: selectedProjectDetail.id }));
                          setIsAddTaskModalOpen(true);
                        }}
                      >
                        <Plus size={13} /> Add Task
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        onClick={() => {
                          setAssignTaskForm(prev => ({ ...prev, project: selectedProjectDetail.id, task_id: '', assigned_to: '' }));
                          setIsAssignTaskModalOpen(true);
                        }}
                      >
                        <UserPlus size={13} /> Assign Task
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const projTasks = teamTasks.filter(t => t.project === selectedProjectDetail.id || t.project_details?.id === selectedProjectDetail.id);
                    if (projTasks.length === 0) {
                      return (
                        <div style={{ background: 'var(--bg-input, #f8fafc)', border: '1px dashed var(--border-color, #cbd5e1)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          No tasks created for this project yet. Click "Add Task" to delegate work.
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {projTasks.map(task => {
                          const assignedName = task.assigned_to_details?.first_name 
                            ? `${task.assigned_to_details.first_name} ${task.assigned_to_details.last_name}` 
                            : (task.assigned_to_details?.username || 'Unassigned');
                          return (
                            <div key={task.id} style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>{task.title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>Assigned to: <strong style={{ color: 'var(--accent-cyan)' }}>{assignedName}</strong></span>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', lineHeight: 1.2, borderColor: 'var(--border-color)' }}
                                    title="Mistakenly assigned? Click to reassign to another member"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAssignTaskForm({ project: selectedProjectDetail.id, task_id: task.id, assigned_to: task.assigned_to || '' });
                                      setIsAssignTaskModalOpen(true);
                                    }}
                                  >
                                    Reassign
                                  </button>
                                </div>
                              </div>
                              <span className={`badge badge-${task.status.toLowerCase().replace('_', '-')}`} style={{ fontSize: '0.7rem' }}>
                                {task.status}
                              </span>
                              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: '0.7rem', padding: '0.18rem 0.45rem' }}
                                  title="Reassign task to another team member"
                                  onClick={() => {
                                    setAssignTaskForm({ project: selectedProjectDetail.id, task_id: task.id, assigned_to: task.assigned_to || '' });
                                    setIsAssignTaskModalOpen(true);
                                  }}
                                >
                                  <UserPlus size={12} /> Reassign
                                </button>
                                <button
                                  className="btn btn-primary btn-sm"
                                  style={{ fontSize: '0.7rem', padding: '0.18rem 0.45rem' }}
                                  onClick={() => handleOpenReviewModal(task)}
                                >
                                  <CheckSquare size={12} /> Review
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: TEAM PERFORMANCE & EMPLOYEE TASK PROGRESS */}
          {activeTab === 'performance' && (() => {
            const hiredMembers = getHiredTeamMembers();
            const filteredHiredMembers = hiredMembers.filter(emp => {
              if (perfProjectFilter === 'ALL') return true;
              return emp.teams.some(t => String(t.projectId) === String(perfProjectFilter));
            });

            return (
              <div>


                {/* Project / Team Filter Pills */}
                {assignedProjects.length > 0 && hiredMembers.length > 0 && (
                  <div className="filter-pills-bar" style={{ marginBottom: '1.5rem' }}>
                    <button
                      className={`filter-pill ${perfProjectFilter === 'ALL' ? 'active' : ''}`}
                      onClick={() => setPerfProjectFilter('ALL')}
                    >
                      <Users size={14} /> All Hired Team Members ({hiredMembers.length})
                    </button>
                    {assignedProjects.map(proj => {
                      const countForProj = hiredMembers.filter(emp => emp.teams.some(t => String(t.projectId) === String(proj.id))).length;
                      return (
                        <button
                          key={proj.id}
                          className={`filter-pill ${perfProjectFilter === String(proj.id) ? 'active' : ''}`}
                          onClick={() => setPerfProjectFilter(String(proj.id))}
                        >
                          <Briefcase size={14} /> {proj.title} ({countForProj})
                        </button>
                      );
                    })}
                    {perfProjectFilter !== 'ALL' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setPerfProjectFilter('ALL')} style={{ marginLeft: 'auto', gap: '4px' }}>
                        <X size={14} /> Clear Filter
                      </button>
                    )}
                  </div>
                )}

                {/* EMPTY STATE WHEN NO MEMBERS HIRED YET */}
                {hiredMembers.length === 0 ? (
                  <div className="glass-card" style={{ padding: '3rem 1.5rem', textAlign: 'center', margin: '1rem 0' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                      <Users size={32} />
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                      No Team Members Hired Yet
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.5rem auto', lineHeight: '1.5' }}>
                      Before viewing working performance, please hire active employees into your project teams under the <strong>My Projects</strong> section.
                    </p>
                    <button className="btn btn-primary" onClick={() => setActiveTab('projects')}>
                      <Briefcase size={16} /> Go to My Projects &amp; Hire Team
                    </button>
                  </div>
                ) : filteredHiredMembers.length === 0 ? (
                  <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No team members hired for the selected project team filter.
                  </div>
                ) : (
                  <div className="perf-grid">
                    {filteredHiredMembers.map((emp) => {
                      const empTasks = teamTasks.filter(t => t.assigned_to === emp.id || t.assigned_to_details?.id === emp.id);
                      const completed = empTasks.filter(t => t.status === 'COMPLETED').length;
                      const inReview = empTasks.filter(t => t.status === 'IN_REVIEW').length;
                      const inProgress = empTasks.filter(t => t.status === 'IN_PROGRESS').length;
                      const todo = empTasks.filter(t => t.status === 'TODO').length;
                      const total = empTasks.length;

                      const perfScore = total > 0
                        ? Math.min(100, Math.round(((completed * 100 + inReview * 75 + inProgress * 40) / (total * 100)) * 100))
                        : 0;

                      // Smart, realistic badge and color scheme (no alarming false red)
                      let badgeInfo;
                      let scoreColor = 'var(--text-main)';
                      let ringColor = 'auto';

                      if (total === 0) {
                        badgeInfo = { label: 'Unassigned / Onboarding', icon: Users, color: 'var(--accent-cyan)', bg: 'rgba(2, 132, 199, 0.12)' };
                        scoreColor = 'var(--accent-cyan)';
                        ringColor = 'cyan';
                      } else if (completed === 0) {
                        badgeInfo = { label: 'Pending Tasks', icon: Clock, color: 'var(--accent-amber)', bg: 'rgba(217, 119, 6, 0.12)' };
                        scoreColor = 'var(--accent-amber)';
                        ringColor = 'amber';
                      } else if (perfScore < 50) {
                        badgeInfo = { label: 'Active Progress', icon: Activity, color: 'var(--accent-cyan)', bg: 'rgba(2, 132, 199, 0.12)' };
                        scoreColor = 'var(--accent-cyan)';
                        ringColor = 'cyan';
                      } else if (perfScore < 80) {
                        badgeInfo = { label: 'High Efficiency', icon: Zap, color: 'var(--primary)', bg: 'rgba(99, 102, 241, 0.12)' };
                        scoreColor = 'var(--primary)';
                        ringColor = 'primary';
                      } else {
                        badgeInfo = { label: 'Top Performer', icon: Star, color: 'var(--accent-emerald)', bg: 'rgba(16, 185, 129, 0.12)' };
                        scoreColor = 'var(--accent-emerald)';
                        ringColor = 'emerald';
                      }

                      const BadgeIcon = badgeInfo.icon;
                      const empName = emp.first_name ? `${emp.first_name} ${emp.last_name}` : (emp.username || 'Employee');
                      const initials = emp.first_name ? emp.first_name[0].toUpperCase() : (emp.username ? emp.username[0].toUpperCase() : 'E');

                      return (
                        <div key={emp.id} className="perf-card">
                          <div>
                            <div className="perf-card-header">
                              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                                <div className="perf-avatar">
                                  {initials}
                                </div>
                                <div>
                                  <h3 className="perf-name">{empName}</h3>
                                  <div className="perf-role">{emp.designation || 'Engineer'} • {emp.department || 'Engineering'}</div>
                                </div>
                              </div>

                              <div className="perf-badge" style={{ background: badgeInfo.bg, color: badgeInfo.color, border: `1px solid ${badgeInfo.color}`, padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', width: 'max-content', maxWidth: 'max-content', flexShrink: 0, alignSelf: 'flex-start' }}>
                                <BadgeIcon size={13} /> {badgeInfo.label}
                              </div>
                            </div>

                            {/* TEAM & PROJECT BADGES */}
                            <div className="team-chips-wrapper">
                              {emp.teams.map((t, idx) => (
                                <div key={idx} className="team-chip-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                  <Briefcase size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                  <span style={{ fontWeight: 700 }}>{t.projectTitle}</span>
                                  <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>•</span>
                                  <span className="team-chip-role" style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '1px 6px', borderRadius: '8px' }}>{t.roleInTeam}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="perf-card-body">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem', gap: '1rem', background: 'var(--bg-input)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Working Performance</div>
                                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: scoreColor, marginTop: '2px' }}>{perfScore}% Efficiency</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{completed} of {total} Tasks Completed</div>
                              </div>
                              <RadialProgressRing progress={perfScore} size={64} strokeWidth={6} color={ringColor} />
                            </div>

                            {/* Task breakdown bar */}
                            <div style={{ marginBottom: '1.2rem' }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Task Distribution Breakdown
                              </div>
                              <SegmentedTaskBar completed={completed} inReview={inReview} inProgress={inProgress} todo={todo} total={total} />
                            </div>

                            <div className="perf-metric-bar">
                              <span>Experience Level: <strong style={{ color: 'var(--text-main)', marginLeft: '4px' }}>{emp.experience_years || 1} Yrs</strong></span>
                              <span style={{ marginLeft: 'auto' }}>Assigned Tasks: <strong style={{ color: 'var(--primary)', marginLeft: '4px' }}>{total}</strong></span>
                            </div>

                            {/* Assigned tasks preview */}
                            {empTasks.length > 0 ? (
                              <div className="perf-task-list">
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Assigned Tasks ({empTasks.length})
                                </div>
                                {empTasks.map(task => {
                                  let taskProgress = 0;
                                  if (task.status === 'COMPLETED') taskProgress = 100;
                                  else if (task.status === 'IN_REVIEW') taskProgress = 75;
                                  else if (task.status === 'IN_PROGRESS') taskProgress = 40;

                                  return (
                                    <div key={task.id} className="perf-task-item">
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '2px', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{task.title}</span>
                                        <span className={`badge badge-${task.status.toLowerCase().replace('_', '-')}`} style={{ fontSize: '0.68rem', padding: '2px 7px' }}>{task.status}</span>
                                      </div>
                                      <LinearProgressBar progress={taskProgress} showLabel={false} height={4} />
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', padding: '0.6rem', background: 'var(--bg-input)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                                No tasks currently assigned to this member.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
          {activeTab === 'tasks' && (
            <div>


              {/* Per-Project Task Tables */}
              {(() => {
                // Build unique project list starting with assignedProjects
                const projectList = [...assignedProjects];
                
                // Add any additional projects present in teamTasks
                teamTasks.forEach(t => {
                  const projId = t.project || t.project_details?.id;
                  const projTitle = t.project_title || t.project_details?.title;
                  if (projId && !projectList.some(p => String(p.id) === String(projId))) {
                    projectList.push({
                      id: projId,
                      title: projTitle || `Project #${projId}`,
                      description: '',
                      status: 'ACTIVE'
                    });
                  }
                });

                if (projectList.length === 0 && teamTasks.length === 0) {
                  return (
                    <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No projects or tasks assigned.
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {projectList.map((project) => {
                      const projectTasks = teamTasks.filter(
                        t => String(t.project) === String(project.id) || 
                             String(t.project_details?.id) === String(project.id) ||
                             (t.project_title && t.project_title === project.title)
                      );

                      const completedCount = projectTasks.filter(t => t.status === 'COMPLETED').length;

                      return (
                        <div key={project.id} className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
                          {/* Project Section Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Briefcase size={18} />
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                                    {project.title}
                                  </h3>
                                  {project.status && (
                                    <span className={`badge badge-${project.status.toLowerCase().replace('_', '-')}`} style={{ fontSize: '0.72rem' }}>
                                      {project.status}
                                    </span>
                                  )}
                                </div>
                                {project.client_details?.name && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Client: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{project.client_details.name}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                Tasks: <strong style={{ color: 'var(--accent-emerald)' }}>{completedCount} / {projectTasks.length} Completed</strong>
                              </span>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                                onClick={() => {
                                  setAssignTaskForm({ project: project.id, task_id: '', assigned_to: '' });
                                  setIsAssignTaskModalOpen(true);
                                }}
                              >
                                <UserPlus size={13} /> Assign Task
                              </button>
                            </div>
                          </div>

                          {/* Separate Project Table */}
                          {projectTasks.length === 0 ? (
                            <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--bg-input, #f8fafc)', borderRadius: '8px', border: '1px dashed var(--border-color, #cbd5e1)' }}>
                              No tasks created for this project yet.
                            </div>
                          ) : (
                            <div className="table-container">
                              <table className="custom-table">
                                <thead>
                                  <tr>
                                    <th>Task Title</th>
                                    <th>Assigned Employee</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Visited Person &amp; Selfie Verification</th>
                                    <th>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {projectTasks.map((t) => (
                                    <tr key={t.id}>
                                      <td style={{ fontWeight: 700 }}>
                                        {t.title}
                                        {t.description && (
                                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>{t.description}</div>
                                        )}
                                      </td>
                                      <td style={{ fontWeight: 600 }}>
                                        {t.assigned_to_details ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                            <span style={{ color: 'var(--accent-cyan)' }}>
                                              {t.assigned_to_details.first_name ? `${t.assigned_to_details.first_name} ${t.assigned_to_details.last_name}` : t.assigned_to_details.username}
                                            </span>
                                            <button
                                              className="btn btn-secondary btn-sm"
                                              style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderColor: 'var(--border-color)' }}
                                              title="Mistakenly assigned? Click to reassign to another team member"
                                              onClick={() => {
                                                setAssignTaskForm({ project: project.id, task_id: t.id, assigned_to: t.assigned_to || '' });
                                                setIsAssignTaskModalOpen(true);
                                              }}
                                            >
                                              Reassign
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            className="btn btn-secondary btn-sm"
                                            style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}
                                            onClick={() => {
                                              setAssignTaskForm({ project: project.id, task_id: t.id, assigned_to: '' });
                                              setIsAssignTaskModalOpen(true);
                                            }}
                                          >
                                            + Assign Task
                                          </button>
                                        )}
                                      </td>
                                      <td><span className={`badge badge-${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                                      <td><span className={`badge badge-${t.status.toLowerCase().replace('_', '-')}`}>{t.status.replace('_', ' ')}</span></td>
                                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '280px' }}>
                                        {t.visited_person_name || t.selfie_url || t.completion_report ? (
                                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                            {t.selfie_url && (
                                              <a
                                                href={t.selfie_url.startsWith('http') ? t.selfie_url : `http://localhost:8000${t.selfie_url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Click to view full resolution verification selfie"
                                                style={{ flexShrink: 0, textDecoration: 'none' }}
                                              >
                                                <img
                                                  src={t.selfie_url.startsWith('http') ? t.selfie_url : `http://localhost:8000${t.selfie_url}`}
                                                  alt="Verification Selfie"
                                                  style={{ width: '46px', height: '46px', borderRadius: '8px', objectFit: 'cover', border: '2px solid var(--primary)', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
                                                />
                                              </a>
                                            )}
                                            <div style={{ flex: 1 }}>
                                              {t.visited_person_name && (
                                                <div>
                                                  <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{t.visited_person_name}</strong>
                                                  {t.visited_person_company && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> ({t.visited_person_company})</span>}
                                                </div>
                                              )}
                                              {(t.visited_person_email || t.visited_person_phone) && (
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                                                  {t.visited_person_email || t.visited_person_phone}
                                                </div>
                                              )}
                                              {t.completion_report && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                  "{t.completion_report}"
                                                </div>
                                              )}
                                              {t.requirements_needed && (
                                                <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 600, marginTop: '2px' }}>
                                                  ⚠️ Assistance Requested
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.78rem' }}>Pending report submission</span>
                                        )}
                                        {t.review_feedback && (
                                          <div className="feedback-callout-box" style={{ marginTop: '4px' }}>
                                            <strong>TL Feedback:</strong> {t.review_feedback}
                                          </div>
                                        )}
                                      </td>
                                      <td>
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                          onClick={() => handleOpenReviewModal(t)}
                                        >
                                          <CheckSquare size={13} /> Review / Reassign
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'attendance_leaves' && (
            <AttendanceAndLeavesView role="TEAM_LEAD" />
          )}

          {activeTab === 'messenger' && (
            <TeamsMessenger activeTab={activeTab} />
          )}

          {activeTab === 'profile' && (
            <UserProfile />
          )}
        </main>
      </div>

      {/* MODAL 1: HIRE / ADD EMPLOYEE TO TEAM */}
      <Modal isOpen={isHireModalOpen} onClose={() => setIsHireModalOpen(false)} title={`Hire Employee to Team: ${selectedProject?.title}`}>
        <form onSubmit={handleHireEmployee}>
          <div className="form-group">
            <label className="form-label">Select Unassigned Employee</label>
            <select className="form-select" value={hireForm.employee_id} onChange={e => setHireForm({...hireForm, employee_id: e.target.value})} required>
              <option value="">-- Choose Employee --</option>
              {availableEmployees
                .filter(emp => emp.is_available !== false && !selectedProject?.members?.some(m => m.employee_details?.id === emp.id))
                .map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name ? `${emp.first_name} ${emp.last_name}` : emp.username} ({emp.designation || 'Engineer'} • {emp.department || 'Engineering'}, {emp.experience_years || 1} yrs exp)
                  </option>
                ))}
            </select>
            {availableEmployees.filter(emp => emp.is_available !== false && !selectedProject?.members?.some(m => m.employee_details?.id === emp.id)).length === 0 && (
              <p style={{ color: 'var(--accent-amber)', fontSize: '0.78rem', marginTop: '0.3rem' }}>
                ⚠️ No unassigned active employees available. Employees currently active in other projects cannot be hired.
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Role in Project Team</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Lead Frontend Engineer, QA Specialist"
              value={hireForm.role_in_team}
              onChange={e => setHireForm({...hireForm, role_in_team: e.target.value})}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={availableEmployees.filter(emp => emp.is_available !== false && !selectedProject?.members?.some(m => m.employee_details?.id === emp.id)).length === 0}
          >
            Confirm Team Allocation
          </button>
        </form>
      </Modal>

      {/* MODAL 2: ADD NEW PROJECT TASK (No Assign To Employee field) */}
      <Modal isOpen={isAddTaskModalOpen} onClose={() => setIsAddTaskModalOpen(false)} title="Add New Project Task">
        <form onSubmit={handleCreateTask}>
          <div className="form-group">
            <label className="form-label">Select Project</label>
            <select
              className="form-select"
              value={addTaskForm.project}
              onChange={e => setAddTaskForm({...addTaskForm, project: e.target.value})}
              required
            >
              <option value="">-- Choose Project --</option>
              {assignedProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Task Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Build API Endpoints, UI Redesign"
              value={addTaskForm.title}
              onChange={e => setAddTaskForm({...addTaskForm, title: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Task instructions and detailed requirements..."
              value={addTaskForm.description}
              onChange={e => setAddTaskForm({...addTaskForm, description: e.target.value})}
            />
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-select"
                value={addTaskForm.priority}
                onChange={e => setAddTaskForm({...addTaskForm, priority: e.target.value})}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
                type="date"
                className="form-input"
                value={addTaskForm.due_date}
                onChange={e => setAddTaskForm({...addTaskForm, due_date: e.target.value})}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            <Plus size={16} /> Create Task
          </button>
        </form>
      </Modal>

      {/* MODAL 3: ASSIGN TASK TO TEAM MEMBER */}
      <Modal isOpen={isAssignTaskModalOpen} onClose={() => setIsAssignTaskModalOpen(false)} title="Assign Task to Team Member">
        <form onSubmit={handleAssignTask}>
          <div className="form-group">
            <label className="form-label">Select Assigned Project</label>
            <select
              className="form-select"
              value={assignTaskForm.project}
              onChange={e => {
                const projId = e.target.value;
                setAssignTaskForm({ project: projId, task_id: '', assigned_to: '' });
              }}
              required
            >
              <option value="">-- Choose Project --</option>
              {assignedProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Select Task to Assign</label>
            <select
              className="form-select"
              value={assignTaskForm.task_id}
              onChange={e => setAssignTaskForm({...assignTaskForm, task_id: e.target.value})}
              required
            >
              <option value="">-- Choose Task --</option>
              {teamTasks
                .filter(t => !assignTaskForm.project || String(t.project) === String(assignTaskForm.project) || String(t.project_details?.id) === String(assignTaskForm.project))
                .map(t => {
                  const assignedName = t.assigned_to_details?.first_name 
                    ? `${t.assigned_to_details.first_name} ${t.assigned_to_details.last_name}` 
                    : (t.assigned_to_details?.username ? t.assigned_to_details.username : 'Unassigned');
                  return (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.project_title || 'Project'}) — Current: {assignedName}
                    </option>
                  );
                })}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Assign To Employee / Team Member</label>
            <select
              className="form-select"
              value={assignTaskForm.assigned_to}
              onChange={e => setAssignTaskForm({...assignTaskForm, assigned_to: e.target.value})}
              required
            >
              <option value="">-- Choose Team Member (or Unassign) --</option>
              {(() => {
                if (assignTaskForm.project) {
                  const proj = assignedProjects.find(p => String(p.id) === String(assignTaskForm.project));
                  if (!proj || !proj.members || proj.members.length === 0) {
                    return null;
                  }
                  return proj.members.map(m => {
                    const emp = m.employee_details || {};
                    const fullName = emp.first_name ? `${emp.first_name} ${emp.last_name}` : (emp.username || 'Employee');
                    return (
                      <option key={emp.id} value={emp.id}>
                        {fullName} ({m.role_in_team})
                      </option>
                    );
                  });
                } else {
                  return getHiredTeamMembers().map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name ? `${emp.first_name} ${emp.last_name}` : emp.username} ({emp.designation || 'Engineer'})
                    </option>
                  ));
                }
              })()}
            </select>

            {assignTaskForm.project && (() => {
              const proj = assignedProjects.find(p => String(p.id) === String(assignTaskForm.project));
              if (proj && (!proj.members || proj.members.length === 0)) {
                return (
                  <p style={{ color: 'var(--accent-amber)', fontSize: '0.78rem', marginTop: '0.35rem' }}>
                    ⚠️ No team members hired into this project team yet. Please hire team members under My Projects first.
                  </p>
                );
              }
              return null;
            })()}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={assignTaskForm.project && (() => {
              const proj = assignedProjects.find(p => String(p.id) === String(assignTaskForm.project));
              return proj && (!proj.members || proj.members.length === 0);
            })()}
          >
            <UserPlus size={16} /> Assign Task
          </button>
        </form>
      </Modal>

      {/* MODAL 4: REVIEW & REASSIGN TASK */}
      <Modal isOpen={isReviewModalOpen} onClose={() => setIsReviewModalOpen(false)} title={`Review & Reassign Task: ${selectedReviewTask?.title}`}>
        <form onSubmit={handleReviewTaskSubmit}>
          {/* Work Report Summary Box */}
          <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Field Visit &amp; Task Report Submission
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Visit Conducted By: <strong style={{ color: 'var(--text-main)' }}>{selectedReviewTask?.reporter_name || (selectedReviewTask?.assigned_to_details?.first_name ? `${selectedReviewTask.assigned_to_details.first_name} ${selectedReviewTask.assigned_to_details.last_name}` : selectedReviewTask?.assigned_to_details?.username)}</strong>
                </div>
              </div>
              {selectedReviewTask?.hours_logged > 0 && (
                <span className="badge badge-active" style={{ fontSize: '0.75rem' }}>
                  ⏱️ {selectedReviewTask.hours_logged} Hours Logged
                </span>
              )}
            </div>

            {/* Submitted Work Summary Notes */}
            {selectedReviewTask?.completion_report && (
              <div style={{ background: 'var(--bg-card)', padding: '0.75rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <FileText size={13} /> Submitted Work Summary &amp; Outcome Notes
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: '1.45', whiteSpace: 'pre-line' }}>
                  {selectedReviewTask.completion_report}
                </div>
              </div>
            )}

            {/* Visited Person Details Box */}
            <div style={{ background: 'var(--bg-card)', padding: '0.75rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <User size={13} /> Visited Person / Client Contact Details
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {selectedReviewTask?.visited_person_name || 'Not specified'}
                {selectedReviewTask?.visited_person_company && <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem' }}> ({selectedReviewTask.visited_person_company})</span>}
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', flexWrap: 'wrap' }}>
                {selectedReviewTask?.visited_person_email && (
                  <span>Email: <strong style={{ color: 'var(--text-main)' }}>{selectedReviewTask.visited_person_email}</strong></span>
                )}
                {selectedReviewTask?.visited_person_phone && (
                  <span>Phone: <strong style={{ color: 'var(--text-main)' }}>{selectedReviewTask.visited_person_phone}</strong></span>
                )}
              </div>
            </div>

            {/* Requirements Needed Callout */}
            {selectedReviewTask?.requirements_needed && (
              <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#d97706', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                  ⚠️ Requirements / Assistance Needed:
                </strong>
                <div>{selectedReviewTask.requirements_needed}</div>
              </div>
            )}

            {/* Selfie Verification Image */}
            {selectedReviewTask?.selfie_url && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Camera size={14} color="var(--primary)" /> Selfie Photo Verification (With Visited Person):
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <a
                    href={selectedReviewTask.selfie_url.startsWith('http') ? selectedReviewTask.selfie_url : `http://localhost:8000${selectedReviewTask.selfie_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <img
                      src={selectedReviewTask.selfie_url.startsWith('http') ? selectedReviewTask.selfie_url : `http://localhost:8000${selectedReviewTask.selfie_url}`}
                      alt="Selfie Verification with Visited Person"
                      style={{ width: '80px', height: '80px', borderRadius: '10px', objectFit: 'cover', border: '2px solid var(--primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer' }}
                    />
                  </a>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ✓ Selfie Photo Verification Attached
                    </div>
                    <a
                      href={selectedReviewTask.selfie_url.startsWith('http') ? selectedReviewTask.selfie_url : `http://localhost:8000${selectedReviewTask.selfie_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}
                    >
                      Click to open full high-res photo <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Task Discussion & Attachments */}
          {selectedReviewTask && (
            <TaskDiscussionAndAttachments
              task={selectedReviewTask}
              onTaskUpdated={(updated) => {
                setSelectedReviewTask(updated);
                setTeamTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
              }}
            />
          )}

          <div className="form-group">
            <label className="form-label">Review Decision</label>
            <select
              className="form-select"
              value={reviewForm.action}
              onChange={e => setReviewForm({ ...reviewForm, action: e.target.value })}
              required
            >
              <option value="APPROVE">✅ Approve Task &amp; Mark Completed</option>
              <option value="REVISE">⚠️ Request Revisions &amp; Reassign (Needs Revision)</option>
            </select>
          </div>

          {reviewForm.action === 'REVISE' && (
            <div className="form-group">
              <label className="form-label">Team Lead Revision &amp; Error Feedback Notes</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Specify exact errors found, requirements to fix, or revision instructions..."
                value={reviewForm.review_feedback}
                onChange={e => setReviewForm({ ...reviewForm, review_feedback: e.target.value })}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Assigned Employee (Reassign or keep current)</label>
            <select
              className="form-select"
              value={reviewForm.assigned_to}
              onChange={e => setReviewForm({ ...reviewForm, assigned_to: e.target.value })}
              required
            >
              <option value="">-- Choose Team Member --</option>
              {(() => {
                const proj = assignedProjects.find(p => String(p.id) === String(selectedReviewTask?.project));
                if (proj && proj.members && proj.members.length > 0) {
                  return proj.members.map(m => {
                    const emp = m.employee_details || {};
                    const fullName = emp.first_name ? `${emp.first_name} ${emp.last_name}` : (emp.username || 'Employee');
                    return (
                      <option key={emp.id} value={emp.id}>
                        {fullName} ({m.role_in_team})
                      </option>
                    );
                  });
                }
                return getHiredTeamMembers().map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name ? `${emp.first_name} ${emp.last_name}` : emp.username} ({emp.designation || 'Engineer'})
                  </option>
                ));
              })()}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Task Priority</label>
            <select
              className="form-select"
              value={reviewForm.priority}
              onChange={e => setReviewForm({ ...reviewForm, priority: e.target.value })}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            <CheckSquare size={16} /> Submit Review Decision
          </button>
        </form>
      </Modal>

    </div>
  );
};

export default TeamLeadDashboard;
