import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function parseFallback(rawText: string) {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const text = rawText.toLowerCase();

  const moneyMatch = rawText.match(/\$\s?([\d,]+(?:\.\d+)?)/);
  const qtyMatch = rawText.match(/\b(\d+)\s+(modules?|units?)\b/i);
  const dateMatch = rawText.match(/\b(20\d{2}-\d{2}-\d{2})\b/);

  const parsed = {
    name: lines[0]?.slice(0, 120) || 'AI Intake Opportunity',
    title: lines[0]?.slice(0, 120) || 'AI Intake Lead',
    company_name: lines.find((l) => /llc|inc|corp|district|unified|charter/i.test(l)) || '',
    contract_value: moneyMatch ? Number(moneyMatch[1].replace(/,/g, '')) : 0,
    module_count: qtyMatch ? Number(qtyMatch[1]) : null,
    expected_start_date: dateMatch ? dateMatch[1] : null,
    expected_occupancy_date: null,
    probability: /award|approved|go ahead|proceed/i.test(text) ? 80 : /proposal|quote/i.test(text) ? 55 : 35,
    stage: /award|handoff/i.test(text) ? 'award' : /proposal|quote/i.test(text) ? 'proposal' : 'lead',
    notes: rawText.slice(0, 2000),
    rawFlags: [],
  };

  let confidence = 0.45;
  if (parsed.contract_value > 0) confidence += 0.15;
  if (parsed.module_count) confidence += 0.1;
  if (parsed.expected_start_date) confidence += 0.1;
  if (parsed.company_name) confidence += 0.1;
  if (parsed.name && parsed.name.length > 8) confidence += 0.05;

  confidence = Math.max(0.2, Math.min(0.95, confidence));

  return { parsed, confidence };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    const body = await req.json();
    const sourceType = String(body.source_type || 'manual');
    const rawText = String(body.raw_text || '').trim();

    if (!rawText) {
      return new Response(JSON.stringify({ error: 'raw_text is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { parsed, confidence } = parseFallback(rawText);

    const { data, error } = await supabase
      .from('intake_drafts')
      .insert({
        source_type: sourceType,
        raw_text: rawText,
        parsed_json: parsed,
        confidence,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, draft: data, warning_only: confidence < 0.7 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
