import React from 'react';
import { JOB_STATUS_COLORS, JOB_STATUS_LABELS } from '../../utils/constants.js';

const SIZE_STYLES = {
  sm: { fontSize: '0.7rem', padding: '1px 7px', borderRadius: '999px' },
  md: { fontSize: '0.78rem', padding: '2px 10px', borderRadius: '999px' },
};

function StatusChip({ status, label, size = 'md' }) {
  const color = JOB_STATUS_COLORS[status] || '#6b7280';
  const text = label || JOB_STATUS_LABELS[status] || status || 'Unknown';
  const sizeStyle = SIZE_STYLES[size] || SIZE_STYLES.md;

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: color + '22',
    color: color,
    border: `1px solid ${color}55`,
    fontWeight: 600,
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
    ...sizeStyle,
  };

  const dotStyle = {
    width: size === 'sm' ? 5 : 6,
    height: size === 'sm' ? 5 : 6,
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0,
  };

  return (
    <span className="ui-status-chip" style={style}>
      <span style={dotStyle} aria-hidden="true" />
      {text}
    </span>
  );
}

export default StatusChip;
