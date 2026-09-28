import React, { useState, useEffect } from 'react';
import './ManagerDashboard.css';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useMessenger } from '../context/MessengerContext';
import { useNotification } from '../context/NotificationContext';
import Sidebar from '../components/Sidebar';
import Modal from '../components/Modal';
import ProjectDetailsView from '../components/ProjectDetailsView';
import TeamsMessenger from './TeamsMessenger';
import UserProfile from './UserProfile';
import AttendanceAndLeavesView from '../components/AttendanceAndLeavesView';
import {
  Users, Building2, Briefcase, DollarSign, Plus,
  Upload, UserPlus, CheckCircle, Clock, AlertTriangle, FileText,
  UserCheck, Shield, ChevronLeft, ChevronRight, Edit2, Trash2, Mail, Phone,
  LayoutGrid, List, Sparkles, Award, Loader2, XCircle, Image, FileUp, File, X, Paperclip, ExternalLink, MessageSquare, User, Eye, CalendarCheck, Printer
} from 'lucide-react';
import { LinearProgressBar, RadialProgressRing } from '../components/ProgressBar';
import { SkeletonCard, SkeletonStats, SkeletonTable } from '../components/Skeleton';
import Spinner from '../components/Spinner';

const ManagerDashboard = () => {
  const { requestLogout } = useAuth();
  const { unreadCount } = useMessenger();
  const { showNotify, showSuccess, showError, showWarning, showConfirm } = useNotification();
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSelectProject = (projId) => {
    setSelectedProjectId(projId);
    const searchParams = new URLSearchParams(window.location.search);
    if (projId) {
      searchParams.set('tab', 'projects');
      searchParams.set('project_id', projId);
    } else {
      searchParams.delete('project_id');
    }
    const searchStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
    window.history.pushState({ tab: 'projects', project_id: projId }, null, `${window.location.pathname}${searchStr}`);
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

  // View mode state for Employee Roster ('cards' | 'table')
  const [empViewMode, setEmpViewMode] = useState('cards');
  const [empCurrentPage, setEmpCurrentPage] = useState(1);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);

  // Filter states for clickable cards & directories
  const [clientFilter, setClientFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [empRoleFilter, setEmpRoleFilter] = useState('ALL');

  // Data states
  const [employees, setEmployees] = useState([]);
  const [teamLeads, setTeamLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // Modal states
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [isEditEmpModalOpen, setIsEditEmpModalOpen] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvFile, setCsvFile] = useState(null);

  const parseCsvPreview = (text) => {
    if (!text || !text.trim()) return [];
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length <= 1) return [];

    const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase().replace(/[\s-]/g, '_'));

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      if (values.length === 0 || (values.length === 1 && !values[0])) continue;

      const rowObj = {};
      rawHeaders.forEach((h, idx) => {
        rowObj[h] = values[idx] || '';
      });

      const email = rowObj.email || rowObj.e_mail || rowObj.mail || rowObj.email_address || '';
      const firstName = rowObj.first_name || rowObj.firstname || rowObj.given_name || (rowObj.name ? rowObj.name.split(' ')[0] : '');
      const lastName = rowObj.last_name || rowObj.lastname || rowObj.surname || (rowObj.name && rowObj.name.includes(' ') ? rowObj.name.split(' ').slice(1).join(' ') : '');
      const username = rowObj.username || rowObj.emp_id || rowObj.employee_id || rowObj.user_id || `EMP-100${1 + records.length}`;
      const designation = rowObj.designation || rowObj.job_title || rowObj.title || 'Software Engineer';
      const department = rowObj.department || rowObj.dept || 'Engineering';
      const role = (rowObj.role || 'EMPLOYEE').toUpperCase().replace(' ', '_');
      const phone = rowObj.phone || rowObj.mobile || rowObj.contact || '';
      const exp = rowObj.experience_years || rowObj.experience || rowObj.exp || '2';

      if (email || firstName || username) {
        records.push({
          email,
          first_name: firstName,
          last_name: lastName,
          username,
          designation,
          department,
          role,
          phone,
          experience_years: exp
        });
      }
    }
    return records;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setCsvFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvText(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const [isProjModalOpen, setIsProjModalOpen] = useState(false);
  const [isEditProjModalOpen, setIsEditProjModalOpen] = useState(false);
  const [editingProjId, setEditingProjId] = useState(null);
  const [isAssignLeadModalOpen, setIsAssignLeadModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  // Form states
  const [empForm, setEmpForm] = useState({
    username: '',
    email: '',
    password: 'emp12345',
    first_name: '',
    last_name: '',
    role: 'EMPLOYEE',
    phone: '',
    designation: '',
    department: '',
    experience_years: 2
  });

  const [editEmpForm, setEditEmpForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'EMPLOYEE',
    phone: '',
    designation: '',
    experience_years: 1,
    is_available: true
  });

  const [projForm, setProjForm] = useState({ title: '', description: '', client: '', team_lead: '', budget: '', status: 'ACTIVE', start_date: '', end_date: '' });
  const [editProjForm, setEditProjForm] = useState({ title: '', description: '', client: '', team_lead: '', budget: '', status: 'ACTIVE', start_date: '', end_date: '' });
  const [selectedProjForLead, setSelectedProjForLead] = useState(null);
  const [selectedLeadId, setSelectedLeadId] = useState('');

  // Project Image & PDF upload states
  const [projImages, setProjImages] = useState([]);
  const [projImagePreviews, setProjImagePreviews] = useState([]);
  const [projPdfFile, setProjPdfFile] = useState(null);

  const [editProjImages, setEditProjImages] = useState([]);
  const [editProjImagePreviews, setEditProjImagePreviews] = useState([]);
  const [editProjPdfFile, setEditProjPdfFile] = useState(null);
  const [existingProjImages, setExistingProjImages] = useState([]);
  const [existingProjPdfUrl, setExistingProjPdfUrl] = useState(null);

  const handleProjImagesSelect = (e, isEdit = false) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const currentList = isEdit ? editProjImages : projImages;
    const existingCount = isEdit ? existingProjImages.length : 0;
    const maxAllowed = 5 - existingCount - currentList.length;

    if (maxAllowed <= 0) {
      showNotify({
        type: 'warning',
        title: 'Image Limit Reached',
        message: 'Maximum 5 images allowed per project.'
      });
      return;
    }

    const filesToAdd = files.slice(0, maxAllowed);
    const newPreviews = filesToAdd.map(file => ({
      file,
      url: URL.createObjectURL(file)
    }));

    if (isEdit) {
      setEditProjImages(prev => [...prev, ...filesToAdd]);
      setEditProjImagePreviews(prev => [...prev, ...newPreviews]);
    } else {
      setProjImages(prev => [...prev, ...filesToAdd]);
      setProjImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeProjImage = (index, isEdit = false) => {
    if (isEdit) {
      setEditProjImages(prev => prev.filter((_, i) => i !== index));
      setEditProjImagePreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      setProjImages(prev => prev.filter((_, i) => i !== index));
      setProjImagePreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleProjPdfSelect = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        showNotify({
          type: 'error',
          title: 'Invalid File Type',
          message: 'Please select a valid PDF file (.pdf).'
        });
        return;
      }
      if (isEdit) {
        setEditProjPdfFile(file);
      } else {
        setProjPdfFile(file);
      }
    }
  };

  const removeProjPdf = (isEdit = false) => {
    if (isEdit) {
      setEditProjPdfFile(null);
    } else {
      setProjPdfFile(null);
    }
  };

  const handleDeleteExistingImage = (imageId) => {
    if (!editingProjId) return;
    showConfirm({
      title: 'Delete Project Image',
      message: 'Are you sure you want to permanently delete this project image?',
      confirmText: 'Delete Image',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await api.post(`/projects/${editingProjId}/delete-image/`, { image_id: imageId });
          setExistingProjImages(prev => prev.filter(img => img.id !== imageId));
          fetchDashboardData();
          showSuccess({
            title: 'Image Deleted',
            message: 'Project image has been removed successfully.'
          });
        } catch (err) {
          showError({
            title: 'Deletion Failed',
            message: 'Could not delete project image.',
            error: err
          });
        }
      }
    });
  };

  const handleDeleteExistingPdf = () => {
    if (!editingProjId) return;
    showConfirm({
      title: 'Delete Project Document',
      message: 'Are you sure you want to permanently delete the attached PDF document for this project?',
      confirmText: 'Delete PDF',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await api.post(`/projects/${editingProjId}/delete-pdf/`);
          setExistingProjPdfUrl(null);
          fetchDashboardData();
          showSuccess({
            title: 'Document Deleted',
            message: 'Attached PDF specification has been removed from this project.'
          });
        } catch (err) {
          showError({
            title: 'Deletion Failed',
            message: 'Could not delete PDF document.',
            error: err
          });
        }
      }
    });
  };

  const [clientForm, setClientForm] = useState({ name: '', company: '', email: '', phone: '', status: 'LEAD', address: '', notes: '' });
  const [invoiceForm, setInvoiceForm] = useState({
    invoice_number: '',
    client: '',
    project: '',
    amount: '',
    tax_rate: '10.00',
    status: 'UNPAID',
    due_date: '',
    items: [{ description: 'Professional Services / Consultation', quantity: 1, unit_price: '' }]
  });
  const [isViewInvoiceModalOpen, setIsViewInvoiceModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);


  const fetchDashboardData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [statsRes, usersRes, clientRes, projRes, invRes] = await Promise.all([
        api.get('/dashboard-stats/'),
        api.get('/users/'),
        api.get('/clients/'),
        api.get('/projects/'),
        api.get('/invoices/'),
      ]);

      setStats(statsRes.data);
      const allUsers = usersRes.data || [];
      const staffMembers = allUsers.filter(u => u.role !== 'MANAGER');
      const leads = allUsers.filter(u => u.role === 'TEAM_LEAD');

      setEmployees(staffMembers);
      setTeamLeads(leads);
      setClients(clientRes.data);
      setProjects(projRes.data);
      setInvoices(invRes.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => {
      fetchDashboardData(true);
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
    } else if (tabParam && ['overview', 'employees', 'projects', 'clients', 'invoices', 'attendance_leaves'].includes(tabParam)) {
      initialTab = tabParam;
    }
    const projIdParam = params.get('project_id');
    if (projIdParam) {
      setSelectedProjectId(projIdParam);
    }
    setActiveTab(initialTab);
    if (!window.history.state || !window.history.state.tab) {
      window.history.replaceState({ tab: initialTab, isHome: initialTab === 'overview', project_id: projIdParam }, null, window.location.href);
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
    { id: 'employees', label: 'Employees', icon: Users, count: employees.length },
    { id: 'projects', label: 'Projects', icon: Briefcase, count: projects.length },
    { id: 'clients', label: 'Clients & Leads', icon: Building2, count: clients.length },
    { id: 'invoices', label: 'Invoices', icon: DollarSign, count: invoices.length },
    { id: 'attendance_leaves', label: 'Attendance & Leaves', icon: CalendarCheck },
    { id: 'messenger', label: 'Teams Messenger', icon: MessageSquare, count: unreadCount || undefined },
    { id: 'profile', label: 'My Profile', icon: User },
  ];

  // Employee Roster Pagination (8 items per page)
  const filteredEmployees = employees.filter(emp => {
    if (empRoleFilter === 'ALL') return true;
    return emp.role === empRoleFilter;
  });

  const EMP_PER_PAGE = 8;
  const totalEmpPages = Math.max(1, Math.ceil(filteredEmployees.length / EMP_PER_PAGE));
  const safeEmpPage = Math.min(empCurrentPage, totalEmpPages);
  const indexOfLastEmp = safeEmpPage * EMP_PER_PAGE;
  const indexOfFirstEmp = indexOfLastEmp - EMP_PER_PAGE;
  const currentEmployees = filteredEmployees.slice(indexOfFirstEmp, indexOfLastEmp);


  const fetchNextEmployeeId = async () => {
    try {
      const res = await api.get('/users/next-emp-id/');
      if (res.data?.next_employee_id) {
        setEmpForm(prev => ({ ...prev, username: res.data.next_employee_id }));
      }
    } catch (err) {
      console.error('Error fetching next employee ID:', err);
    }
  };

  const handleOpenAddEmpModal = () => {
    fetchNextEmployeeId();
    setIsEmpModalOpen(true);
  };

  // Handlers
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/users/', empForm);
      const createdUser = res.data;
      setIsEmpModalOpen(false);
      setEmpForm({
        username: '',
        email: '',
        password: 'emp12345',
        first_name: '',
        last_name: '',
        role: 'EMPLOYEE',
        phone: '',
        designation: '',
        department: '',
        experience_years: 2
      });
      fetchDashboardData();

      showNotify({
        type: 'success',
        title: 'Account Created Successfully',
        message: `Employee account created for ${createdUser.first_name || createdUser.username}.`,
        details: [
          `Employee ID: ${createdUser.username}`,
          `Role: ${createdUser.role}`,
          `Email: ${createdUser.email}`,
          `Login credentials have been automatically sent to ${createdUser.email}.`
        ]
      });
    } catch (err) {
      showError({
        title: 'Failed to Create Employee',
        message: 'Could not create employee account.',
        error: err
      });
    }
  };

  const handleOpenEditModal = (emp) => {
    setEditingEmpId(emp.id);
    setEditEmpForm({
      username: emp.username || '',
      email: emp.email || '',
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      role: emp.role || 'EMPLOYEE',
      phone: emp.phone || '',
      designation: emp.designation || '',
      department: emp.department || '',
      experience_years: emp.experience_years || 1,
      is_available: emp.is_available !== false
    });
    setIsEditEmpModalOpen(true);
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    if (!editingEmpId) return;
    try {
      await api.patch(`/users/${editingEmpId}/`, editEmpForm);
      setIsEditEmpModalOpen(false);
      setEditingEmpId(null);
      fetchDashboardData();
      showSuccess({
        title: 'Employee Updated',
        message: 'Employee record saved successfully.'
      });
    } catch (err) {
      showError({
        title: 'Update Failed',
        message: 'Could not save employee changes.',
        error: err
      });
    }
  };

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (isUploadingCsv) return;

    if (!csvFile && (!csvText || csvText.trim() === '')) {
      showWarning({
        title: 'Missing CSV Input',
        message: 'Please select a CSV file or paste CSV text before submitting.'
      });
      return;
    }

    setIsUploadingCsv(true);
    try {
      let res;
      if (csvFile) {
        const formData = new FormData();
        formData.append('file', csvFile);
        res = await api.post('/users/upload-employees/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else if (csvText && csvText.trim() !== '') {
        res = await api.post('/users/upload-employees/', { csv_data: csvText });
      }

      const { message, errors } = res?.data || {};

      setIsCsvModalOpen(false);
      setCsvText('');
      setCsvFile(null);
      await fetchDashboardData();
      setActiveTab('employees');
      setEmpViewMode('cards');

      showSuccess({
        title: 'CSV Import Processed',
        message: message || 'Employees imported into cards successfully.',
        details: errors
      });
    } catch (err) {
      showError({
        title: 'CSV Import Failed',
        message: 'Error processing CSV file.',
        error: err
      });
    } finally {
      setIsUploadingCsv(false);
    }
  };

  const handleDeleteUser = (userId) => {
    showConfirm({
      title: 'Remove Employee',
      message: 'Are you sure you want to remove this employee from the portal?',
      confirmText: 'Remove Employee',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/users/${userId}/`);
          fetchDashboardData();
          showSuccess({
            title: 'Employee Removed',
            message: 'Employee record deleted successfully.'
          });
        } catch (err) {
          showError({
            title: 'Delete Failed',
            message: 'Could not delete employee record.',
            error: err
          });
        }
      }
    });
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('title', projForm.title);
      formData.append('description', projForm.description || '');
      formData.append('client', projForm.client);
      if (projForm.team_lead) formData.append('team_lead', projForm.team_lead);
      formData.append('budget', projForm.budget || '0.00');
      formData.append('status', projForm.status);
      if (projForm.start_date) formData.append('start_date', projForm.start_date);
      if (projForm.end_date) formData.append('end_date', projForm.end_date);

      if (projPdfFile) {
        formData.append('pdf_file', projPdfFile);
      }
      projImages.forEach(imgFile => {
        formData.append('images', imgFile);
      });

      await api.post('/projects/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setIsProjModalOpen(false);
      setProjForm({ title: '', description: '', client: '', team_lead: '', budget: '', status: 'ACTIVE', start_date: '', end_date: '' });
      setProjImages([]);
      setProjImagePreviews([]);
      setProjPdfFile(null);

      fetchDashboardData();
      showSuccess({
        title: 'Project Created',
        message: 'New project created successfully with attached media files.'
      });
    } catch (err) {
      showError({
        title: 'Project Creation Failed',
        message: 'Could not create project.',
        error: err
      });
    }
  };

  const handleOpenEditProjModal = (p) => {
    setEditingProjId(p.id);
    setEditProjForm({
      title: p.title || '',
      description: p.description || '',
      client: p.client || '',
      team_lead: p.team_lead || '',
      budget: p.budget || '',
      status: p.status || 'ACTIVE',
      start_date: p.start_date || '',
      end_date: p.end_date || ''
    });
    setExistingProjImages(p.images || []);
    setExistingProjPdfUrl(p.pdf_url || null);
    setEditProjImages([]);
    setEditProjImagePreviews([]);
    setEditProjPdfFile(null);
    setIsEditProjModalOpen(true);
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    if (!editingProjId) return;
    try {
      const formData = new FormData();
      formData.append('title', editProjForm.title);
      formData.append('description', editProjForm.description || '');
      formData.append('client', editProjForm.client);
      if (editProjForm.team_lead) formData.append('team_lead', editProjForm.team_lead);
      formData.append('budget', editProjForm.budget || '0.00');
      formData.append('status', editProjForm.status);
      if (editProjForm.start_date) formData.append('start_date', editProjForm.start_date);
      if (editProjForm.end_date) formData.append('end_date', editProjForm.end_date);

      if (editProjPdfFile) {
        formData.append('pdf_file', editProjPdfFile);
      }
      editProjImages.forEach(imgFile => {
        formData.append('images', imgFile);
      });

      await api.patch(`/projects/${editingProjId}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setIsEditProjModalOpen(false);
      setEditingProjId(null);
      setEditProjImages([]);
      setEditProjImagePreviews([]);
      setEditProjPdfFile(null);

      fetchDashboardData();
      showSuccess({
        title: 'Project Updated',
        message: 'Project details and files updated successfully.'
      });
    } catch (err) {
      showError({
        title: 'Update Failed',
        message: 'Could not save project changes.',
        error: err
      });
    }
  };

  const handleDeleteProject = (projId) => {
    showConfirm({
      title: 'Delete Project',
      message: 'Are you sure you want to delete this project? This action cannot be undone.',
      confirmText: 'Delete Project',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/projects/${projId}/`);
          fetchDashboardData();
          showSuccess({
            title: 'Project Deleted',
            message: 'Project removed successfully.'
          });
        } catch (err) {
          showError({
            title: 'Delete Failed',
            message: 'Could not delete project.',
            error: err
          });
        }
      }
    });
  };

  const handleAssignLead = async (e) => {
    e.preventDefault();
    if (!selectedProjForLead || !selectedLeadId) return;
    try {
      await api.post(`/projects/${selectedProjForLead.id}/assign-lead/`, { team_lead_id: selectedLeadId });
      setIsAssignLeadModalOpen(false);
      setSelectedProjForLead(null);
      setSelectedLeadId('');
      fetchDashboardData();
      showSuccess({
        title: 'Team Lead Assigned',
        message: 'Team Lead assignment updated successfully.'
      });
    } catch (err) {
      showError({
        title: 'Assignment Failed',
        message: 'Could not assign Team Lead.',
        error: err
      });
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await api.post('/clients/', clientForm);
      setIsClientModalOpen(false);
      setClientForm({ name: '', company: '', email: '', phone: '', status: 'LEAD', address: '', notes: '' });
      fetchDashboardData();
      showSuccess({
        title: 'Client Record Saved',
        message: 'Client/Lead profile created successfully.'
      });
    } catch (err) {
      showError({
        title: 'Failed to Save Client',
        message: 'Could not save client record.',
        error: err
      });
    }
  };

  const handleConvertLead = async (clientId) => {
    try {
      await api.post(`/clients/${clientId}/convert-to-client/`);
      fetchDashboardData();
      showSuccess({
        title: 'Lead Converted',
        message: 'Lead has been converted to an Active Client.'
      });
    } catch (err) {
      showError({
        title: 'Conversion Failed',
        message: 'Could not convert lead.',
        error: err
      });
    }
  };

  const handleOpenCreateInvoiceModal = async () => {
    let autoInvNum = `INV-${new Date().getFullYear()}-001`;
    try {
      const res = await api.get('/invoices/next-invoice-number/');
      if (res.data?.next_invoice_number) {
        autoInvNum = res.data.next_invoice_number;
      }
    } catch (err) {
      console.error('Error fetching next invoice number:', err);
    }

    const defaultDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    setInvoiceForm({
      invoice_number: autoInvNum,
      client: '',
      project: '',
      amount: '',
      tax_rate: '10.00',
      status: 'UNPAID',
      due_date: defaultDueDate,
      items: [{ description: 'Professional Services / Consultation', quantity: 1, unit_price: '' }]
    });
    setIsInvoiceModalOpen(true);
  };

  const handleAddInvoiceItem = () => {
    setInvoiceForm(prev => ({
      ...prev,
      items: [...(prev.items || []), { description: '', quantity: 1, unit_price: '' }]
    }));
  };

  const handleUpdateInvoiceItem = (index, field, value) => {
    setInvoiceForm(prev => {
      const newItems = [...(prev.items || [])];
      newItems[index] = { ...newItems[index], [field]: value };
      let newAmount = prev.amount;
      if (newItems.length > 0) {
        const sum = newItems.reduce((acc, itm) => acc + (parseFloat(itm.quantity || 0) * parseFloat(itm.unit_price || 0)), 0);
        if (sum > 0) {
          newAmount = sum.toFixed(2);
        }
      }
      return { ...prev, items: newItems, amount: newAmount };
    });
  };

  const handleRemoveInvoiceItem = (index) => {
    setInvoiceForm(prev => {
      const newItems = (prev.items || []).filter((_, i) => i !== index);
      let newAmount = prev.amount;
      if (newItems.length > 0) {
        const sum = newItems.reduce((acc, itm) => acc + (parseFloat(itm.quantity || 0) * parseFloat(itm.unit_price || 0)), 0);
        newAmount = sum.toFixed(2);
      }
      return { ...prev, items: newItems, amount: newAmount };
    });
  };

  const handleOpenViewInvoiceModal = (inv) => {
    setViewingInvoice(inv);
    setIsViewInvoiceModalOpen(true);
  };

  const handleProjectSelectForInvoice = (projectIdStr) => {
    if (!projectIdStr) {
      setInvoiceForm(prev => ({ ...prev, project: '' }));
      return;
    }
    const projId = parseInt(projectIdStr);
    const selectedProj = projects.find(p => p.id === projId);

    if (selectedProj) {
      const clientVal = selectedProj.client || (selectedProj.client_details ? selectedProj.client_details.id : '');
      const amountVal = selectedProj.budget || '';
      const dueVal = selectedProj.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      setInvoiceForm(prev => ({
        ...prev,
        project: projId,
        client: clientVal || prev.client,
        amount: amountVal,
        due_date: dueVal
      }));
    } else {
      setInvoiceForm(prev => ({ ...prev, project: projId }));
    }
  };

  const setInvoiceDueDateOffset = (days) => {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    setInvoiceForm(prev => ({ ...prev, due_date: d.toISOString().split('T')[0] }));
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    try {
      await api.post('/invoices/', invoiceForm);
      setIsInvoiceModalOpen(false);
      setInvoiceForm({ invoice_number: '', client: '', project: '', amount: '', tax_rate: '10.00', status: 'UNPAID', due_date: '' });
      fetchDashboardData();
      showSuccess({
        title: 'Invoice Issued & Emailed',
        message: 'Invoice created successfully and shared with client via email.'
      });
    } catch (err) {
      showError({
        title: 'Invoice Creation Failed',
        message: 'Could not create invoice.',
        error: err
      });
    }
  };

  const handleSendInvoiceEmail = async (invId, invNum, clientName) => {
    try {
      const res = await api.post(`/invoices/${invId}/send-email/`);
      showSuccess({
        title: 'Invoice Email Sent',
        message: res.data?.message || `Invoice #${invNum} shared with ${clientName} via email.`
      });
    } catch (err) {
      showError({
        title: 'Email Dispatch Failed',
        message: 'Could not send invoice email.',
        error: err
      });
    }
  };

  const handleToggleInvoiceStatus = async (invId, newStatus, invNum) => {
    try {
      const res = await api.post(`/invoices/${invId}/mark-paid/`, { status: newStatus });
      fetchDashboardData();
      showSuccess({
        title: 'Invoice Status Updated',
        message: res.data?.message || `Invoice #${invNum} marked as ${newStatus}.`
      });
    } catch (err) {
      showError({
        title: 'Update Failed',
        message: 'Could not update invoice status.',
        error: err
      });
    }
  };

  if (loading && !stats) {
    return (
      <div className="layout-wrapper">
        <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} navItems={navItems} />
        <div className="layout-main-area">
          <main className="main-content" style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ width: '260px', height: '28px', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', marginBottom: '8px' }} />
              <div style={{ width: '380px', height: '16px', background: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
            </div>
            <SkeletonStats count={4} />
            <div style={{ marginTop: '2rem' }}>
              <SkeletonTable rows={5} />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-wrapper">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} navItems={navItems} />

      {/* Main Area */}
      <div className="layout-main-area">
        <main className={`main-content${activeTab === 'messenger' ? ' messenger-active' : ''}`}>
          {/* Header Banner - only shown on dashboard overview tab */}
          {activeTab === 'overview' && (
            <div className="manager-header">
              <div className="manager-title-group">
                <h1>Manager Portal</h1>
                <p>Overview of Clients, Projects, Staff & Revenue Metrics</p>
              </div>

              <div className="manager-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('csv-import')}>
                  <Upload size={16} />
                  <span>Upload CSV</span>
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleOpenAddEmpModal}>
                  <UserPlus size={16} />
                  <span>Add Employee</span>
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setIsProjModalOpen(true)} style={{ background: 'linear-gradient(135deg, var(--accent-violet), var(--primary))' }}>
                  <Plus size={16} />
                  <span>New Project</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'attendance_leaves' && (
            <div className="manager-header">
              <div className="manager-title-group">
                <h1>Company Attendance &amp; Leave Operations</h1>
                <p>Shift clock-in, organization-wide attendance roster &amp; leave request approvals</p>
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {/* Metrics Grid */}
              {stats && (
                <div className="metrics-grid">
                  <div
                    className="glass-card metric-card interactive"
                    onClick={() => { setActiveTab('clients'); setClientFilter('ACTIVE'); }}
                    title="Click to view Active Clients"
                  >
                    <div className="metric-icon icon-emerald"><Building2 size={24} /></div>
                    <div>
                      <div className="metric-value">{clients.filter(c => c.status === 'ACTIVE').length || stats.total_clients}</div>
                      <div className="metric-label">Active Clients</div>
                      <div className="metric-action-hint">View Clients <ChevronRight size={12} /></div>
                    </div>
                  </div>

                  <div
                    className="glass-card metric-card interactive"
                    onClick={() => { setActiveTab('clients'); setClientFilter('LEAD'); }}
                    title="Click to view New Leads"
                  >
                    <div className="metric-icon icon-amber"><Users size={24} /></div>
                    <div>
                      <div className="metric-value">{clients.filter(c => c.status === 'LEAD').length || stats.new_leads}</div>
                      <div className="metric-label">New Leads</div>
                      <div className="metric-action-hint">View Leads <ChevronRight size={12} /></div>
                    </div>
                  </div>

                  <div
                    className="glass-card metric-card interactive"
                    onClick={() => { setActiveTab('projects'); setProjectFilter('ACTIVE'); }}
                    title="Click to view Active Projects"
                  >
                    <div className="metric-icon icon-purple"><Briefcase size={24} /></div>
                    <div>
                      <div className="metric-value">{projects.filter(p => p.status === 'ACTIVE' || p.status === 'IN_PROGRESS' || p.status === 'PLANNING').length || stats.active_projects}</div>
                      <div className="metric-label">Active Projects</div>
                      <div className="metric-action-hint">View Projects <ChevronRight size={12} /></div>
                    </div>
                  </div>

                  <div
                    className="glass-card metric-card interactive"
                    onClick={() => setActiveTab('employees')}
                    title="Click to view Roster & Staff"
                  >
                    <div className="metric-icon icon-cyan"><Users size={24} /></div>
                    <div>
                      <div className="metric-value">{employees.length !== undefined && employees.length > 0 ? employees.length : stats.total_employees}</div>
                      <div className="metric-label">Total Employees</div>
                      <div className="metric-action-hint">View Roster <ChevronRight size={12} /></div>
                    </div>
                  </div>

                  <div
                    className="glass-card metric-card interactive span-2-mobile"
                    onClick={() => setActiveTab('invoices')}
                    title="Click to view Invoices & Financials"
                  >
                    <div className="metric-icon icon-emerald"><DollarSign size={24} /></div>
                    <div>
                      <div className="metric-value">${stats.revenue_paid.toLocaleString()}</div>
                      <div className="metric-label">Paid Revenue</div>
                      <div className="metric-action-hint">View Invoices <ChevronRight size={12} /></div>
                    </div>
                  </div>

                  </div>
              )}

              <div className="overview-grid">
                <div className="glass-card tab-content-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Active Projects Status</h3>
                    {projects.length > 0 && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('projects')} style={{ fontSize: '0.76rem', padding: '3px 8px' }}>
                        View All <ChevronRight size={12} />
                      </button>
                    )}
                  </div>

                  {projects.length === 0 ? (
                    <div className="empty-projects-state">
                      <div className="empty-projects-icon">
                        <Briefcase size={26} />
                      </div>
                      <div className="empty-projects-title">No Active Projects Yet</div>
                      <p className="empty-projects-sub">Create your first project to track tasks, timelines, and assign team leads.</p>
                      <button className="btn btn-primary btn-sm" onClick={() => setIsProjModalOpen(true)}>
                        <Plus size={14} /> New Project
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="table-container projects-desktop-table">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>Project Title</th>
                              <th>Client</th>
                              <th>Team Lead</th>
                              <th>Status</th>
                              <th>Progress</th>
                              <th>Budget</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projects.slice(0, 5).map((p) => {
                              const progressPct = p.progress_percentage ?? (p.task_count ? Math.round((p.completed_task_count / p.task_count) * 100) : 0);
                              return (
                                <tr key={p.id} onClick={() => handleSelectProject(p.id)} style={{ cursor: 'pointer' }}>
                                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.title}</td>
                                  <td>{p.client_details?.name || 'N/A'}</td>
                                  <td>{p.team_lead_details ? (p.team_lead_details.first_name || p.team_lead_details.username) : <span style={{ color: 'var(--text-dim)' }}>Unassigned</span>}</td>
                                  <td><span className={`badge badge-${p.status.toLowerCase().replace('_', '-')}`}>{p.status}</span></td>
                                  <td style={{ minWidth: '160px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{p.completed_task_count} / {p.task_count} Tasks</span>
                                        <span style={{ fontWeight: 800, color: progressPct >= 80 ? 'var(--accent-emerald)' : progressPct >= 40 ? 'var(--accent-cyan)' : 'var(--accent-amber)' }}>{progressPct}%</span>
                                      </div>
                                      <LinearProgressBar progress={progressPct} showLabel={false} height={6} />
                                    </div>
                                  </td>
                                  <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>${parseFloat(p.budget).toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards View */}
                      <div className="projects-mobile-cards">
                        {projects.slice(0, 5).map((p) => {
                          const progressPct = p.progress_percentage ?? (p.task_count ? Math.round((p.completed_task_count / p.task_count) * 100) : 0);
                          return (
                            <div className="mobile-project-card" key={p.id} onClick={() => handleSelectProject(p.id)}>
                              <div className="mobile-project-card-header">
                                <div style={{ flex: 1, minWidth: 0, paddingRight: '6px' }}>
                                  <h4 className="mobile-project-title">{p.title}</h4>
                                  <div className="mobile-project-client">
                                    <Building2 size={12} />
                                    <span>{p.client_details?.name || 'No Client'}</span>
                                  </div>
                                </div>
                                <span className={`badge badge-${p.status.toLowerCase().replace('_', '-')}`}>{p.status}</span>
                              </div>

                              <div className="mobile-project-progress-box">
                                <div className="mobile-project-progress-meta">
                                  <span>{p.completed_task_count || 0} / {p.task_count || 0} Tasks</span>
                                  <span style={{ fontWeight: 800, color: progressPct >= 80 ? 'var(--accent-emerald)' : progressPct >= 40 ? 'var(--accent-cyan)' : 'var(--accent-amber)' }}>{progressPct}%</span>
                                </div>
                                <LinearProgressBar progress={progressPct} showLabel={false} height={5} />
                              </div>

                              <div className="mobile-project-card-footer">
                                <div className="mobile-project-lead">
                                  <User size={12} />
                                  <span>{p.team_lead_details ? (p.team_lead_details.first_name || p.team_lead_details.username) : 'Unassigned Lead'}</span>
                                </div>
                                <div className="mobile-project-budget">${parseFloat(p.budget || 0).toLocaleString()}</div>
                              </div>
                            </div>
                          );
                        })}

                        {projects.length > 5 && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('projects')} style={{ width: '100%', marginTop: '0.35rem', justifyContent: 'center' }}>
                            View All {projects.length} Projects <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="glass-card tab-content-card">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Recent New Leads</h3>
                  {clients.filter(c => c.status === 'LEAD').length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No new leads at the moment.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {clients.filter(c => c.status === 'LEAD').slice(0, 4).map(lead => (
                        <div key={lead.id} style={{ padding: '0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{lead.name}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lead.company || lead.email}</div>
                          </div>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleConvertLead(lead.id)}>
                            <CheckCircle size={14} color="var(--accent-emerald)" />
                            <span>Make Client</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: EMPLOYEES MANAGEMENT */}
          {activeTab === 'employees' && (
            <div className="glass-card tab-content-card">
              {/* Section Header with View Switcher */}
              <div className="section-header-row">
                <div className="section-title-wrap">
                  <h3 className="section-title">Employee Roster</h3>
                  <span className="section-count-badge">{filteredEmployees.length}</span>
                </div>

                {/* View Switcher Toggle - Desktop only */}
                <div className="view-toggle-bar desktop-only">
                  <button
                    className={`view-toggle-btn ${empViewMode === 'cards' ? 'active' : ''}`}
                    onClick={() => setEmpViewMode('cards')}
                    title="Grid Cards View"
                  >
                    <LayoutGrid size={14} /> Cards
                  </button>
                  <button
                    className={`view-toggle-btn ${empViewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setEmpViewMode('table')}
                    title="Table View"
                  >
                    <List size={14} /> Table
                  </button>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="section-actions-row">
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('csv-import')}>
                  <Upload size={14} /> Upload CSV
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleOpenAddEmpModal}>
                  <UserPlus size={14} /> Add Single Employee
                </button>
              </div>

              {/* Quick Filter Pills by Role */}
              <div className="filter-pills-bar" style={{ marginBottom: '1.25rem' }}>
                <button className={`filter-pill ${empRoleFilter === 'ALL' ? 'active' : ''}`} onClick={() => { setEmpRoleFilter('ALL'); setEmpCurrentPage(1); }}>
                  All Staff ({employees.length})
                </button>
                <button className={`filter-pill ${empRoleFilter === 'TEAM_LEAD' ? 'active' : ''}`} onClick={() => { setEmpRoleFilter('TEAM_LEAD'); setEmpCurrentPage(1); }}>
                  Team Leads ({employees.filter(e => e.role === 'TEAM_LEAD').length})
                </button>
                <button className={`filter-pill ${empRoleFilter === 'EMPLOYEE' ? 'active' : ''}`} onClick={() => { setEmpRoleFilter('EMPLOYEE'); setEmpCurrentPage(1); }}>
                  Employees ({employees.filter(e => e.role === 'EMPLOYEE').length})
                </button>
              </div>

              {filteredEmployees.length === 0 ? (
                <div className="empty-section-state">
                  <div className="empty-section-icon">
                    <Users size={28} />
                  </div>
                  <h4 className="empty-section-title">
                    {empRoleFilter === 'ALL' ? 'No Employees Added Yet' : `No ${empRoleFilter === 'TEAM_LEAD' ? 'Team Leads' : 'Employees'} Found`}
                  </h4>
                  <p className="empty-section-desc">
                    {empRoleFilter === 'ALL' 
                      ? 'Build your team roster by adding employees individually or importing bulk CSV records.'
                      : 'No staff members currently match this role filter.'}
                  </p>
                  <div className="empty-section-actions">
                    {empRoleFilter !== 'ALL' ? (
                      <button className="btn btn-secondary btn-sm" onClick={() => setEmpRoleFilter('ALL')}>
                        Clear Filter
                      </button>
                    ) : (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={handleOpenAddEmpModal}>
                          <UserPlus size={14} /> Add Employee
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('csv-import')}>
                          <Upload size={14} /> Upload CSV
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* VIEW 1: CARDS GRID VIEW (Desktop Only) */}
                  {empViewMode === 'cards' && (
                    <div className="emp-cards-grid desktop-only">
                  {currentEmployees.map((emp) => {
                    const fullName = emp.first_name ? `${emp.first_name} ${emp.last_name}` : emp.username;
                    const initials = (emp.first_name && emp.last_name) 
                      ? `${emp.first_name[0]}${emp.last_name[0]}`.toUpperCase() 
                      : (emp.username ? emp.username.slice(0, 2).toUpperCase() : 'EM');

                    const formatTitle = (str) => {
                      if (!str) return '';
                      return str.charAt(0).toUpperCase() + str.slice(1);
                    };

                    const designation = formatTitle(emp.designation) || 'Software Engineer';
                    const department = formatTitle(emp.department) || 'Engineering';

                    return (
                      <div key={emp.id} className="emp-card">
                        <div>
                          <div className="emp-card-header">
                            <div className="emp-avatar">
                              {initials}
                              <span className={`emp-presence-dot ${emp.is_online ? 'online' : 'offline'}`} title={emp.is_online ? 'Online' : 'Offline'} />
                            </div>
                            <div className="emp-card-info">
                              <div className="emp-card-name" title={fullName}>{fullName}</div>
                              <div className="emp-card-header-meta">
                                <span className="emp-card-username">{emp.username}</span>
                                <span className={`user-role-badge role-${(emp.role || 'EMPLOYEE').toLowerCase().replace('_', '-')}`}>
                                  {emp.role === 'TEAM_LEAD' ? 'Team Lead' : emp.role === 'MANAGER' ? 'Manager' : 'Employee'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="emp-card-meta">
                            <div className="emp-meta-item">
                              <Briefcase size={14} color="#6366f1" />
                              <span><strong className="emp-meta-highlight">{designation}</strong> • {department}</span>
                            </div>
                            <div className="emp-meta-item">
                              <Mail size={14} color="#0284c7" />
                              <span title={emp.email}>{emp.email}</span>
                            </div>
                            {emp.phone && (
                              <div className="emp-meta-item">
                                <Phone size={14} color="#059669" />
                                <span>{emp.phone}</span>
                              </div>
                            )}
                            <div className="emp-meta-item">
                              <Award size={14} color="#d97706" />
                              <span>Experience: <strong>{emp.experience_years ? `${emp.experience_years} years` : '1 year'}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="emp-card-footer">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className={emp.is_available ? 'status-badge-available' : 'status-badge-assigned'}>
                              <span style={{ fontSize: '0.6rem' }}>●</span> {emp.is_available ? 'Available' : 'Assigned'}
                            </span>
                            <span className={`presence-pill ${emp.is_online ? 'online' : 'offline'}`} title={emp.is_online ? 'Online' : 'Offline'}>
                              <span className="presence-dot" /> {emp.is_online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button className="btn-card-edit" onClick={() => handleOpenEditModal(emp)} title="Edit Employee">
                              <Edit2 size={13} /> Edit
                            </button>
                            <button className="btn-card-delete" onClick={() => handleDeleteUser(emp.id)} title="Delete Employee">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* VIEW 2: TABLE VIEW (Shown on desktop when selected, or always on mobile) */}
              <div className={`table-container ${empViewMode === 'table' ? '' : 'mobile-only'}`}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Employee Name</th>
                      <th>Employee ID</th>
                      <th>Email</th>
                      <th>Designation</th>
                      <th>Department</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Exp</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentEmployees.map((emp) => (
                      <tr key={emp.id}>
                        <td style={{ fontWeight: 700 }}>{emp.first_name ? `${emp.first_name} ${emp.last_name}` : emp.username}</td>
                        <td><span className="emp-card-username">{emp.username}</span></td>
                        <td>{emp.email}</td>
                        <td>{emp.designation || 'Software Engineer'}</td>
                        <td>{emp.department || 'Engineering'}</td>
                        <td>{emp.phone || 'N/A'}</td>
                        <td>
                          <span className={`user-role-badge role-${emp.role.toLowerCase().replace('_', '-')}`}>
                            {emp.role === 'TEAM_LEAD' ? 'Team Lead' : emp.role === 'MANAGER' ? 'Manager' : 'Employee'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{emp.experience_years ? `${emp.experience_years} yrs` : '1 yr'}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className={`badge ${emp.is_available ? 'badge-active' : 'badge-in-progress'}`}>
                              {emp.is_available ? 'Available' : 'Assigned to Project'}
                            </span>
                            <span className={`presence-pill ${emp.is_online ? 'online' : 'offline'}`} title={emp.is_online ? 'Online' : 'Offline'}>
                              <span className="presence-dot" /> {emp.is_online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEditModal(emp)} title="Edit Employee">
                              <Edit2 size={14} />
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(emp.id)} title="Delete Employee">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION CONTROLS */}
              {filteredEmployees.length > 0 && (
                <div className="pagination-bar">
                  <div className="pagination-info">
                    Showing <strong>{indexOfFirstEmp + 1}</strong>–<strong>{Math.min(indexOfLastEmp, filteredEmployees.length)}</strong> of <strong>{filteredEmployees.length}</strong> staff member(s)
                  </div>

                  <div className="pagination-controls">
                    <button 
                      className="pagination-btn" 
                      disabled={safeEmpPage <= 1}
                      onClick={() => setEmpCurrentPage(prev => Math.max(prev - 1, 1))}
                    >
                      <ChevronLeft size={16} /> Prev
                    </button>
                    
                    {Array.from({ length: totalEmpPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        className={`pagination-num-btn ${pageNum === safeEmpPage ? 'active' : ''}`}
                        onClick={() => setEmpCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button 
                      className="pagination-btn" 
                      disabled={safeEmpPage >= totalEmpPages}
                      onClick={() => setEmpCurrentPage(prev => Math.min(prev + 1, totalEmpPages))}
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

          {/* TAB: BULK CSV IMPORT DEDICATED PAGE VIEW */}
          {activeTab === 'csv-import' && (
            <div className="glass-card tab-content-card" style={{ position: 'relative', overflow: 'hidden' }}>
              
              {/* UPLOADING SPINNER OVERLAY */}
              {isUploadingCsv && (
                <div className="csv-upload-overlay">
                  <div className="csv-loader-ring"></div>
                  <div>
                    <div className="csv-loader-title">Importing Employees & Data...</div>
                    <div className="csv-loader-sub">Parsing CSV records, generating Employee IDs, and building live cards</div>
                  </div>
                  <div className="csv-loader-bar">
                    <div className="csv-loader-bar-fill"></div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Bulk CSV Employee Import & Cards Generator
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
                    Upload CSV files or paste CSV text to auto-assign Employee IDs, roles, designations, and generate live cards.
                  </p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('employees')}>
                  <Users size={14} /> View Employee Cards
                </button>
              </div>

              <form onSubmit={handleCsvUpload}>
                <div className="form-group">
                  <label className="form-label">Select CSV File</label>
                  <input type="file" accept=".csv" className="form-input" disabled={isUploadingCsv} onChange={handleFileChange} />
                </div>

                <div style={{ textAlign: 'center', margin: '1.25rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>OR PASTE CSV TEXT BELOW</div>

                <div className="form-group">
                  <label className="form-label">CSV Data Text (Headers: email, first_name, last_name, designation, department, etc.)</label>
                  <textarea
                    className="form-textarea"
                    rows={5}
                    disabled={isUploadingCsv}
                    placeholder={`email,first_name,last_name,designation,department\njohn@crm.com,John,Doe,Fullstack Developer,Engineering`}
                    value={csvText}
                    onChange={e => setCsvText(e.target.value)}
                  />
                </div>

                {/* LIVE CSV CARDS PREVIEW WHILE CHECKING DATA */}
                {(() => {
                  const previewRecords = parseCsvPreview(csvText);
                  if (previewRecords.length === 0) return null;
                  return (
                    <div className="csv-preview-container">
                      <div className="csv-preview-header">
                        <div className="csv-preview-title">
                          <Sparkles size={16} color="#f59e0b" />
                          Live Employee Cards Preview
                        </div>
                        <span className="badge badge-active">{previewRecords.length} Card(s) Ready to Import</span>
                      </div>
                      <div className="csv-preview-grid">
                        {previewRecords.map((rec, idx) => (
                          <div key={idx} className="csv-mini-card">
                            <div className="csv-mini-card-name">
                              {rec.first_name ? `${rec.first_name} ${rec.last_name}` : (rec.email || rec.username)}
                            </div>
                            <div className="csv-mini-card-sub">
                              <span><strong>ID:</strong> {rec.username}</span>
                              <span><strong>Role:</strong> {rec.role}</span>
                              <span><strong>Designation:</strong> {rec.designation} ({rec.department})</span>
                              <span><strong>Email:</strong> {rec.email}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isUploadingCsv}
                  style={{ width: '100%', marginTop: '1.5rem', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.95rem' }}
                >
                  {isUploadingCsv ? (
                    <>
                      <Loader2 size={20} className="spin-loader-icon" />
                      <span>Importing Data & Building Cards...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      <span>Upload & Import Employees into Cards</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: PROJECTS MANAGEMENT & ASSIGN LEAD */}
          {activeTab === 'projects' && (
            selectedProjectId && projects.some(p => p.id === parseInt(selectedProjectId)) ? (
              <ProjectDetailsView
                project={projects.find(p => p.id === parseInt(selectedProjectId))}
                onBack={() => handleSelectProject(null)}
                onRefresh={fetchDashboardData}
              />
            ) : (
            <div className="glass-card tab-content-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Projects & Team Lead Assignments</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setIsProjModalOpen(true)}>
                  <Plus size={14} /> Create Project
                </button>
              </div>

              {/* Quick Filter Pills */}
              <div className="filter-pills-bar">
                <button className={`filter-pill ${projectFilter === 'ALL' ? 'active' : ''}`} onClick={() => setProjectFilter('ALL')}>
                  All Projects ({projects.length})
                </button>
                <button className={`filter-pill ${projectFilter === 'ACTIVE' ? 'active' : ''}`} onClick={() => setProjectFilter('ACTIVE')}>
                  Active ({projects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'ACTIVE' || p.status === 'PLANNING').length})
                </button>
                <button className={`filter-pill ${projectFilter === 'COMPLETED' ? 'active' : ''}`} onClick={() => setProjectFilter('COMPLETED')}>
                  Completed ({projects.filter(p => p.status === 'COMPLETED').length})
                </button>
                {projectFilter !== 'ALL' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setProjectFilter('ALL')} style={{ marginLeft: 'auto', gap: '4px' }}>
                    <X size={14} /> Clear Filter ({projectFilter})
                  </button>
                )}
              </div>

              <div className="table-container projects-desktop-table">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Project Name</th>
                      <th>Client</th>
                      <th>Assigned Team Lead</th>
                      <th>Status</th>
                      <th>Budget</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody style={{ verticalAlign: 'middle' }}>
                    {projects
                      .filter(p => {
                        if (projectFilter === 'ALL') return true;
                        if (projectFilter === 'ACTIVE') return p.status === 'IN_PROGRESS' || p.status === 'ACTIVE';
                        return p.status === projectFilter;
                      })
                      .map((p) => {
                      return (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 700 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span
                                onClick={() => handleSelectProject(p.id)}
                                style={{ color: 'var(--primary)', fontSize: '0.95rem', cursor: 'pointer', textDecoration: 'underline' }}
                                title="Click to view full project details & tasks"
                              >
                                {p.title}
                              </span>
                              {p.pdf_url && (
                                <a
                                  href={p.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-pdf-link"
                                  title="Open Project Specs / PDF Document"
                                >
                                  <FileText size={12} color="#e11d48" /> PDF Specs
                                </a>
                              )}
                            </div>
                          </td>
                          <td>{p.client_details?.name || 'N/A'}</td>
                          <td>
                            {p.team_lead_details ? (
                              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                                {p.team_lead_details.first_name ? `${p.team_lead_details.first_name} ${p.team_lead_details.last_name}` : p.team_lead_details.username}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>Not Assigned</span>
                            )}
                          </td>
                          <td><span className={`badge badge-${p.status.toLowerCase().replace('_', '-')}`}>{p.status}</span></td>
                          <td style={{ fontWeight: 700 }}>${parseFloat(p.budget).toLocaleString()}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSelectProject(p.id)}
                                title="View Full Project Details, Tasks & Progress"
                                style={{ gap: '4px' }}
                              >
                                <Eye size={14} />
                                <span>View Details</span>
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setSelectedProjForLead(p);
                                  setSelectedLeadId(p.team_lead || p.team_lead_details?.id || '');
                                  setIsAssignLeadModalOpen(true);
                                }}
                                title={(p.team_lead || p.team_lead_details) ? 'Change assigned Team Lead' : 'Assign Team Lead'}
                              >
                                <UserCheck size={14} />
                                <span>{(p.team_lead || p.team_lead_details) ? 'Change Lead' : 'Assign Lead'}</span>
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenEditProjModal(p)}
                                title="Edit Project Details"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteProject(p.id)}
                                title="Delete Project"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Project Cards for Tab 3 */}
              <div className="projects-mobile-cards">
                {projects
                  .filter(p => {
                    if (projectFilter === 'ALL') return true;
                    if (projectFilter === 'ACTIVE') return p.status === 'IN_PROGRESS' || p.status === 'ACTIVE';
                    return p.status === projectFilter;
                  })
                  .map((p) => {
                    return (
                      <div className="mobile-project-card" key={p.id}>
                        <div className="mobile-project-card-header">
                          <div style={{ flex: 1, minWidth: 0, paddingRight: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <h4
                                className="mobile-project-title"
                                onClick={() => handleSelectProject(p.id)}
                                style={{ color: 'var(--primary)', cursor: 'pointer' }}
                              >
                                {p.title}
                              </h4>
                              {p.pdf_url && (
                                <a
                                  href={p.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-pdf-link"
                                  title="Open Specs"
                                >
                                  <FileText size={11} /> PDF
                                </a>
                              )}
                            </div>
                            <div className="mobile-project-client">
                              <Building2 size={12} />
                              <span>{p.client_details?.name || 'No Client'}</span>
                            </div>
                          </div>
                          <span className={`badge badge-${p.status.toLowerCase().replace('_', '-')}`}>{p.status}</span>
                        </div>

                        <div className="mobile-project-card-footer">
                          <div className="mobile-project-lead">
                            <User size={12} />
                            <span>{p.team_lead_details ? (p.team_lead_details.first_name || p.team_lead_details.username) : 'Unassigned Lead'}</span>
                          </div>
                          <div className="mobile-project-budget">${parseFloat(p.budget || 0).toLocaleString()}</div>
                        </div>

                        <div className="mobile-project-actions">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSelectProject(p.id)}
                          >
                            <Eye size={13} /> Details
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setSelectedProjForLead(p);
                              setSelectedLeadId(p.team_lead || p.team_lead_details?.id || '');
                              setIsAssignLeadModalOpen(true);
                            }}
                          >
                            <UserCheck size={13} /> Lead
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ flex: '0 0 auto', padding: '0.45rem' }}
                            onClick={() => handleOpenEditProjModal(p)}
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ flex: '0 0 auto', padding: '0.45rem' }}
                            onClick={() => handleDeleteProject(p.id)}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            )
          )}

          {/* TAB 4: CLIENTS & LEADS */}
          {activeTab === 'clients' && (
            <div className="glass-card tab-content-card">
              <div className="section-header-row">
                <div className="section-title-wrap">
                  <h3 className="section-title">Client & Lead Directory</h3>
                  <span className="section-count-badge">{clients.length}</span>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setIsClientModalOpen(true)}>
                  <Plus size={14} /> Add Client / Lead
                </button>
              </div>

              {/* Quick Filter Pills */}
              <div className="filter-pills-bar">
                <button className={`filter-pill ${clientFilter === 'ALL' ? 'active' : ''}`} onClick={() => setClientFilter('ALL')}>
                  All ({clients.length})
                </button>
                <button className={`filter-pill ${clientFilter === 'ACTIVE' ? 'active' : ''}`} onClick={() => setClientFilter('ACTIVE')}>
                  Active Clients ({clients.filter(c => c.status === 'ACTIVE').length})
                </button>
                <button className={`filter-pill ${clientFilter === 'LEAD' ? 'active' : ''}`} onClick={() => setClientFilter('LEAD')}>
                  New Leads ({clients.filter(c => c.status === 'LEAD').length})
                </button>
                {clientFilter !== 'ALL' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setClientFilter('ALL')} style={{ marginLeft: 'auto', gap: '4px' }}>
                    <X size={14} /> Clear Filter ({clientFilter})
                  </button>
                )}
              </div>

              {clients.filter(c => clientFilter === 'ALL' || c.status === clientFilter).length === 0 ? (
                <div className="empty-section-state">
                  <div className="empty-section-icon">
                    <Building2 size={28} />
                  </div>
                  <h4 className="empty-section-title">
                    {clientFilter === 'ALL' ? 'No Clients or Leads Yet' : `No ${clientFilter === 'ACTIVE' ? 'Active Clients' : 'New Leads'} Found`}
                  </h4>
                  <p className="empty-section-desc">
                    {clientFilter === 'ALL' 
                      ? 'Add company contacts and sales leads to manage client relationships and issue invoices.'
                      : 'No clients match the current filter selection.'}
                  </p>
                  <div className="empty-section-actions">
                    {clientFilter !== 'ALL' ? (
                      <button className="btn btn-secondary btn-sm" onClick={() => setClientFilter('ALL')}>
                        Clear Filter
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => setIsClientModalOpen(true)}>
                        <Plus size={14} /> Add Client / Lead
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Client / Company Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Office Address</th>
                        <th>Type / Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients
                        .filter(c => clientFilter === 'ALL' || c.status === clientFilter)
                        .map((c) => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 700 }}>
                            {c.name}
                            {c.company && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.company}</div>}
                          </td>
                          <td>{c.email}</td>
                          <td>{c.phone || 'N/A'}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.address || 'N/A'}</td>
                          <td>
                            <span className={`badge ${c.status === 'ACTIVE' ? 'badge-active' : 'badge-lead'}`}>
                              {c.status === 'ACTIVE' ? 'Active Client' : 'New Lead'}
                            </span>
                          </td>
                          <td>
                            {c.status === 'LEAD' && (
                              <button className="btn btn-secondary btn-sm" onClick={() => handleConvertLead(c.id)}>
                                <CheckCircle size={14} color="var(--accent-emerald)" /> Convert to Active Client
                              </button>
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

          {/* TAB 5: INVOICES & FINANCIALS */}
          {activeTab === 'invoices' && (
            <div className="glass-card tab-content-card">
              <div className="section-header-row">
                <div className="section-title-wrap">
                  <h3 className="section-title">Invoices & Financial Tracker</h3>
                  <span className="section-count-badge">{invoices.length}</span>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleOpenCreateInvoiceModal}>
                  <Plus size={14} /> Create Invoice
                </button>
              </div>

              {invoices.length === 0 ? (
                <div className="empty-section-state">
                  <div className="empty-section-icon">
                    <DollarSign size={28} />
                  </div>
                  <h4 className="empty-section-title">No Invoices Created Yet</h4>
                  <p className="empty-section-desc">
                    Issue professional invoices for project milestones, track payment statuses, and share PDFs via email.
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={handleOpenCreateInvoiceModal}>
                    <Plus size={14} /> Create Invoice
                  </button>
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Client</th>
                        <th>Project</th>
                        <th>Amount</th>
                        <th>Total (+10% Tax)</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 800, color: 'var(--primary)' }}>#{inv.invoice_number}</td>
                          <td>{inv.client_name}</td>
                          <td>{inv.project_title || 'General Service'}</td>
                          <td>${parseFloat(inv.amount).toLocaleString()}</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>${parseFloat(inv.total_amount || 0).toLocaleString()}</td>
                          <td>{inv.due_date}</td>
                          <td><span className={`badge badge-${inv.status.toLowerCase()}`}>{inv.status}</span></td>
                        <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          {inv.status !== 'PAID' ? (
                            <button
                              className="btn btn-sm"
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.78rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                fontWeight: 600,
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleToggleInvoiceStatus(inv.id, 'PAID', inv.invoice_number)}
                              title="Mark Invoice as Paid"
                            >
                              <CheckCircle size={13} /> Mark Paid
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm"
                              style={{
                                padding: '4px 10px',
                                fontSize: '0.78rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                fontWeight: 600,
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleToggleInvoiceStatus(inv.id, 'UNPAID', inv.invoice_number)}
                              title="Revert to Unpaid"
                            >
                              Mark Unpaid
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            onClick={() => handleOpenViewInvoiceModal(inv)}
                            title="View Itemized Breakdown / Print"
                          >
                            <Eye size={13} /> View Items
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            onClick={() => handleSendInvoiceEmail(inv.id, inv.invoice_number, inv.client_name)}
                            title="Share Invoice Email with Client"
                          >
                            <Mail size={13} /> Share Email
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

          {/* TAB: ATTENDANCE & LEAVES */}
          {activeTab === 'attendance_leaves' && (
            <AttendanceAndLeavesView role="MANAGER" />
          )}

          {/* TAB 6: TEAMS MESSENGER */}

          {activeTab === 'messenger' && (
            <TeamsMessenger activeTab={activeTab} />
          )}

          {activeTab === 'profile' && (
            <UserProfile />
          )}
        </main>
      </div>

      {/* MODALS */}
      {/* MODAL 1: ADD SINGLE EMPLOYEE */}
      <Modal isOpen={isEmpModalOpen} onClose={() => setIsEmpModalOpen(false)} title="Add New Employee">
        <form onSubmit={handleAddEmployee}>
          <div className="form-row-2col">
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Employee ID (Username) *</label>
                <span className="badge badge-active" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>⚡ Auto Generated</span>
              </div>
              <input type="text" className="form-input" value={empForm.username} onChange={e => setEmpForm({...empForm, username: e.target.value})} placeholder="e.g. EMP-1004" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input type="email" className="form-input" value={empForm.email} onChange={e => setEmpForm({...empForm, email: e.target.value})} placeholder="employee@crm.com" required />
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input type="text" className="form-input" value={empForm.first_name} onChange={e => setEmpForm({...empForm, first_name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input type="text" className="form-input" value={empForm.last_name} onChange={e => setEmpForm({...empForm, last_name: e.target.value})} required />
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input type="text" className="form-input" placeholder="e.g. Senior Frontend Dev" value={empForm.designation} onChange={e => setEmpForm({...empForm, designation: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input type="text" className="form-input" placeholder="e.g. Engineering" value={empForm.department} onChange={e => setEmpForm({...empForm, department: e.target.value})} />
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="text" className="form-input" placeholder="e.g. +1 555-0192" value={empForm.phone} onChange={e => setEmpForm({...empForm, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">System Role *</label>
              <select className="form-select" value={empForm.role} onChange={e => setEmpForm({...empForm, role: e.target.value})} required>
                <option value="EMPLOYEE">Employee</option>
                <option value="TEAM_LEAD">Team Lead</option>
                <option value="MANAGER">Manager / Admin</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Experience (Years)</label>
            <input type="number" min="0" max="40" className="form-input" value={empForm.experience_years} onChange={e => setEmpForm({...empForm, experience_years: parseInt(e.target.value) || 0})} />
          </div>

          <div className="form-group">
            <label className="form-label">Default Password *</label>
            <input type="password" className="form-input" value={empForm.password} onChange={e => setEmpForm({...empForm, password: e.target.value})} required />
          </div>

          <div style={{ background: 'rgba(2, 132, 199, 0.1)', border: '1px solid rgba(2, 132, 199, 0.3)', color: 'var(--accent-cyan)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail size={16} flexShrink={0} />
            <span>Login credentials & portal details will be automatically emailed to <strong>{empForm.email || "the employee's email"}</strong>.</span>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>Create Staff Record & Send Email</button>
        </form>
      </Modal>

      {/* MODAL 1.5: EDIT EMPLOYEE / STAFF */}
      <Modal isOpen={isEditEmpModalOpen} onClose={() => setIsEditEmpModalOpen(false)} title="Edit Staff / Employee Record">
        <form onSubmit={handleUpdateEmployee}>
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input type="text" className="form-input" value={editEmpForm.username} onChange={e => setEditEmpForm({...editEmpForm, username: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input type="email" className="form-input" value={editEmpForm.email} onChange={e => setEditEmpForm({...editEmpForm, email: e.target.value})} required />
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input type="text" className="form-input" value={editEmpForm.first_name} onChange={e => setEditEmpForm({...editEmpForm, first_name: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input type="text" className="form-input" value={editEmpForm.last_name} onChange={e => setEditEmpForm({...editEmpForm, last_name: e.target.value})} required />
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">System Role</label>
              <select className="form-select" value={editEmpForm.role} onChange={e => setEditEmpForm({...editEmpForm, role: e.target.value})}>
                <option value="EMPLOYEE">Employee</option>
                <option value="TEAM_LEAD">Team Lead</option>
                <option value="MANAGER">Manager / Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Availability Status</label>
              <select className="form-select" value={editEmpForm.is_available ? 'true' : 'false'} onChange={e => setEditEmpForm({...editEmpForm, is_available: e.target.value === 'true'})}>
                <option value="true">Available (Unassigned)</option>
                <option value="false">Assigned to Active Project</option>
              </select>
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input type="text" className="form-input" value={editEmpForm.designation} onChange={e => setEditEmpForm({...editEmpForm, designation: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input type="text" className="form-input" value={editEmpForm.department} onChange={e => setEditEmpForm({...editEmpForm, department: e.target.value})} />
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="text" className="form-input" value={editEmpForm.phone} onChange={e => setEditEmpForm({...editEmpForm, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Experience (Years)</label>
              <input type="number" min="0" max="40" className="form-input" value={editEmpForm.experience_years} onChange={e => setEditEmpForm({...editEmpForm, experience_years: parseInt(e.target.value) || 0})} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Save Changes</button>
        </form>
      </Modal>

      {/* MODAL 2: BULK CSV EMPLOYEE UPLOAD */}
      <Modal isOpen={isCsvModalOpen} onClose={() => !isUploadingCsv && setIsCsvModalOpen(false)} title="Upload Employees via CSV">
        <div style={{ position: 'relative' }}>
          
          {/* UPLOADING SPINNER OVERLAY */}
          {isUploadingCsv && (
            <div className="csv-upload-overlay">
              <div className="csv-loader-ring"></div>
              <div>
                <div className="csv-loader-title">Importing Employees & Data...</div>
                <div className="csv-loader-sub">Parsing CSV records, generating Employee IDs, and building live cards</div>
              </div>
              <div className="csv-loader-bar">
                <div className="csv-loader-bar-fill"></div>
              </div>
            </div>
          )}

          <form onSubmit={handleCsvUpload}>
            <div className="form-group">
              <label className="form-label">Select CSV File</label>
              <input type="file" accept=".csv" className="form-input" disabled={isUploadingCsv} onChange={handleFileChange} />
            </div>

            <div style={{ textAlign: 'center', margin: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>OR PASTE CSV TEXT</div>

            <div className="form-group">
              <label className="form-label">CSV Data Text (Headers: email, first_name, last_name, designation, department, etc.)</label>
              <textarea
                className="form-textarea"
                rows={4}
                disabled={isUploadingCsv}
                placeholder={`email,first_name,last_name,designation,department\njohn@crm.com,John,Doe,Fullstack Developer,Engineering`}
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
              />
            </div>

            {/* LIVE CSV CARDS PREVIEW WHILE CHECKING DATA */}
            {(() => {
              const previewRecords = parseCsvPreview(csvText);
              if (previewRecords.length === 0) return null;
              return (
                <div className="csv-preview-container">
                  <div className="csv-preview-header">
                    <div className="csv-preview-title">
                      <Sparkles size={16} color="#f59e0b" />
                      Live Employee Cards Preview
                    </div>
                    <span className="badge badge-active">{previewRecords.length} Card(s) Ready to Import</span>
                  </div>
                  <div className="csv-preview-grid">
                    {previewRecords.map((rec, idx) => (
                      <div key={idx} className="csv-mini-card">
                        <div className="csv-mini-card-name">
                          {rec.first_name ? `${rec.first_name} ${rec.last_name}` : (rec.email || rec.username)}
                        </div>
                        <div className="csv-mini-card-sub">
                          <span><strong>ID:</strong> {rec.username}</span>
                          <span><strong>Role:</strong> {rec.role}</span>
                          <span><strong>Designation:</strong> {rec.designation} ({rec.department})</span>
                          <span><strong>Email:</strong> {rec.email}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isUploadingCsv}
              style={{ width: '100%', marginTop: '1.25rem', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {isUploadingCsv ? (
                <>
                  <Loader2 size={18} className="spin-loader-icon" />
                  <span>Importing Data & Building Cards...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Upload & Import Employees into Cards</span>
                </>
              )}
            </button>
          </form>
        </div>
      </Modal>

      {/* MODAL 3: CREATE PROJECT */}
      <Modal isOpen={isProjModalOpen} onClose={() => setIsProjModalOpen(false)} title="Create New Project">
        <form onSubmit={handleCreateProject}>
          <div className="form-group">
            <label className="form-label">Project Title</label>
            <input type="text" className="form-input" value={projForm.title} onChange={e => setProjForm({...projForm, title: e.target.value})} required />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={3} value={projForm.description} onChange={e => setProjForm({...projForm, description: e.target.value})} />
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Select Client</label>
              <select className="form-select" value={projForm.client} onChange={e => setProjForm({...projForm, client: e.target.value})} required>
                <option value="">-- Choose Client --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assign Team Lead</label>
              <select className="form-select" value={projForm.team_lead} onChange={e => setProjForm({...projForm, team_lead: e.target.value})}>
                <option value="">-- Select Team Lead --</option>
                {teamLeads.map(tl => <option key={tl.id} value={tl.id}>{tl.first_name ? `${tl.first_name} ${tl.last_name}` : tl.username}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Budget ($)</label>
              <input type="number" className="form-input" value={projForm.budget} onChange={e => setProjForm({...projForm, budget: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={projForm.status} onChange={e => setProjForm({...projForm, status: e.target.value})}>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={projForm.start_date || ''} onChange={e => setProjForm({...projForm, start_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Target End Date</label>
              <input type="date" className="form-input" value={projForm.end_date || ''} onChange={e => setProjForm({...projForm, end_date: e.target.value})} />
            </div>
          </div>

          {/* UPLOAD IMAGES SECTION (UP TO 5 IMAGES) */}
          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Upload Project Images <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>(Up to 5 images)</span>
              </label>
              <span className="badge" style={{ background: projImages.length >= 5 ? '#fef3c7' : '#e0e7ff', color: projImages.length >= 5 ? '#d97706' : '#4338ca', fontWeight: 700 }}>
                {projImages.length} / 5 Images Selected
              </span>
            </div>

            <div className="file-dropzone-box" onClick={() => document.getElementById('create-proj-images-input').click()}>
              <input
                id="create-proj-images-input"
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleProjImagesSelect(e, false)}
                disabled={projImages.length >= 5}
              />
              <Image size={24} color="var(--primary)" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>Click or Drag to Upload Images (Max 5)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PNG, JPG, WEBP formats supported</div>
              </div>
            </div>

            {/* PREVIEW OF ATTACHED IMAGES */}
            {projImagePreviews.length > 0 && (
              <div className="media-preview-grid">
                {projImagePreviews.map((imgObj, idx) => (
                  <div key={idx} className="media-preview-thumb">
                    <img src={imgObj.url} alt={`Preview ${idx + 1}`} />
                    <button
                      type="button"
                      className="media-thumb-remove"
                      onClick={() => removeProjImage(idx, false)}
                      title="Remove image"
                    >
                      <X size={12} />
                    </button>
                    <span className="media-thumb-badge">#{idx + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* UPLOAD PROJECT PDF FILE SECTION */}
          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <label className="form-label">
              Upload Project PDF Document <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>(Optional - Specs, Contract, Proposal)</span>
            </label>

            {!projPdfFile ? (
              <div className="file-dropzone-box" onClick={() => document.getElementById('create-proj-pdf-input').click()}>
                <input
                  id="create-proj-pdf-input"
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => handleProjPdfSelect(e, false)}
                />
                <FileUp size={24} color="#e11d48" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>Click to Upload Project PDF File</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Only PDF (.pdf) documents allowed</div>
                </div>
              </div>
            ) : (
              <div className="pdf-preview-box">
                <div className="pdf-info-group">
                  <FileText size={22} color="#e11d48" />
                  <div>
                    <div className="pdf-filename">{projPdfFile.name}</div>
                    <div className="pdf-filesize">{(projPdfFile.size / (1024 * 1024)).toFixed(2)} MB • PDF Document</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-remove-pdf"
                  onClick={() => removeProjPdf(false)}
                  title="Remove PDF"
                >
                  <X size={14} /> Remove
                </button>
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', padding: '0.75rem' }}>Upload & Save Project</button>
        </form>
      </Modal>

      {/* MODAL 3.5: EDIT PROJECT */}
      <Modal isOpen={isEditProjModalOpen} onClose={() => setIsEditProjModalOpen(false)} title="Edit Project Details">
        <form onSubmit={handleUpdateProject}>
          <div className="form-group">
            <label className="form-label">Project Title *</label>
            <input type="text" className="form-input" value={editProjForm.title} onChange={e => setEditProjForm({...editProjForm, title: e.target.value})} required />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={3} value={editProjForm.description} onChange={e => setEditProjForm({...editProjForm, description: e.target.value})} />
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Select Client *</label>
              <select className="form-select" value={editProjForm.client} onChange={e => setEditProjForm({...editProjForm, client: e.target.value})} required>
                <option value="">-- Choose Client --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assign Team Lead</label>
              <select className="form-select" value={editProjForm.team_lead || ''} onChange={e => setEditProjForm({...editProjForm, team_lead: e.target.value})}>
                <option value="">-- Unassigned --</option>
                {teamLeads.map(tl => <option key={tl.id} value={tl.id}>{tl.first_name ? `${tl.first_name} ${tl.last_name}` : tl.username}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Budget ($)</label>
              <input type="number" className="form-input" value={editProjForm.budget} onChange={e => setEditProjForm({...editProjForm, budget: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={editProjForm.status} onChange={e => setEditProjForm({...editProjForm, status: e.target.value})}>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={editProjForm.start_date || ''} onChange={e => setEditProjForm({...editProjForm, start_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Target End Date</label>
              <input type="date" className="form-input" value={editProjForm.end_date || ''} onChange={e => setEditProjForm({...editProjForm, end_date: e.target.value})} />
            </div>
          </div>

          {/* EDIT PROJECT IMAGES SECTION */}
          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                Project Images <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>(Up to 5 total)</span>
              </label>
              <span className="badge" style={{ background: (existingProjImages.length + editProjImages.length) >= 5 ? '#fef3c7' : '#e0e7ff', color: (existingProjImages.length + editProjImages.length) >= 5 ? '#d97706' : '#4338ca', fontWeight: 700 }}>
                {existingProjImages.length + editProjImages.length} / 5 Images
              </span>
            </div>

            {/* Existing Images from Server */}
            {existingProjImages.length > 0 && (
              <div style={{ marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Existing Project Images:</div>
                <div className="media-preview-grid">
                  {existingProjImages.map((img) => (
                    <div key={img.id} className="media-preview-thumb">
                      <img src={img.image_url || img.image} alt="Project media" />
                      <button
                        type="button"
                        className="media-thumb-remove"
                        onClick={() => handleDeleteExistingImage(img.id)}
                        title="Delete image from server"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Images Dropzone */}
            {(existingProjImages.length + editProjImages.length) < 5 && (
              <div className="file-dropzone-box" onClick={() => document.getElementById('edit-proj-images-input').click()}>
                <input
                  id="edit-proj-images-input"
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => handleProjImagesSelect(e, true)}
                />
                <Image size={24} color="var(--primary)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>+ Add More Images</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Upload additional project images</div>
                </div>
              </div>
            )}

            {/* Previews of newly selected images */}
            {editProjImagePreviews.length > 0 && (
              <div style={{ marginTop: '0.6rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>Newly Selected Images to Upload:</div>
                <div className="media-preview-grid">
                  {editProjImagePreviews.map((imgObj, idx) => (
                    <div key={idx} className="media-preview-thumb">
                      <img src={imgObj.url} alt={`New Preview ${idx + 1}`} />
                      <button
                        type="button"
                        className="media-thumb-remove"
                        onClick={() => removeProjImage(idx, true)}
                        title="Remove new image"
                      >
                        <X size={12} />
                      </button>
                      <span className="media-thumb-badge">New #{idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* EDIT PROJECT PDF SECTION */}
          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <label className="form-label">
              Project PDF Document
            </label>

            {/* Existing PDF File */}
            {existingProjPdfUrl && !editProjPdfFile && (
              <div className="pdf-preview-box" style={{ marginBottom: '0.6rem', borderStyle: 'solid' }}>
                <div className="pdf-info-group">
                  <FileText size={22} color="#e11d48" />
                  <div>
                    <div className="pdf-filename">Existing Project Document.pdf</div>
                    <a href={existingProjPdfUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <ExternalLink size={12} /> View/Download Current PDF
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-remove-pdf"
                  onClick={handleDeleteExistingPdf}
                  title="Delete PDF from server"
                >
                  <X size={14} /> Remove PDF
                </button>
              </div>
            )}

            {/* Newly Selected PDF */}
            {editProjPdfFile ? (
              <div className="pdf-preview-box">
                <div className="pdf-info-group">
                  <FileText size={22} color="#e11d48" />
                  <div>
                    <div className="pdf-filename">{editProjPdfFile.name} (New)</div>
                    <div className="pdf-filesize">{(editProjPdfFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-remove-pdf"
                  onClick={() => removeProjPdf(true)}
                  title="Remove selected PDF"
                >
                  <X size={14} /> Remove
                </button>
              </div>
            ) : (!existingProjPdfUrl && (
              <div className="file-dropzone-box" onClick={() => document.getElementById('edit-proj-pdf-input').click()}>
                <input
                  id="edit-proj-pdf-input"
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => handleProjPdfSelect(e, true)}
                />
                <FileUp size={24} color="#e11d48" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>Click to Upload/Replace Project PDF File</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PDF documents only (.pdf)</div>
                </div>
              </div>
            ))}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', padding: '0.75rem' }}>Save Project Changes</button>
        </form>
      </Modal>

      {/* MODAL 4: ASSIGN / REASSIGN TEAM LEAD */}
      <Modal isOpen={isAssignLeadModalOpen} onClose={() => setIsAssignLeadModalOpen(false)} title={`${(selectedProjForLead?.team_lead || selectedProjForLead?.team_lead_details) ? 'Change / Reassign Team Lead' : 'Assign Team Lead'}: ${selectedProjForLead?.title}`}>
        <form onSubmit={handleAssignLead}>
          <div className="form-group">
            <label className="form-label">Select Team Lead</label>
            <select className="form-select" value={selectedLeadId} onChange={e => setSelectedLeadId(e.target.value)} required>
              <option value="">-- Choose Team Lead --</option>
              {teamLeads.map(tl => (
                <option key={tl.id} value={tl.id}>
                  {tl.first_name ? `${tl.first_name} ${tl.last_name}` : tl.username} ({tl.department || 'Lead'})
                  {(selectedProjForLead?.team_lead === tl.id || selectedProjForLead?.team_lead_details?.id === tl.id) ? ' ★ (Current Lead)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            {(selectedProjForLead?.team_lead || selectedProjForLead?.team_lead_details) ? 'Update Lead Assignment' : 'Confirm Assignment'}
          </button>
        </form>
      </Modal>

      {/* MODAL 5: ADD CLIENT */}
      <Modal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Add Client or New Lead">
        <form onSubmit={handleCreateClient}>
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Client Name *</label>
              <input type="text" className="form-input" value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} placeholder="e.g. John Smith" required />
            </div>
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input type="text" className="form-input" value={clientForm.company} onChange={e => setClientForm({...clientForm, company: e.target.value})} placeholder="e.g. Acme Corp" />
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input type="email" className="form-input" value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value})} placeholder="client@acme.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input type="tel" className="form-input" value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} placeholder="+1 (555) 000-0000" required />
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Type / Status</label>
              <select className="form-select" value={clientForm.status} onChange={e => setClientForm({...clientForm, status: e.target.value})}>
                <option value="LEAD">New Lead</option>
                <option value="ACTIVE">Active Client</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Office Address</label>
              <input type="text" className="form-input" value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value})} placeholder="100 Silicon Valley Way, CA" />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Save Client Record</button>
        </form>
      </Modal>

      {/* MODAL 6: CREATE INVOICE */}
      <Modal isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} title="Create New Invoice">
        <form onSubmit={handleCreateInvoice}>
          {/* Row 1: Invoice Number & Select Project */}
          <div className="form-row-2col">
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Invoice Number</label>
                <span className="badge badge-active" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>⚡ Auto-Generated</span>
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. INV-2026-003"
                value={invoiceForm.invoice_number}
                onChange={e => setInvoiceForm({...invoiceForm, invoice_number: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Select Project (Auto-Fills Amount & Client)</label>
              <select
                className="form-select"
                value={invoiceForm.project}
                onChange={e => handleProjectSelectForInvoice(e.target.value)}
              >
                <option value="">-- Choose Project (Optional) --</option>
                {projects
                  .filter(p => !invoiceForm.client || p.client === parseInt(invoiceForm.client) || p.client_details?.id === parseInt(invoiceForm.client))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.client_details?.name || 'Client'}) — ${parseFloat(p.budget || 0).toLocaleString()}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Row 2: Select Client & Base Amount */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Select Client *</label>
              <select
                className="form-select"
                value={invoiceForm.client}
                onChange={e => setInvoiceForm({...invoiceForm, client: e.target.value})}
                required
              >
                <option value="">-- Choose Client --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company || 'Individual'})</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Subtotal Base Amount ($) *</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                placeholder="0.00"
                value={invoiceForm.amount}
                onChange={e => setInvoiceForm({...invoiceForm, amount: e.target.value})}
                required
              />
            </div>
          </div>

          {/* Line Items Builder */}
          <div style={{ marginTop: '0.5rem', marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.85rem', background: 'var(--bg-input)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>Itemized Services / Deliverables</span>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handleAddInvoiceItem}
              >
                <Plus size={12} /> Add Item
              </button>
            </div>

            {(invoiceForm.items || []).map((itm, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1.5fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Deliverable description"
                  value={itm.description}
                  onChange={(e) => handleUpdateInvoiceItem(idx, 'description', e.target.value)}
                  required
                />
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  className="form-input"
                  placeholder="Qty"
                  value={itm.quantity}
                  onChange={(e) => handleUpdateInvoiceItem(idx, 'quantity', e.target.value)}
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="Unit Price ($)"
                  value={itm.unit_price}
                  onChange={(e) => handleUpdateInvoiceItem(idx, 'unit_price', e.target.value)}
                  required
                />
                {(invoiceForm.items || []).length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger btn-xs"
                    onClick={() => handleRemoveInvoiceItem(idx)}
                    title="Remove item"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Row 3: Tax Rate & Due Date */}
          <div className="form-row-2col">
            <div className="form-group">
              <label className="form-label">Tax Rate (%)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={invoiceForm.tax_rate}
                onChange={e => setInvoiceForm({...invoiceForm, tax_rate: e.target.value})}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Due Date *</label>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <button type="button" className="filter-pill" style={{ padding: '1px 5px', fontSize: '0.68rem' }} onClick={() => setInvoiceDueDateOffset(15)}>+15d</button>
                  <button type="button" className="filter-pill" style={{ padding: '1px 5px', fontSize: '0.68rem' }} onClick={() => setInvoiceDueDateOffset(30)}>+30d</button>
                  <button type="button" className="filter-pill" style={{ padding: '1px 5px', fontSize: '0.68rem' }} onClick={() => setInvoiceDueDateOffset(60)}>+60d</button>
                </div>
              </div>
              <input
                type="date"
                className="form-input"
                value={invoiceForm.due_date}
                onChange={e => setInvoiceForm({...invoiceForm, due_date: e.target.value})}
                required
              />
            </div>
          </div>

          {/* LIVE BILLING BREAKDOWN SUMMARY */}
          {invoiceForm.amount && parseFloat(invoiceForm.amount) > 0 && (
            <div style={{
              background: 'var(--bg-input, #f8fafc)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              marginTop: '0.5rem',
              marginBottom: '0.85rem'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>Invoice Financial Summary</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                <span>Subtotal Base Amount:</span>
                <strong>${parseFloat(invoiceForm.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span>Tax ({invoiceForm.tax_rate || 0}%):</span>
                <span>+${((parseFloat(invoiceForm.amount || 0) * parseFloat(invoiceForm.tax_rate || 0)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{
                display: 'flex',
                justify: 'space-between',
                fontSize: '0.95rem',
                fontWeight: 800,
                color: 'var(--primary, #4f46e5)',
                paddingTop: '6px',
                borderTop: '1px dashed var(--border-color, #cbd5e1)'
              }}>
                <span>Total Billed Amount:</span>
                <span>${(parseFloat(invoiceForm.amount || 0) + (parseFloat(invoiceForm.amount || 0) * parseFloat(invoiceForm.tax_rate || 0)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}>
            Generate & Issue Invoice
          </button>
        </form>
      </Modal>

      {/* MODAL 7: VIEW ITEMISED INVOICE RECEIPT */}
      <Modal isOpen={isViewInvoiceModalOpen} onClose={() => setIsViewInvoiceModalOpen(false)} title={`Invoice Breakdown: #${viewingInvoice?.invoice_number || ''}`}>
        {viewingInvoice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>#{viewingInvoice.invoice_number}</h3>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', marginTop: '4px' }}>
                  Client: <strong>{viewingInvoice.client_name}</strong> {viewingInvoice.client_company && `(${viewingInvoice.client_company})`}
                </div>
                {viewingInvoice.project_title && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Project: {viewingInvoice.project_title}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge badge-${viewingInvoice.status?.toLowerCase()}`} style={{ fontSize: '0.82rem', padding: '4px 10px' }}>
                  {viewingInvoice.status}
                </span>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Due Date: <strong>{viewingInvoice.due_date}</strong>
                </div>
              </div>
            </div>

            {/* Line items table */}
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>Itemized Services & Deliverables</h4>
              {viewingInvoice.items && viewingInvoice.items.length > 0 ? (
                <div className="table-responsive">
                  <table className="crm-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th style={{ textAlign: 'center' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Unit Price</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingInvoice.items.map(itm => (
                        <tr key={itm.id}>
                          <td><strong>{itm.description}</strong></td>
                          <td style={{ textAlign: 'center' }}>{itm.quantity}</td>
                          <td style={{ textAlign: 'right' }}>${parseFloat(itm.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right' }}>${parseFloat(itm.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Standard single-service invoice billing (${parseFloat(viewingInvoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}).
                </div>
              )}
            </div>

            {/* Financial summary breakdown */}
            <div style={{ background: 'var(--bg-hover)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.35rem' }}>
                <span>Subtotal Base Amount:</span>
                <strong>${parseFloat(viewingInvoice.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                <span>Tax Rate ({viewingInvoice.tax_rate || 0}%):</span>
                <span>+${((parseFloat(viewingInvoice.amount || 0) * parseFloat(viewingInvoice.tax_rate || 0)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-emerald)', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                <span>Grand Total:</span>
                <span>${parseFloat(viewingInvoice.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={16} /> Print Receipt
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setIsViewInvoiceModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Invoices and other modals continue above. Global NotificationModal handles feedback across all views */}

    </div>
  );
};

export default ManagerDashboard;
