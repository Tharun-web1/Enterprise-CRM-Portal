import React, { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare, Paperclip, Send, Download, Trash2,
  FileText, Image as ImageIcon, FileArchive, File, Loader2, Plus
} from 'lucide-react';
import './TaskDiscussionAndAttachments.css';

const TaskDiscussionAndAttachments = ({ task, onTaskUpdated }) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('comments'); // 'comments' | 'attachments'
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const comments = task?.comments || [];
  const attachments = task?.attachments || [];

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || isPostingComment) return;

    try {
      setIsPostingComment(true);
      const res = await api.post(`/tasks/${task.id}/add-comment/`, {
        comment: commentText.trim()
      });
      setCommentText('');
      if (onTaskUpdated) {
        onTaskUpdated({
          ...task,
          comments: [...(task.comments || []), res.data]
        });
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      setUploadError(null);
      const res = await api.post(`/tasks/${task.id}/upload-attachment/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (onTaskUpdated) {
        onTaskUpdated({
          ...task,
          attachments: [res.data, ...(task.attachments || [])]
        });
      }
    } catch (err) {
      console.error('Failed to upload attachment:', err);
      setUploadError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;
    try {
      await api.delete(`/tasks/${task.id}/delete-attachment/${attachmentId}/`);
      if (onTaskUpdated) {
        onTaskUpdated({
          ...task,
          attachments: (task.attachments || []).filter(a => a.id !== attachmentId)
        });
      }
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  const getFileIcon = (fileName = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return <ImageIcon size={18} className="file-icon-img" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <FileArchive size={18} className="file-icon-zip" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
      return <FileText size={18} className="file-icon-doc" />;
    }
    return <File size={18} className="file-icon-general" />;
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="task-collaboration-box">
      {/* Sub-tab Switcher */}
      <div className="task-collab-tabs">
        <button
          type="button"
          className={`task-collab-tab-btn ${activeSubTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('comments')}
        >
          <MessageSquare size={16} />
          <span>Discussion ({comments.length})</span>
        </button>

        <button
          type="button"
          className={`task-collab-tab-btn ${activeSubTab === 'attachments' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('attachments')}
        >
          <Paperclip size={16} />
          <span>Attachments ({attachments.length})</span>
        </button>
      </div>

      {/* COMMENTS TAB */}
      {activeSubTab === 'comments' && (
        <div className="task-comments-section">
          <div className="task-comments-feed">
            {comments.length === 0 ? (
              <div className="task-collab-empty">
                <p>No comments yet. Start the conversation below!</p>
              </div>
            ) : (
              comments.map(c => {
                const isMe = c.author === user?.id;
                const authorName = c.author_details?.first_name
                  ? `${c.author_details.first_name} ${c.author_details.last_name}`
                  : c.author_details?.username || 'User';
                const roleDisplay = c.author_details?.role?.replace(/_/g, ' ') || '';

                return (
                  <div key={c.id} className={`task-comment-bubble ${isMe ? 'my-comment' : ''}`}>
                    <div className="task-comment-header">
                      <span className="task-comment-author">{authorName}</span>
                      {roleDisplay && <span className="task-comment-role">{roleDisplay}</span>}
                      <span className="task-comment-time">{formatTimeAgo(c.created_at)}</span>
                    </div>
                    <div className="task-comment-body">{c.comment}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* Comment input box */}
          <form className="task-comment-input-bar" onSubmit={handlePostComment}>
            <input
              type="text"
              placeholder="Write feedback, question, or update..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={isPostingComment}
            />
            <button
              type="submit"
              className="task-comment-send-btn"
              disabled={!commentText.trim() || isPostingComment}
            >
              {isPostingComment ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      )}

      {/* ATTACHMENTS TAB */}
      {activeSubTab === 'attachments' && (
        <div className="task-attachments-section">
          {/* Upload trigger */}
          <div className="task-attachment-upload-zone">
            <label className="task-upload-file-label">
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={isUploading}
                style={{ display: 'none' }}
              />
              <Plus size={16} />
              <span>{isUploading ? 'Uploading File...' : 'Upload File / Deliverable'}</span>
            </label>
            {uploadError && <span className="task-upload-err">{uploadError}</span>}
          </div>

          {/* Attachments List */}
          <div className="task-attachments-list">
            {attachments.length === 0 ? (
              <div className="task-collab-empty">
                <p>No attachments uploaded yet.</p>
              </div>
            ) : (
              attachments.map(att => (
                <div key={att.id} className="task-attachment-item">
                  <div className="task-att-left">
                    <div className="task-att-icon">{getFileIcon(att.file_name)}</div>
                    <div className="task-att-meta">
                      <span className="task-att-name" title={att.file_name}>{att.file_name}</span>
                      <span className="task-att-sub">
                        {att.file_size || ''} · Uploaded by {att.uploaded_by_details?.first_name || att.uploaded_by_details?.username}
                      </span>
                    </div>
                  </div>
                  <div className="task-att-actions">
                    <a
                      href={att.file_url || att.file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="task-att-btn download"
                      title="Download / View"
                    >
                      <Download size={15} />
                    </a>
                    {(att.uploaded_by === user?.id || ['MANAGER', 'TEAM_LEAD'].includes(user?.role)) && (
                      <button
                        type="button"
                        className="task-att-btn delete"
                        onClick={() => handleDeleteAttachment(att.id)}
                        title="Delete File"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskDiscussionAndAttachments;
