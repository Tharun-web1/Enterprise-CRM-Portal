import React from 'react';
import { ShieldCheck } from 'lucide-react';
import './BrandLogo.css';

const BrandLogo = ({ size = 'normal', showIcon = true, className = '' }) => {
  return (
    <div className={`brand-logo-container ${size} ${className}`}>
      {showIcon && (
        <div className="brand-logo-icon-box">
          <ShieldCheck size={size === 'large' ? 32 : size === 'small' ? 22 : 26} className="brand-logo-icon" />
        </div>
      )}
      <div className="brand-text-wrapper">
        <div className="brand-name-stack">
          <span className="brand-name-top">SS</span>
          <span className="brand-name-bottom">CHAKRAVARTHY</span>
        </div>
        <div className="brand-vertical-line" />
        <span className="brand-crm-tag">CRM</span>
      </div>
    </div>
  );
};

export default BrandLogo;
