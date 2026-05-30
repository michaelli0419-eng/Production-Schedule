export default function MarginCalculator({ items = [] }) {
  const subtotal = items.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.unit_price || 0), 0);
  const cost = items.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.unit_cost || 0), 0);
  const marginPct = subtotal > 0 ? ((subtotal - cost) / subtotal) * 100 : 0;

  return {
    subtotal,
    cost,
    marginPct,
  };
}
