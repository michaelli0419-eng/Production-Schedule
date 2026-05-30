import React from 'react';

const COLOR_MAP = {
  blue: { bg: '#eff6ff', icon: '#3b82f6', border: '#bfdbfe' },
  green: { bg: '#f0fdf4', icon: '#10b981', border: '#a7f3d0' },
  amber: { bg: '#fffbeb', icon: '#f59e0b', border: '#fde68a' },
  red: { bg: '#fef2f2', icon: '#ef4444', border: '#fecaca' },
  purple: { bg: '#f5f3ff', icon: '#8b5cf6', border: '#ddd6fe' },
};

function TrendArrowUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 2L10 8H2L6 2Z" fill="currentColor" />
    </svg>
  );
}

function TrendArrowDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 10L2 4H10L6 10Z" fill="currentColor" />
    </svg>
  );
}

function MetricCard({ label, value, subvalue, trend, trendValue, icon, color = 'blue' }) {
  const palette = COLOR_MAP[color] || COLOR_MAP.blue;
  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280';

  return (
    <div
      className="ui-metric-card"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span
          className="ui-metric-card__label"
          style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}
        >
          {label}
        </span>
        {icon && (
          <span
            className="ui-metric-card__icon"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: palette.bg,
              border: `1px solid ${palette.border}`,
              color: palette.icon,
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="ui-metric-card__value" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>
        {value}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {trend && trendValue && (
          <span
            className="ui-metric-card__trend"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', fontWeight: 600, color: trendColor }}
          >
            {trend === 'up' ? <TrendArrowUp /> : <TrendArrowDown />}
            {trendValue}
          </span>
        )}
        {subvalue && (
          <span className="ui-metric-card__subvalue" style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
            {subvalue}
          </span>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
