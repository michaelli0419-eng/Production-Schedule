import { useJobMaterials } from '../hooks/useJobMaterials.js';

export default function JobMaterialsPanel({ jobId }) {
  const { materials, isLoading } = useJobMaterials(jobId);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <h4 style={{ margin: 0 }}>Materials</h4>
      {isLoading && <div>Loading materials...</div>}
      {!isLoading && materials.length === 0 && <div style={{ color: '#6b7280' }}>No materials linked yet.</div>}
      {materials.map((m) => (
        <div key={m.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{m.material_name || m.material_code || 'Material'}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{m.notes || '-'}</div>
          </div>
          <div>Qty: {m.required_qty ?? '-'}</div>
          <div>{m.procurement_status || 'pending'}</div>
        </div>
      ))}
    </div>
  );
}
