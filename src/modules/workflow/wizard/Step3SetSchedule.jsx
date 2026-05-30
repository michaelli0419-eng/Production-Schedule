export default function Step3SetSchedule({ state, patch }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <h3 style={{ margin: 0 }}>Set Production Dates</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <input type="date" value={state.start_date} onChange={(e) => patch({ start_date: e.target.value })} />
        <input type="date" value={state.end_date} onChange={(e) => patch({ end_date: e.target.value })} />
        <input type="date" value={state.due_date} onChange={(e) => patch({ due_date: e.target.value })} />
      </div>
      <textarea rows={4} placeholder="Handoff notes" value={state.notes} onChange={(e) => patch({ notes: e.target.value })} />
    </div>
  );
}
