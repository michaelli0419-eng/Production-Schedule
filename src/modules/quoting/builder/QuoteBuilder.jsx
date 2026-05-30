import { useEffect, useMemo, useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import QuoteHeader from './QuoteHeader.jsx';
import LineItemGrid from './LineItemGrid.jsx';
import ScopeEditor from './ScopeEditor.jsx';
import calc from './MarginCalculator.jsx';
import { useQuoteLineItems } from '../hooks/useQuoteLineItems.js';
import { useSaveQuote } from '../hooks/useSaveQuote.js';
import { useDebounce } from '../../../hooks/useDebounce.js';

export default function QuoteBuilder({ quote, onSaved }) {
  const [form, setForm] = useState(quote || {});
  const [items, setItems] = useState(quote?.quote_line_items ?? []);
  const debouncedForm = useDebounce(form, 2000);
  const { saveQuote, saveRevision } = useSaveQuote();
  const lineSaver = useQuoteLineItems(quote?.id);

  useEffect(() => {
    setForm(quote || {});
    setItems(quote?.quote_line_items ?? []);
  }, [quote]);

  const totals = useMemo(() => {
    const t = calc({ items });
    return {
      subtotal: Number(t.subtotal.toFixed(2)),
      cost_total: Number(t.cost.toFixed(2)),
      margin_pct: Number(t.marginPct.toFixed(2)),
      total: Number(t.subtotal.toFixed(2)),
    };
  }, [items]);

  useEffect(() => {
    if (!quote?.id) return;
    saveQuote.mutate({ id: quote.id, payload: { ...debouncedForm, ...totals } });
  }, [debouncedForm]);

  async function handleSaveAll() {
    let id = quote?.id;
    const payload = { ...form, ...totals };
    if (!id) {
      const created = await saveQuote.mutateAsync({ payload });
      id = created.id;
    } else {
      await saveQuote.mutateAsync({ id, payload });
    }

    await lineSaver.mutateAsync({ items, totals });
    onSaved?.(id);
  }

  async function handleSnapshot() {
    if (!quote?.id) return;
    await saveRevision.mutateAsync({ quoteId: quote.id, changeSummary: 'Manual snapshot', snapshot: { form, items, totals } });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <QuoteHeader form={form} setForm={setForm} />
      <ScopeEditor form={form} setForm={setForm} />
      <LineItemGrid items={items} setItems={setItems} />

      <div style={{ display: 'flex', gap: 18, fontSize: 14 }}>
        <strong>Subtotal: ${totals.subtotal.toLocaleString()}</strong>
        <strong>Cost: ${totals.cost_total.toLocaleString()}</strong>
        <strong>Margin: {totals.margin_pct}%</strong>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="secondary" onClick={handleSnapshot} disabled={!quote?.id || saveRevision.isPending}>Snapshot Revision</Button>
        <Button onClick={handleSaveAll} loading={saveQuote.isPending || lineSaver.isPending}>Save Quote</Button>
      </div>
    </div>
  );
}
