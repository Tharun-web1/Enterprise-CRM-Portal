import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  ChevronLeft, Briefcase, Building2, UserCheck, Calendar, DollarSign,
  CheckCircle, Clock, FileText, Image, FileDown, Eye, User, Award,
  AlertCircle, ChevronRight, MessageSquare, Layers, ShieldCheck, ExternalLink, X
} from 'lucide-react';
import Modal from './Modal';
import TaskDiscussionAndAttachments from './TaskDiscussionAndAttachments';

const ProjectDetailsView = ({ project, onBack, onRefresh }) => {
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [activeTaskTab, setActiveTaskTab] = useState('ALL');
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    const fetchProjectTasks = async () => {
      if (!project?.id) return;
      setLoadingTasks(true);
      try {
        const res = await api.get(`/tasks/?project=${project.id}`);
        setTasks(res.data);
      } catch (err) {
        console.error('Failed to fetch project tasks:', err);
      } finally {
        setLoadingTasks(false);
      }
    };
    fetchProjectTasks();
  }, [project?.id]);

  if (!project) return null;

  const clientName = project.client_details?.name || 'Individual Client';
  const clientCompany = project.client_details?.company || project.client_details?.email || '';
  const leadName = project.team_lead_details
    ? `${project.team_lead_details.first_name || ''} ${project.team_lead_details.last_name || ''}`.trim() || project.team_lead_details.username
    : 'Unassigned';

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const reviewTasks = tasks.filter(t => t.status === 'IN_REVIEW' || t.status === 'NEEDS_REVISION').length;
  const todoTasks = tasks.filter(t => t.status === 'TODO').length;
  const totalLoggedHours = tasks.reduce((sum, t) => sum + (parseFloat(t.hours_logged) || 0), 0);
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : (project.status === 'COMPLETED' ? 100 : 0);

  const filteredTasks = tasks.filter(t => {
    if (activeTaskTab === 'ALL') return true;
    if (activeTaskTab === 'COMPLETED') return t.status === 'COMPLETED';
    if (activeTaskTab === 'IN_PROGRESS') return t.status === 'IN_PROGRESS';
    if (activeTaskTab === 'IN_REVIEW') return t.status === 'IN_REVIEW' || t.status === 'NEEDS_REVISION';
    if (activeTaskTab === 'TODO') return t.status === 'TODO';
    return true;
  });

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {/* Top Header Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          onClick={onBack}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 700 }}
        >
          <ChevronLeft size={18} /> Back to Projects List
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className={`badge badge-${project.status ? project.status.toLowerCase() : 'planning'}`} style={{ fontSize: '0.85rem', padding: '4px 14px' }}>
            {project.status}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Project ID: #{project.id}
          </span>
        </div>
      </div>

      {/* Hero Overview Card */}
      <div className="glass-card" style={{ padding: '2rem', borderRadius: '18px', marginBottom: '1.75rem', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ flex: '1 1 400px' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-heading)' }}>
              {project.title}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
              {project.description || 'No detailed project description provided.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <Building2 size={20} color="var(--primary)" />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Client</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{clientName}</div>
                  {clientCompany && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{clientCompany}</div>}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <UserCheck size={20} color="var(--accent-cyan)" />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Team Lead</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' }}>{leadName}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <Calendar size={20} color="var(--accent-amber)" />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Timeline</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    {project.start_date ? `${project.start_date} → ${project.end_date || 'Ongoing'}` : (project.end_date ? `Due ${project.end_date}` : 'Timeline N/A')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
                <DollarSign size={20} color="var(--accent-emerald)" />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Budget Allocated</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-emerald)' }}>
                    ${parseFloat(project.budget || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Overall Progress Gauge Widget */}
          <div style={{ background: 'var(--card-subtle-bg)', padding: '1.5rem', borderRadius: '14px', minWidth: '240px', textAlign: 'center', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Overall Project Progress
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: progressPct === 100 ? 'var(--accent-emerald)' : 'var(--primary)' }}>
              {progressPct}%
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', margin: '1rem 0 0.75rem 0' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: progressPct === 100 ? 'var(--accent-emerald)' : 'linear-gradient(90deg, #6366f1, #3b82f6)',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {completedTasks} of {totalTasks} Tasks Completed
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        <div className="glass-card metric-card">
          <div className="metric-icon icon-indigo"><CheckCircle size={22} /></div>
          <div>
            <div className="metric-value">{completedTasks} / {totalTasks}</div>
            <div className="metric-label">Completed Tasks</div>
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-icon icon-amber"><Clock size={22} /></div>
          <div>
            <div className="metric-value">{inProgressTasks} In Progress</div>
            <div className="metric-label">{reviewTasks} In Review</div>
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-icon icon-cyan"><User size={22} /></div>
          <div>
            <div className="metric-value">{project.members?.length || 0} Members</div>
            <div className="metric-label">Hired Developers</div>
          </div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-icon icon-emerald"><Layers size={22} /></div>
          <div>
            <div className="metric-value">{totalLoggedHours.toFixed(1)} hrs</div>
            <div className="metric-label">Total Hours Logged</div>
          </div>
        </div>
      </div>

      {/* Section Grid: Team & Documents */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        {/* Hired Team Members Card */}
        <div className="glass-card tab-content-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={20} color="var(--primary)" /> Allocated Team Members ({project.members?.length || 0})
          </h3>
          {project.members && project.members.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {project.members.map(member => (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--card-subtle-bg)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="user-avatar" style={{ width: '36px', height: '36px', fontSize: '0.9rem' }}>
                      {member.employee_details?.first_name ? member.employee_details.first_name[0] : (member.employee_details?.username?.[0] || 'E')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {member.employee_details?.first_name
                          ? `${member.employee_details.first_name} ${member.employee_details.last_name}`
                          : member.employee_details?.username}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {member.employee_details?.designation || member.role_in_team}
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-active" style={{ fontSize: '0.75rem' }}>
                    {member.role_in_team || 'Team Member'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No developers currently allocated to this project.
            </div>
          )}
        </div>

        {/* Project PDF Specs & Mockups Card */}
        <div className="glass-card tab-content-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="var(--accent-amber)" /> PDF Specifications & Mockups
          </h3>

          {/* PDF Spec Attachment */}
          {project.pdf_url ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.25)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={28} color="#f59e0b" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Project Specification PDF</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Official requirements & architecture document</div>
                </div>
              </div>
              <a
                href={project.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FileDown size={14} /> View / Download PDF
              </a>
            </div>
          ) : (
            <div style={{ padding: '0.75rem 1rem', background: 'var(--card-subtle-bg)', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              No PDF Specification document attached.
            </div>
          )}

          {/* Image Mockups Gallery */}
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: 'var(--text-muted)' }}>
            Design Mockups & Screenshots ({project.images?.length || 0})
          </h4>

          {project.images && project.images.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '10px' }}>
              {project.images.map(img => (
                <div
                  key={img.id}
                  onClick={() => setSelectedImage(img.image_url)}
                  style={{ position: 'relative', width: '100%', height: '80px', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.2s' }}
                  className="interactive-img"
                  title="Click to expand mockup"
                >
                  <img src={img.image_url} alt="Mockup" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} className="img-hover-overlay">
                    <Eye size={18} color="#fff" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '0.75rem 1rem', background: 'var(--card-subtle-bg)', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              No image mockups uploaded for this project.
            </div>
          )}
        </div>
      </div>

      {/* Main Tasks & Progress Table Section */}
      <div className="glass-card tab-content-card" style={{ padding: '1.75rem', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
              Project Tasks & Deliverables ({tasks.length})
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Real-time breakdown of work items, assignments, and logged hours
            </p>
          </div>

          {/* Task Status Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', background: 'var(--card-subtle-bg)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
            {[
              { id: 'ALL', label: `All (${totalTasks})` },
              { id: 'IN_PROGRESS', label: `In Progress (${inProgressTasks})` },
              { id: 'IN_REVIEW', label: `In Review (${reviewTasks})` },
              { id: 'COMPLETED', label: `Completed (${completedTasks})` },
              { id: 'TODO', label: `To Do (${todoTasks})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTaskTab(tab.id)}
                style={{
                  border: 'none',
                  background: activeTaskTab === tab.id ? 'var(--primary)' : 'transparent',
                  color: activeTaskTab === tab.id ? '#fff' : 'var(--text-muted)',
                  padding: '5px 12px',
                  borderRadius: '7px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks Table */}
        {loadingTasks ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading project tasks...
          </div>
        ) : filteredTasks.length > 0 ? (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Task Title</th>
                  <th>Assigned To</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Logged Hours</th>
                  <th>Report, Visited Person &amp; Selfie Verification</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(t => {
                  const emp = t.assigned_to_details;
                  const empName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username : 'Unassigned';
                  return (
                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTask(t)}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {t.title}
                          <Eye size={13} color="var(--primary)" />
                        </div>
                        {t.description && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '320px' }}>
                            {t.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}>
                            {empName[0]}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{empName}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${t.priority.toLowerCase()}`} style={{ fontSize: '0.75rem' }}>
                          {t.priority}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${t.status.toLowerCase().replace('_', '-')}`} style={{ fontSize: '0.75rem' }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {t.due_date || 'No due date'}
                      </td>
                      <td style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                        {t.hours_logged ? `${t.hours_logged} hrs` : '0.00 hrs'}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '300px' }}>
                        {t.visited_person_name || t.selfie_url || t.completion_report || t.requirements_needed ? (
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            {t.selfie_url && (
                              <a
                                href={t.selfie_url.startsWith('http') ? t.selfie_url : `http://localhost:8000${t.selfie_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Click to view full verification selfie"
                                style={{ flexShrink: 0, textDecoration: 'none' }}
                              >
                                <img
                                  src={t.selfie_url.startsWith('http') ? t.selfie_url : `http://localhost:8000${t.selfie_url}`}
                                  alt="Selfie Verification"
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
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {t.visited_person_email || t.visited_person_phone}
                                </div>
                              )}
                              {t.completion_report && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', marginTop: '2px', fontStyle: 'italic' }}>
                                  "{t.completion_report}"
                                </div>
                              )}
                              {t.requirements_needed && (
                                <div style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600, marginTop: '2px' }}>
                                  ⚠️ Assistance Requested: {t.requirements_needed}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.78rem' }}>No report notes submitted</span>
                        )}
                        {t.review_feedback && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginTop: '4px', fontWeight: 600 }}>
                            TL Review Feedback: {t.review_feedback}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No tasks match the selected filter tab.
          </div>
        )}
      </div>

      {/* Lightbox Image Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button
              onClick={() => setSelectedImage(null)}
              style={{ position: 'absolute', top: '-40px', right: '0', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={28} />
            </button>
            <img src={selectedImage} alt="Expanded Mockup" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }} />
          </div>
        </div>
      )}
      {/* Task Details & Discussion Modal */}
      {selectedTask && (
        <Modal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          title={`Task: ${selectedTask.title}`}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span className={`badge badge-${selectedTask.priority?.toLowerCase()}`}>{selectedTask.priority}</span>
                <span className={`badge badge-${selectedTask.status?.toLowerCase().replace('_', '-')}`}>{selectedTask.status}</span>
              </div>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Due: {selectedTask.due_date || 'No due date'}
              </span>
            </div>

            {selectedTask.description && (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '1rem', background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '8px' }}>
                {selectedTask.description}
              </p>
            )}

            <TaskDiscussionAndAttachments
              task={selectedTask}
              onTaskUpdated={(updated) => {
                setSelectedTask(updated);
                setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ProjectDetailsView;
