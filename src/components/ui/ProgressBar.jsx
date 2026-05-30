import React from 'react';

const SIZE_HEIGHTS = {
  sm: 4,
  md: 8,
};

function getAutoColor(value) {
  if (value >= 80) return '#10b981'; // green
  if (value >= 40) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

function ProgressBar({
  value = 0,
  size = 'md',
  colorAuto = false,
  color,
  label,
  showPercent = false,
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const resolvedColor = color || (colorAuto ? getAutoColor(clamped) : '#3b82f6');
  const height = SIZE_HEIGHTS[size] || SIZE_HEIGHTS.md;

  const trackStyle = {
    width: '100%',
    height,
    backgroundColor: '#e5e7eb',
    borderRadius: height,
    overflow: 'hidden',
  };

  const fillStyle = {
    width: `${clamped}%`,
    height: '100%',
    backgroundColor: resolvedColor,
    borderRadius: height,
    transition: 'width 0.3s ease',
  };

  return (
    <div className="ui-progress">
      {(label || showPercent) && (
        <div
          className="ui-progress__header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4,
            fontSize: '0.78rem',
            color: '#6b7280',
          }}
        >
          {label && <span className="ui-progress__label">{label}</span>}
          {showPercent && (
            <span className="ui-progress__percent">{Math.round(clamped)}%</span>
          )}
        </div>
      )}
      <div
        className="ui-progress__track"
        style={trackStyle}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="ui-progress__fill" style={fillStyle} />
      </div>
    </div>
  );
}

export default ProgressBar;
