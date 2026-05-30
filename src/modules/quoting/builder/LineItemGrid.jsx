import Button from '../../../components/ui/Button.jsx';

export default function LineItemGrid({ items, setItems }) {
  function addRow() {
    setItems((rows) => [...rows, { description: '', category: 'other', quantity: 1, unit_cost: 0, unit_price: 0 }]);
  }

  function updateRow(index, key, value) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  function removeRow(index) {
    setItems((rows) => rows.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <h4 style={{ margin: 0 }}>Line Items</h4>
        <Button size="sm" variant="secondary" onClick={addRow}>Add Row</Button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Description</th><th>Qty</th><th>Cost</th><th>Price</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <tr key={index}>
              <td><input value={row.description || ''} onChange={(e) => updateRow(index, 'description', e.target.value)} /></td>
              <td><input type="number" value={row.quantity ?? 0} onChange={(e) => updateRow(index, 'quantity', Number(e.target.value || 0))} /></td>
              <td><input type="number" value={row.unit_cost ?? 0} onChange={(e) => updateRow(index, 'unit_cost', Number(e.target.value || 0))} /></td>
              <td><input type="number" value={row.unit_price ?? 0} onChange={(e) => updateRow(index, 'unit_price', Number(e.target.value || 0))} /></td>
              <td><Button size="sm" variant="ghost" onClick={() => removeRow(index)}>Remove</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
