import React, { useEffect, useState } from 'react';
import './ProgressBar.css';

/**
 * Linear Animated Progress Bar
 */
export const LinearProgressBar = ({
  progress = 0,
  showLabel = true,
  height = 8,
  gradient = 'default',
  animated = true
}) => {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const clampedProgress = Math.min(100, Math.max(0, progress));

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth(clampedProgress);
    }, 50);
    return () => clearTimeout(timer);
  }, [clampedProgress]);

  // Color theme class based on percentage
  let colorClass = 'progress-gradient-primary';
  if (gradient === 'cyan') colorClass = 'progress-gradient-cyan';
  else if (gradient === 'emerald') colorClass = 'progress-gradient-emerald';
  else if (gradient === 'amber') colorClass = 'progress-gradient-amber';
  else if (gradient === 'rose') colorClass = 'progress-gradient-rose';
  else if (clampedProgress >= 80) colorClass = 'progress-gradient-emerald';
  else if (clampedProgress >= 40) colorClass = 'progress-gradient-cyan';
  else colorClass = 'progress-gradient-amber';

  return (
    <div className="progress-bar-container">
      {showLabel && (
        <div className="progress-bar-header">
          <span className="progress-label">Completion Progress</span>
          <span className="progress-percent">{clampedProgress}%</span>
        </div>
      )}
      <div className="progress-track" style={{ height: `${height}px` }}>
        <div
          className={`progress-fill ${colorClass} ${animated ? 'animated-shimmer' : ''}`}
          style={{ width: `${animatedWidth}%`, height: `${height}px` }}
        >
          <div className="progress-glow-tip" />
        </div>
      </div>
    </div>
  );
};

/**
 * Animated SVG Radial Progress Ring Component
 */
export const RadialProgressRing = ({
  progress = 0,
  size = 76,
  strokeWidth = 7,
  label = '',
  sublabel = '',
  color = 'auto'
}) => {
  const [offset, setOffset] = useState(0);
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;
    const timer = setTimeout(() => {
      setOffset(strokeDashoffset);
    }, 60);
    return () => clearTimeout(timer);
  }, [clampedProgress, circumference]);

  let strokeGradient = 'url(#ringGradientPrimary)';
  if (color === 'emerald' || (color === 'auto' && clampedProgress >= 80)) strokeGradient = 'url(#ringGradientEmerald)';
  else if (color === 'cyan' || (color === 'auto' && clampedProgress >= 40)) strokeGradient = 'url(#ringGradientCyan)';
  else if (color === 'amber' || (color === 'auto' && clampedProgress >= 20)) strokeGradient = 'url(#ringGradientAmber)';
  else if (color === 'rose') strokeGradient = 'url(#ringGradientRose)';

  return (
    <div className="radial-ring-wrapper" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="radial-ring-svg">
        <defs>
          <linearGradient id="ringGradientPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="ringGradientCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="ringGradientEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id="ringGradientAmber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id="ringGradientRose" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>

        <circle
          className="radial-ring-bg"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
        />

        <circle
          className="radial-ring-circle"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={strokeGradient}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>

      <div className="radial-ring-text">
        <span className="radial-ring-number">{clampedProgress}%</span>
        {sublabel && <span className="radial-ring-sub">{sublabel}</span>}
      </div>
    </div>
  );
};

/**
 * Multi-Segment Task Breakdown Bar
 */
export const SegmentedTaskBar = ({
  completed = 0,
  inReview = 0,
  inProgress = 0,
  todo = 0,
  total = 0
}) => {
  const maxTotal = total || (completed + inReview + inProgress + todo) || 1;
  const pCompleted = (completed / maxTotal) * 100;
  const pReview = (inReview / maxTotal) * 100;
  const pProgress = (inProgress / maxTotal) * 100;
  const pTodo = (todo / maxTotal) * 100;

  return (
    <div className="segmented-bar-container">
      <div className="segmented-track">
        {pCompleted > 0 && (
          <div
            className="segmented-portion seg-completed"
            style={{ width: `${pCompleted}%` }}
            title={`Completed: ${completed}`}
          />
        )}
        {pReview > 0 && (
          <div
            className="segmented-portion seg-review"
            style={{ width: `${pReview}%` }}
            title={`In Review: ${inReview}`}
          />
        )}
        {pProgress > 0 && (
          <div
            className="segmented-portion seg-progress"
            style={{ width: `${pProgress}%` }}
            title={`In Progress: ${inProgress}`}
          />
        )}
        {pTodo > 0 && (
          <div
            className="segmented-portion seg-todo"
            style={{ width: `${pTodo}%` }}
            title={`To Do: ${todo}`}
          />
        )}
      </div>

      <div className="segmented-legend">
        <span className="legend-item"><i className="dot dot-completed" /> {completed} Done</span>
        <span className="legend-item"><i className="dot dot-review" /> {inReview} Review</span>
        <span className="legend-item"><i className="dot dot-progress" /> {inProgress} Active</span>
        <span className="legend-item"><i className="dot dot-todo" /> {todo} ToDo</span>
      </div>
    </div>
  );
};

export default LinearProgressBar;
