import Button from '../../components/ui/Button.jsx';
import { useWebhookEvents } from './hooks/useSyncLog.js';

export default function WebhookEventList() {
  const { events, isLoading, error, retry } = useWebhookEvents();

  if (isLoading) return <div>Loading webhook events...</div>;
  if (error) return <div style={{ color: '#b91c1c' }}>Webhook event load failed: {error.message}</div>;

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Webhook Events</div>
      {events.length === 0 && <div style={{ color: '#6b7280' }}>No webhook events.</div>}
      {events.map((evt) => (
        <div key={evt.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, borderBottom: '1px solid #f3f4f6', padding: '6px 0' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{evt.event_type || 'event'} · {evt.processing_status || 'unknown'}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{evt.received_at || ''} {evt.error_message ? `· ${evt.error_message}` : ''}</div>
          </div>
          {evt.processing_status === 'failed' && (
            <Button size="sm" variant="secondary" onClick={() => retry.mutate(evt.id)} loading={retry.isPending}>Retry</Button>
          )}
        </div>
      ))}
    </div>
  );
}
