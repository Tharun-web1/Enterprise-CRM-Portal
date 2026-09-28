import React from 'react';
import './Skeleton.css';

export const Skeleton = ({ width, height, borderRadius, style = {}, className = '' }) => {
  return (
    <span
      className={`skeleton-box ${className}`}
      style={{
        width: width || '100%',
        height: height || '1rem',
        borderRadius: borderRadius || '6px',
        ...style,
      }}
    />
  );
};

export const SkeletonCard = ({ count = 3 }) => {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width="40%" height="1.25rem" />
            <Skeleton width="20%" height="1.25rem" borderRadius="12px" />
          </div>
          <Skeleton width="85%" height="0.9rem" />
          <Skeleton width="60%" height="0.9rem" />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Skeleton width="30%" height="1.8rem" borderRadius="6px" />
            <Skeleton width="30%" height="1.8rem" borderRadius="6px" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonStats = ({ count = 4 }) => {
  return (
    <div className="skeleton-stat-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-stat-card" key={index}>
          <Skeleton width="48px" height="48px" borderRadius="12px" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Skeleton width="50%" height="0.8rem" />
            <Skeleton width="75%" height="1.4rem" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonTable = ({ rows = 5 }) => {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-row" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '0.75rem' }}>
        <Skeleton width="25%" height="1rem" />
        <Skeleton width="20%" height="1rem" />
        <Skeleton width="20%" height="1rem" />
        <Skeleton width="15%" height="1rem" />
        <Skeleton width="10%" height="1rem" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-table-row" key={index}>
          <Skeleton width="25%" height="0.9rem" />
          <Skeleton width="20%" height="0.9rem" />
          <Skeleton width="20%" height="0.9rem" />
          <Skeleton width="15%" height="0.9rem" borderRadius="10px" />
          <Skeleton width="10%" height="0.9rem" />
        </div>
      ))}
    </div>
  );
};

export const SkeletonMessage = () => {
  return (
    <div className="skeleton-message-group">
      <div className="skeleton-message">
        <Skeleton width="36px" height="36px" borderRadius="50%" style={{ flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '220px' }}>
          <Skeleton width="40%" height="0.75rem" />
          <Skeleton width="100%" height="2.5rem" borderRadius="12px" />
        </div>
      </div>
      <div className="skeleton-message right">
        <Skeleton width="36px" height="36px" borderRadius="50%" style={{ flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '240px', alignItems: 'flex-end' }}>
          <Skeleton width="35%" height="0.75rem" />
          <Skeleton width="100%" height="2.8rem" borderRadius="12px" />
        </div>
      </div>
      <div className="skeleton-message">
        <Skeleton width="36px" height="36px" borderRadius="50%" style={{ flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '180px' }}>
          <Skeleton width="50%" height="0.75rem" />
          <Skeleton width="100%" height="2.2rem" borderRadius="12px" />
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
