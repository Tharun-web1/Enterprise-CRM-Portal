import React from 'react';

export const Spinner = ({ size = 'sm', color = 'currentColor', style = {} }) => {
  const dimension = size === 'xs' ? '12px' : size === 'sm' ? '16px' : size === 'lg' ? '28px' : '20px';
  const borderWidth = size === 'xs' || size === 'sm' ? '2px' : '3px';

  return (
    <span
      style={{
        display: 'inline-block',
        width: dimension,
        height: dimension,
        border: `${borderWidth} solid ${color}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spinner-rotate 0.75s linear infinite',
        verticalAlign: 'middle',
        boxSizing: 'border-box',
        ...style,
      }}
    />
  );
};

// Add CSS keyframe dynamically if not already injected
if (typeof document !== 'undefined') {
  const styleId = 'spinner-keyframes-style';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      @keyframes spinner-rotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleEl);
  }
}

export default Spinner;
