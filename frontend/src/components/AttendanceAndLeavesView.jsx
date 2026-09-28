import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Modal from './Modal';
import {
  Clock, Calendar, CheckCircle2, XCircle, AlertCircle,
  Plus, UserCheck, CalendarCheck, Loader2, FileText, Send,
  Search, Users, History, Check, X, Sparkles, User
} from 'lucide-react';
import './AttendanceAndLeavesView.css';

const AttendanceAndLeavesView = ({ role = 'EMPLOYEE' }) => {
  const { user } = useAuth();
  const { showNotify } = useNotification();

  // Current system local time ticking live every second
  const [currentTime, setCurrentTime] = useState(new Date());

  // Personal punch & attendance states
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [myLeaves, setMyLeaves] = useState([]);
  const [myAttendanceHistory, setMyAttendanceHistory] = useState([]);

  // Modals & form states
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'CASUAL',
    start_date: '',
    end_date: '',
    reason: ''
  });

  // Navigation tab states
  // For Employee: 'attendance' (Punch + History) | 'leaves' (Balances + Applications)
  const [employeeTab, setEmployeeTab] = useState('attendance');

  // For Manager / Team Lead: 'my_attendance' | 'roster' | 'approvals' | 'my_leaves'
  const [activeMgmtTab, setActiveMgmtTab] = useState('my_attendance');

  const [companyOverview, setCompanyOverview] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [rosterSearch, setRosterSearch] = useState('');
  const [leaveFilter, setLeaveFilter] = useState('PENDING'); // 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Common loading state
  const [loading, setLoading] = useState(true);

  // Live wall clock timer
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Fetch personal punch & attendance
  const fetchPersonalData = async () => {
    try {
      const [todayRes, leavesRes, historyRes] = await Promise.all([
        api.get('/attendance/today/'),
        api.get('/leave-requests/?personal=true'),
        api.get('/attendance/?personal=true')
      ]);
      setTodayAttendance(todayRes.data?.id ? todayRes.data : null);
      setMyLeaves(leavesRes.data || []);
      setMyAttendanceHistory(historyRes.data || []);
    } catch (err) {
      console.error('Failed to fetch personal attendance data:', err);
    }
  };

  // Fetch management roster & leave requests
  const fetchManagementData = async () => {
    try {
      const [overviewRes, leavesRes] = await Promise.all([
        api.get('/attendance/company-overview/'),
        api.get('/leave-requests/')
      ]);
      setCompanyOverview(overviewRes.data || []);
      setAllLeaves(leavesRes.data || []);
    } catch (err) {
      console.error('Failed to fetch management attendance data:', err);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    if (role === 'EMPLOYEE') {
      await fetchPersonalData();
    } else {
      await Promise.all([fetchPersonalData(), fetchManagementData()]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, [role]);

  // Live Stopwatch for currently clocked in user
  useEffect(() => {
    let timer = null;
    if (todayAttendance?.is_clocked_in && todayAttendance.clock_in) {
      const updateElapsed = () => {
        const start = new Date(todayAttendance.clock_in).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((now - start) / 1000));
        setElapsedSeconds(diff);
      };
      updateElapsed();
      timer = setInterval(updateElapsed, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [todayAttendance]);

  const formatElapsed = (sec) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return '--:--';
    try {
      return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  // Punch Clock In
  const handleClockIn = async () => {
    try {
      setClockLoading(true);
      const res = await api.post('/attendance/clock-in/');
      setTodayAttendance(res.data.attendance);
      showNotify({
        type: 'success',
        title: 'Clocked In Successfully',
        message: 'Your shift has started! Shift attendance is actively tracked.'
      });
      await loadAllData();
    } catch (err) {
      showNotify({
        type: 'error',
        title: 'Clock In Failed',
        message: err.response?.data?.error || 'Failed to clock in.'
      });
    } finally {
      setClockLoading(false);
    }
  };

  // Punch Clock Out
  const handleClockOut = async () => {
    try {
      setClockLoading(true);
      const res = await api.post('/attendance/clock-out/');
      setTodayAttendance(res.data.attendance);
      showNotify({
        type: 'success',
        title: 'Clocked Out Successfully',
        message: res.data.message || 'You have clocked out for the day.'
      });
      await loadAllData();
    } catch (err) {
      showNotify({
        type: 'error',
        title: 'Clock Out Failed',
        message: err.response?.data?.error || 'Failed to clock out.'
      });
    } finally {
      setClockLoading(false);
    }
  };

  // Submit Leave Request
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason.trim()) {
      showNotify({
        type: 'warning',
        title: 'Required Fields',
        message: 'Please fill in start date, end date, and reason for leave.'
      });
      return;
    }

    const start = new Date(leaveForm.start_date);
    const end = new Date(leaveForm.end_date);
    if (end < start) {
      showNotify({
        type: 'error',
        title: 'Invalid Dates',
        message: 'End date cannot be earlier than start date.'
      });
      return;
    }

    const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

    try {
      setApplySubmitting(true);
      await api.post('/leave-requests/', {
        ...leaveForm,
        days_count: diffDays
      });
      showNotify({
        type: 'success',
        title: 'Leave Request Submitted',
        message: `Your request for ${diffDays} day(s) has been sent for review.`
      });
      setIsApplyModalOpen(false);
      setLeaveForm({
        leave_type: 'CASUAL',
        start_date: '',
        end_date: '',
        reason: ''
      });
      await loadAllData();
    } catch (err) {
      showNotify({
        type: 'error',
        title: 'Application Failed',
        message: err.response?.data?.error || 'Failed to submit leave request.'
      });
    } finally {
      setApplySubmitting(false);
    }
  };

  // Approve Leave Request
  const handleApproveLeave = async (leaveId) => {
    try {
      setActionLoading(true);
      await api.post(`/leave-requests/${leaveId}/approve/`, {
        review_comments: `Approved by ${user?.first_name || user?.username}`
      });
      showNotify({
        type: 'success',
        title: 'Leave Approved',
        message: 'The leave request has been approved and the employee notified.'
      });
      await fetchManagementData();
    } catch (err) {
      showNotify({
        type: 'error',
        title: 'Approval Failed',
        message: err.response?.data?.error || 'Failed to approve request.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Leave Request Modal
  const handleOpenRejectModal = (id) => {
    setRejectingId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      showNotify({
        type: 'warning',
        title: 'Reason Required',
        message: 'Please provide a brief reason for rejecting the leave request.'
      });
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/leave-requests/${rejectingId}/reject/`, {
        review_comments: rejectReason.trim()
      });
      showNotify({
        type: 'success',
        title: 'Leave Rejected',
        message: 'The leave request has been rejected and the employee notified.'
      });
      setRejectModalOpen(false);
      await fetchManagementData();
    } catch (err) {
      showNotify({
        type: 'error',
        title: 'Rejection Failed',
        message: err.response?.data?.error || 'Failed to reject request.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtering for Management
  const filteredRoster = companyOverview.filter(row => {
    if (!rosterSearch) return true;
    const term = rosterSearch.toLowerCase();
    const name = `${row.employee?.first_name || ''} ${row.employee?.last_name || ''} ${row.employee?.username || ''}`.toLowerCase();
    const dept = (row.employee?.department || '').toLowerCase();
    const desig = (row.employee?.designation || '').toLowerCase();
    return name.includes(term) || dept.includes(term) || desig.includes(term);
  });

  const filteredLeaves = allLeaves.filter(req => {
    if (leaveFilter === 'ALL') return true;
    return req.status === leaveFilter;
  });

  const pendingLeavesCount = allLeaves.filter(req => req.status === 'PENDING').length;

  // Render the Hero Attendance Punch Widget
  const renderHeroPunchWidget = () => (
    <div className="attendance-hero-card glass-card">
      <div className="hero-top-row">
        <div className="live-datetime-block">
          <div className="live-clock-time">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="live-clock-date">
            {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="hero-status-pill-box">
          {todayAttendance?.is_clocked_in ? (
            <span className="hero-shift-pill clocked-in">
              <span className="live-ping-dot" />
              🟢 ACTIVE WORKING SHIFT
            </span>
          ) : todayAttendance?.clock_out ? (
            <span className="hero-shift-pill completed">
              ✓ SHIFT COMPLETED TODAY
            </span>
          ) : (
            <span className="hero-shift-pill not-started">
              ⚪ NOT CLOCKED IN TODAY
            </span>
          )}
        </div>
      </div>

      <div className="hero-middle-stats">
        <div className="hero-stat-item">
          <span className="hero-stat-label">Punch Clock In</span>
          <span className="hero-stat-value">
            {todayAttendance?.clock_in ? formatTime(todayAttendance.clock_in) : '--:--'}
          </span>
        </div>
        <div className="hero-stat-item">
          <span className="hero-stat-label">Punch Clock Out</span>
          <span className="hero-stat-value">
            {todayAttendance?.clock_out ? formatTime(todayAttendance.clock_out) : '--:--'}
          </span>
        </div>
        <div className="hero-stat-item">
          <span className="hero-stat-label">Shift Duration</span>
          <span className="hero-stat-value highlight">
            {todayAttendance?.is_clocked_in
              ? formatElapsed(elapsedSeconds)
              : `${Number(todayAttendance?.total_hours || 0).toFixed(2)} hrs`}
          </span>
        </div>
        <div className="hero-stat-item">
          <span className="hero-stat-label">Attendance Status</span>
          <span className="hero-stat-value">
            <span className={`status-pill pill-${(todayAttendance?.status || 'ABSENT').toLowerCase()}`}>
              {todayAttendance?.status || 'ABSENT'}
            </span>
          </span>
        </div>
      </div>

      <div className="hero-actions-row">
        {todayAttendance?.is_clocked_in ? (
          <button
            type="button"
            className="btn-punch punch-out"
            onClick={handleClockOut}
            disabled={clockLoading}
          >
            {clockLoading ? <Loader2 size={18} className="spin-icon" /> : <Clock size={18} />}
            <span>PUNCH CLOCK OUT</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn-punch punch-in"
            onClick={handleClockIn}
            disabled={clockLoading}
          >
            {clockLoading ? <Loader2 size={18} className="spin-icon" /> : <Clock size={18} />}
            <span>{todayAttendance?.clock_out ? 'RESUME SHIFT (PUNCH IN)' : 'PUNCH CLOCK IN'}</span>
          </button>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-apply-leave"
          onClick={() => setIsApplyModalOpen(true)}
        >
          <CalendarCheck size={16} />
          <span>Apply for Leave</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="attendance-leaves-container">
      {/* ROLE TABS BAR */}
      {role === 'EMPLOYEE' ? (
        <div className="mgmt-tabs-header">
          <button
            type="button"
            className={`mgmt-tab-btn ${employeeTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setEmployeeTab('attendance')}
          >
            <Clock size={17} />
            <span>Daily Shift Attendance &amp; Punch</span>
          </button>

          <button
            type="button"
            className={`mgmt-tab-btn ${employeeTab === 'leaves' ? 'active' : ''}`}
            onClick={() => setEmployeeTab('leaves')}
          >
            <CalendarCheck size={17} />
            <span>Leaves &amp; Time Off ({myLeaves.length})</span>
          </button>
        </div>
      ) : (
        <div className="mgmt-tabs-header">
          <button
            type="button"
            className={`mgmt-tab-btn ${activeMgmtTab === 'my_attendance' ? 'active' : ''}`}
            onClick={() => setActiveMgmtTab('my_attendance')}
          >
            <Clock size={17} />
            <span>My Shift Attendance</span>
          </button>

          <button
            type="button"
            className={`mgmt-tab-btn ${activeMgmtTab === 'roster' ? 'active' : ''}`}
            onClick={() => setActiveMgmtTab('roster')}
          >
            <Users size={17} />
            <span>Team Attendance Roster ({companyOverview.length})</span>
          </button>

          <button
            type="button"
            className={`mgmt-tab-btn ${activeMgmtTab === 'approvals' ? 'active' : ''}`}
            onClick={() => setActiveMgmtTab('approvals')}
          >
            <CalendarCheck size={17} />
            <span>Leave Approvals</span>
            {pendingLeavesCount > 0 && <span className="mgmt-tab-badge">{pendingLeavesCount}</span>}
          </button>

          <button
            type="button"
            className={`mgmt-tab-btn ${activeMgmtTab === 'my_leaves' ? 'active' : ''}`}
            onClick={() => setActiveMgmtTab('my_leaves')}
          >
            <Calendar size={17} />
            <span>My Leave Applications</span>
          </button>
        </div>
      )}

      {/* VIEW 1: EMPLOYEE ATTENDANCE TAB (Hero Punch + Attendance History Log) */}
      {role === 'EMPLOYEE' && employeeTab === 'attendance' && (
        <>
          {renderHeroPunchWidget()}

          {/* Section: Attendance History Table */}
          <div className="glass-card section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserCheck size={20} className="section-icon-blue" />
                <div>
                  <h3 className="section-title">My Attendance History Log</h3>
                  <span className="section-subtitle">Record of your daily clock-in punches and work duration</span>
                </div>
              </div>
              {myAttendanceHistory.length > 0 && (
                <span className="section-header-badge">
                  {myAttendanceHistory.length} Day{myAttendanceHistory.length === 1 ? '' : 's'} Logged
                </span>
              )}
            </div>

            {myAttendanceHistory.length === 0 ? (
              <div className="table-empty-box">
                <History size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.35 }} />
                <p>No past attendance records found. Punch Clock In to log today's shift!</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>First Clock In</th>
                      <th>Last Clock Out</th>
                      <th>Total Hours Worked</th>
                      <th>Attendance Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAttendanceHistory.map(att => (
                      <tr key={att.id}>
                        <td>
                          <div className="attendance-date-cell">
                            <Calendar size={14} className="cell-icon-dim" />
                            <span>{att.date}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`punch-time-badge in ${!att.clock_in ? 'empty' : ''}`}>
                            <Clock size={12} />
                            {formatTime(att.clock_in)}
                          </span>
                        </td>
                        <td>
                          <span className={`punch-time-badge out ${!att.clock_out ? 'empty' : ''}`}>
                            <Clock size={12} />
                            {formatTime(att.clock_out)}
                          </span>
                        </td>
                        <td>
                          <span className="hours-worked-badge">
                            {Number(att.total_hours).toFixed(2)} hrs
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill pill-${(att.status || 'ABSENT').toLowerCase()}`}>
                            {att.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW 2: EMPLOYEE LEAVES TAB (Leave Balances + Apply CTA + Leave Applications) */}
      {role === 'EMPLOYEE' && employeeTab === 'leaves' && (
        <>
          {/* Leave Balances Grid */}
          <div className="leave-balances-grid">
            <div className="glass-card leave-balance-card">
              <span className="leave-type-pill casual">Casual Leave</span>
              <div className="leave-balance-val">12</div>
              <span className="leave-balance-sub">Days Allocated / Year</span>
            </div>
            <div className="glass-card leave-balance-card">
              <span className="leave-type-pill sick">Sick Leave</span>
              <div className="leave-balance-val">8</div>
              <span className="leave-balance-sub">Days Allocated / Year</span>
            </div>
            <div className="glass-card leave-balance-card">
              <span className="leave-type-pill annual">Annual Paid</span>
              <div className="leave-balance-val">15</div>
              <span className="leave-balance-sub">Days Allocated / Year</span>
            </div>
          </div>

          {/* Section: My Leave Applications History */}
          <div className="glass-card section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CalendarCheck size={20} className="section-icon-purple" />
                <div>
                  <h3 className="section-title">My Leave Applications</h3>
                  <span className="section-subtitle">Track status and manager review feedback</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsApplyModalOpen(true)}
              >
                <Plus size={14} /> Apply for Leave
              </button>
            </div>

            {myLeaves.length === 0 ? (
              <div className="table-empty-box">
                <p>You haven't submitted any leave requests yet.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Leave Category</th>
                      <th>Dates Requested</th>
                      <th>Duration</th>
                      <th>Reason</th>
                      <th>Review Status</th>
                      <th>Feedback / Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLeaves.map(l => (
                      <tr key={l.id}>
                        <td><strong>{l.leave_type.replace(/_/g, ' ')}</strong></td>
                        <td>{l.start_date} to {l.end_date}</td>
                        <td><span className="badge badge-neutral">{l.days_count} d</span></td>
                        <td><div className="text-truncate-reason">{l.reason}</div></td>
                        <td>
                          <span className={`status-pill pill-${l.status.toLowerCase()}`}>
                            {l.status}
                          </span>
                        </td>
                        <td>{l.review_comments || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW 3: MANAGEMENT MY SHIFT ATTENDANCE TAB */}
      {role !== 'EMPLOYEE' && activeMgmtTab === 'my_attendance' && (
        <>
          {renderHeroPunchWidget()}

          <div className="glass-card section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserCheck size={20} className="section-icon-blue" />
                <div>
                  <h3 className="section-title">My Personal Attendance History</h3>
                  <span className="section-subtitle">Your personal daily punch records and logged hours</span>
                </div>
              </div>
              {myAttendanceHistory.length > 0 && (
                <span className="section-header-badge">
                  {myAttendanceHistory.length} Day{myAttendanceHistory.length === 1 ? '' : 's'} Logged
                </span>
              )}
            </div>

            {myAttendanceHistory.length === 0 ? (
              <div className="table-empty-box">
                <History size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.35 }} />
                <p>No personal attendance records found. Punch Clock In to log your shift!</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Clock In</th>
                      <th>Clock Out</th>
                      <th>Hours Worked</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAttendanceHistory.map(att => (
                      <tr key={att.id}>
                        <td>
                          <div className="attendance-date-cell">
                            <Calendar size={14} className="cell-icon-dim" />
                            <span>{att.date}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`punch-time-badge in ${!att.clock_in ? 'empty' : ''}`}>
                            <Clock size={12} />
                            {formatTime(att.clock_in)}
                          </span>
                        </td>
                        <td>
                          <span className={`punch-time-badge out ${!att.clock_out ? 'empty' : ''}`}>
                            <Clock size={12} />
                            {formatTime(att.clock_out)}
                          </span>
                        </td>
                        <td>
                          <span className="hours-worked-badge">
                            {Number(att.total_hours).toFixed(2)} hrs
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill pill-${(att.status || 'ABSENT').toLowerCase()}`}>
                            {att.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW 4: MANAGEMENT TEAM ROSTER TAB */}
      {role !== 'EMPLOYEE' && activeMgmtTab === 'roster' && (
        <div className="glass-card section-card">
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Users size={22} className="section-icon-emerald" />
              <div>
                <h3 className="section-title">Today's Team Attendance Roster</h3>
                <span className="section-subtitle">Real-time shift presence and logged hours</span>
              </div>
            </div>

            <div className="search-input-box" style={{ maxWidth: '280px' }}>
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="form-input search-field"
                placeholder="Search staff, role, department..."
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="table-empty-box">
              <Loader2 size={24} className="spin-icon" style={{ margin: '0 auto 0.5rem' }} />
              <p>Loading attendance roster...</p>
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="table-empty-box">
              <p>No staff records matching your search.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role / Department</th>
                    <th>Shift Status</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Hours Worked Today</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.map(row => (
                    <tr key={row.employee.id}>
                      <td>
                        <div className="user-table-cell">
                          <div className="user-table-avatar">
                            {row.employee.username[0]?.toUpperCase()}
                            {row.is_clocked_in && <span className="avatar-online-dot" />}
                          </div>
                          <div>
                            <div className="user-table-name">
                              {row.employee.first_name ? `${row.employee.first_name} ${row.employee.last_name || ''}` : row.employee.username}
                            </div>
                            <span className="user-table-role">{row.employee.designation || row.employee.role}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong>{row.employee.department || 'General'}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.employee.role}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill pill-${row.is_clocked_in ? 'present' : row.status.toLowerCase()}`}>
                          {row.is_clocked_in ? 'ACTIVE WORKING' : row.status}
                        </span>
                      </td>
                      <td><strong>{formatTime(row.clock_in)}</strong></td>
                      <td>{formatTime(row.clock_out)}</td>
                      <td>
                        <span className="badge badge-neutral">
                          {Number(row.total_hours).toFixed(2)} hrs
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 5: MANAGEMENT LEAVE APPROVALS TAB */}
      {role !== 'EMPLOYEE' && activeMgmtTab === 'approvals' && (
        <div className="glass-card section-card">
          <div className="section-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CalendarCheck size={22} className="section-icon-purple" />
              <div>
                <h3 className="section-title">Leave Approvals &amp; Applications</h3>
                <span className="section-subtitle">Review, approve, or reject employee leave requests</span>
              </div>
            </div>

            <div className="filter-pills-bar">
              {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(st => (
                <button
                  key={st}
                  type="button"
                  className={`filter-pill-btn ${leaveFilter === st ? 'active' : ''}`}
                  onClick={() => setLeaveFilter(st)}
                >
                  {st === 'ALL' ? 'All Leaves' : st}
                  {st === 'PENDING' && pendingLeavesCount > 0 && ` (${pendingLeavesCount})`}
                </button>
              ))}
            </div>
          </div>

          {filteredLeaves.length === 0 ? (
            <div className="table-empty-box">
              <p>No leave requests in this category.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave Category</th>
                    <th>Dates</th>
                    <th>Duration</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map(req => (
                    <tr key={req.id}>
                      <td>
                        <div className="user-table-cell">
                          <strong>{req.employee_details?.first_name || req.employee_details?.username}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="leave-type-pill casual">
                          {req.leave_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>{req.start_date} to {req.end_date}</td>
                      <td><span className="badge badge-neutral">{req.days_count} d</span></td>
                      <td><div className="text-truncate-reason">{req.reason}</div></td>
                      <td>
                        <span className={`status-pill pill-${req.status.toLowerCase()}`}>
                          {req.status}
                        </span>
                      </td>
                      <td>
                        {req.status === 'PENDING' ? (
                          <div className="table-action-btns">
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={() => handleApproveLeave(req.id)}
                              disabled={actionLoading}
                            >
                              <Check size={12} /> Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-xs"
                              onClick={() => handleOpenRejectModal(req.id)}
                              disabled={actionLoading}
                            >
                              <X size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {req.review_comments || 'Processed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 6: MANAGEMENT MY LEAVES TAB */}
      {role !== 'EMPLOYEE' && activeMgmtTab === 'my_leaves' && (
        <>
          <div className="leave-balances-grid">
            <div className="glass-card leave-balance-card">
              <span className="leave-type-pill casual">Casual Leave</span>
              <div className="leave-balance-val">12</div>
              <span className="leave-balance-sub">Days Allocated / Year</span>
            </div>
            <div className="glass-card leave-balance-card">
              <span className="leave-type-pill sick">Sick Leave</span>
              <div className="leave-balance-val">8</div>
              <span className="leave-balance-sub">Days Allocated / Year</span>
            </div>
            <div className="glass-card leave-balance-card">
              <span className="leave-type-pill annual">Annual Paid</span>
              <div className="leave-balance-val">15</div>
              <span className="leave-balance-sub">Days Allocated / Year</span>
            </div>
          </div>

          <div className="glass-card section-card">
            <div className="section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CalendarCheck size={20} className="section-icon-purple" />
                <h3 className="section-title">My Leave Applications</h3>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsApplyModalOpen(true)}
              >
                <Plus size={14} /> New Application
              </button>
            </div>

            {myLeaves.length === 0 ? (
              <div className="table-empty-box">
                <p>You haven't submitted any leave requests yet.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Leave Type</th>
                      <th>Dates</th>
                      <th>Days</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLeaves.map(l => (
                      <tr key={l.id}>
                        <td><strong>{l.leave_type.replace(/_/g, ' ')}</strong></td>
                        <td>{l.start_date} to {l.end_date}</td>
                        <td><span className="badge badge-neutral">{l.days_count} d</span></td>
                        <td><div className="text-truncate-reason">{l.reason}</div></td>
                        <td>
                          <span className={`status-pill pill-${l.status.toLowerCase()}`}>
                            {l.status}
                          </span>
                        </td>
                        <td>{l.review_comments || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL: APPLY FOR LEAVE */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Apply for Leave"
      >
        <form onSubmit={handleApplyLeave} className="leave-modal-form">
          <div className="form-group">
            <label className="form-label">Leave Category *</label>
            <select
              className="form-input"
              value={leaveForm.leave_type}
              onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
            >
              <option value="CASUAL">Casual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="ANNUAL">Annual Paid Leave</option>
              <option value="MATERNITY_PATERNITY">Maternity / Paternity</option>
              <option value="UNPAID">Loss of Pay (Unpaid)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input
                type="date"
                className="form-input"
                value={leaveForm.start_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input
                type="date"
                className="form-input"
                value={leaveForm.end_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reason for Absence *</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="State the reason for taking leave (medical, personal, travel)..."
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsApplyModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={applySubmitting}
            >
              {applySubmitting ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}
              <span>Submit Leave Request</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: REJECT LEAVE (MANAGER / TEAM LEAD) */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Leave Request"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Please provide a constructive reason for rejecting this leave request so the employee understands why.
          </p>
          <div className="form-group">
            <label className="form-label">Reason for Rejection *</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="e.g. Critical project sprint deadline, insufficient team bandwidth, etc."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRejectModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleConfirmReject}
              disabled={actionLoading}
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AttendanceAndLeavesView;
