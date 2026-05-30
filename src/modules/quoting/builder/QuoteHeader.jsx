export default function QuoteHeader({ form, setForm }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
      <input placeholder="Quote title" value={form.title || ''} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
      <input type="date" value={form.valid_from || ''} onChange={(e) => setForm((s) => ({ ...s, valid_from: e.target.value }))} />
      <input type="date" value={form.valid_until || ''} onChange={(e) => setForm((s) => ({ ...s, valid_until: e.target.value }))} />
    </div>
  );
}
