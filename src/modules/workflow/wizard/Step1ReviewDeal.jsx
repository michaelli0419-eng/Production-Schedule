export default function Step1ReviewDeal({ opportunity }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <h3 style={{ margin: 0 }}>Review Opportunity</h3>
      <div><strong>Name:</strong> {opportunity?.name || '-'}</div>
      <div><strong>Stage:</strong> {opportunity?.stage || '-'}</div>
      <div><strong>Contract Value:</strong> ${Number(opportunity?.contract_value || 0).toLocaleString()}</div>
      <div><strong>Expected Start:</strong> {opportunity?.expected_start_date || '-'}</div>
      <div><strong>Expected Occupancy:</strong> {opportunity?.expected_occupancy_date || '-'}</div>
    </div>
  );
}
