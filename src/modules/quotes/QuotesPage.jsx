export default function QuotesPage() {
  return (
    <section className="ps-panel" style={{ padding: 16 }}>
      <h2>Quotes</h2>
      <p>Quote approval controls release-gate eligibility for downstream scheduling.</p>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
        <strong>Q-101</strong> Approved
      </div>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginTop: 8 }}>
        <strong>Q-102</strong> Pending Approval
      </div>
    </section>
  );
}
