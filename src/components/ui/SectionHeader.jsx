import React from 'react';
import { useNavigate } from 'react-router-dom';

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionHeader({ title, subtitle, actions, back = false }) {
  const navigate = useNavigate();

  return (
    <div
      className="ui-section-header"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
        {back && (
          <button
            className="ui-section-header__back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px 6px',
              marginTop: 2,
              flexShrink: 0,
            }}
          >
            <BackArrow />
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h2
            className="ui-section-header__title"
            style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827', lineHeight: 1.3 }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className="ui-section-header__subtitle"
              style={{ margin: '3px 0 0', fontSize: '0.85rem', color: '#6b7280' }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div
          className="ui-section-header__actions"
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

export default SectionHeader;
