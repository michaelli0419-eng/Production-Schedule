export default function ConflictCard({ conflict }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
      <div style={{ fontWeight: 700 }}>{conflict.conflict_type}</div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>Severity: {conflict.severity}</div>
      <div style={{ fontSize: 13 }}>{conflict.detail}</div>
    </div>
  );
}
