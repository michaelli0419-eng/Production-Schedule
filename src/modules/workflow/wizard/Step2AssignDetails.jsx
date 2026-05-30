export default function Step2AssignDetails({ state, patch }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <h3 style={{ margin: 0 }}>Assign Job Details</h3>
      <input placeholder="Job name" value={state.name} onChange={(e) => patch({ name: e.target.value })} />
      <input placeholder="Client" value={state.client} onChange={(e) => patch({ client: e.target.value })} />
      <select value={state.line_id} onChange={(e) => patch({ line_id: e.target.value })}>
        <option value="L1">Production Line 1</option>
        <option value="L2">Production Line 2</option>
        <option value="L3">Production Line 3</option>
        <option value="L4">Production Line 4</option>
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <input type="number" min="1" value={state.modules} onChange={(e) => patch({ modules: Number(e.target.value || 1) })} placeholder="Modules" />
        <input type="number" min="1" value={state.crew} onChange={(e) => patch({ crew: Number(e.target.value || 1) })} placeholder="Crew" />
        <select value={state.priority} onChange={(e) => patch({ priority: e.target.value })}>
          <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
        </select>
      </div>
    </div>
  );
}
