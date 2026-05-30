export default function Step5Confirm({ opportunity, state }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <h3 style={{ margin: 0 }}>Confirm Conversion</h3>
      <div>Opportunity: <strong>{opportunity?.name}</strong></div>
      <div>Job Name: <strong>{state.name}</strong></div>
      <div>Line: <strong>{state.line_id}</strong></div>
      <div>Window: <strong>{state.start_date}</strong> to <strong>{state.end_date}</strong></div>
      <div>Due: <strong>{state.due_date}</strong></div>
      <div>Priority: <strong>{state.priority}</strong></div>
      <div>Modules/Crew: <strong>{state.modules}</strong> / <strong>{state.crew}</strong></div>
    </div>
  );
}
