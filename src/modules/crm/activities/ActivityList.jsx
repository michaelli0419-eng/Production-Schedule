import { useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import ActivityForm from './ActivityForm.jsx';
import { useCrmActivities } from '../hooks/useCrmActivities.js';

const TYPE_ICONS = {
  call:      '📞',
  email:     '✉️',
  meeting:   '🗓',
  site_visit:'📍',
  demo:      '🖥',
  note:      '📝',
  task:      '✅',
};

function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

export default function ActivityList({ entityType, entityId, compact = false }) {
  const [showForm, setShowForm] = useState(false);
  const { activities, isLoading, error } = useCrmActivities(
    entityType && entityId ? { entityType, entityId } : {}
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: compact ? 15 : 18, fontWeight: 600, color: '#111827' }}>
          {entityType ? 'Activity History' : 'All Activities'}
        </h3>
        <Button size="sm" onClick={() => setShowForm(true)}>+ Log Activity</Button>
      </div>

      {isLoading && (
        <div style={{ color: '#6b7280', fontSize: 14 }}>Loading activities…</div>
      )}
      {error && (
        <div style={{ color: '#b91c1c', fontSize: 14 }}>Failed to load activities.</div>
      )}
      {!isLoading && !error && activities.length === 0 && (
        <div style={{
          padding: '32px 16px', textAlign: 'center', color: '#6b7280',
          border: '1px dashed #e5e7eb', borderRadius: 8, fontSize: 14,
        }}>
          No activities yet. Log a call, email, or meeting to get started.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {activities.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex', gap: 12, padding: '12px 14px',
              background: '#fff', border: '1px solid #f3f4f6',
              borderRadius: 8, borderLeft: `3px solid #e5e7eb`,
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.4 }}>
              {TYPE_ICONS[item.type] || '💬'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                  {item.subject || '(No subject)'}
                </span>
                <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>
                  {fmtDate(item.completed_at || item.created_at)}
                </span>
              </div>
              {item.body && (
                <div style={{ marginTop: 4, fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
                  {item.body}
                </div>
              )}
              {item.outcome && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
                  Outcome: {item.outcome}
                </div>
              )}
              <div style={{ marginTop: 4, display: 'flex', gap: 8, fontSize: 12, color: '#9ca3af' }}>
                <span style={{ textTransform: 'capitalize' }}>{item.type || 'note'}</span>
                {item.direction && <span>· {item.direction}</span>}
                {item.duration_min && <span>· {item.duration_min} min</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Log Activity" size="md">
        <ActivityForm
          entityType={entityType}
          entityId={entityId}
          onSuccess={() => setShowForm(false)}
          onClose={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}
