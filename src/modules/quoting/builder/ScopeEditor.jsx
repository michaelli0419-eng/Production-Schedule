export default function ScopeEditor({ form, setForm }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <textarea rows={3} placeholder="Scope inclusions" value={form.scope_inclusions || ''} onChange={(e) => setForm((s) => ({ ...s, scope_inclusions: e.target.value }))} />
      <textarea rows={3} placeholder="Scope exclusions" value={form.scope_exclusions || ''} onChange={(e) => setForm((s) => ({ ...s, scope_exclusions: e.target.value }))} />
      <textarea rows={3} placeholder="Assumptions" value={form.assumptions || ''} onChange={(e) => setForm((s) => ({ ...s, assumptions: e.target.value }))} />
    </div>
  );
}
