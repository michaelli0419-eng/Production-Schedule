import { useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import SearchInput from '../../../components/ui/SearchInput.jsx';
import { useNetSuiteSync } from '../hooks/useNetSuiteSync.js';

export default function NetSuitePanel() {
  const { approvedQuotes, confirmedPOs, syncLog, isLoading, error, runSync } = useNetSuiteSync();
  const [search, setSearch] = useState('');

  const quotes = approvedQuotes.filter((q) => !search || `${q.quote_number} ${q.title}`.toLowerCase().includes(search.toLowerCase()));
  const pos = confirmedPOs.filter((p) => !search || `${p.po_number} ${p.supplier_name || ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>NetSuite</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => runSync.mutate({ action: 'pull_items' })} loading={runSync.isPending}>Pull Items</Button>
          <Button variant="secondary" onClick={() => runSync.mutate({ action: 'pull_customers' })} loading={runSync.isPending}>Pull Customers</Button>
        </div>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search approved quotes / POs" />

      {error && <div style={{ color: '#b91c1c' }}>NetSuite sync error: {error.message}</div>}
      {isLoading && <div>Loading NetSuite data...</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Approved Quotes</div>
          {quotes.length === 0 && <div style={{ color: '#6b7280' }}>No approved quotes.</div>}
          {quotes.map((q) => (
            <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{q.quote_number || 'Quote'}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{q.title}</div>
              </div>
              <Button size="sm" onClick={() => runSync.mutate({ action: 'push_quote', payload: { quote_id: q.id } })} loading={runSync.isPending}>Push</Button>
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Confirmed Procurement Orders</div>
          {pos.length === 0 && <div style={{ color: '#6b7280' }}>No confirmed POs.</div>}
          {pos.map((p) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{p.po_number || 'PO'}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{p.supplier_name || 'Supplier'} · ${Number(p.total_amount || 0).toLocaleString()}</div>
              </div>
              <Button size="sm" onClick={() => runSync.mutate({ action: 'push_po', payload: { po_id: p.id } })} loading={runSync.isPending}>Push</Button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Recent NetSuite Sync Log</div>
        {syncLog.slice(0, 10).map((row) => (
          <div key={row.id} style={{ fontSize: 12, borderBottom: '1px solid #f3f4f6', padding: '4px 0' }}>
            [{row.status || 'unknown'}] {row.entity_type || '-'} {row.operation || '-'} {row.external_id ? `-> ${row.external_id}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
