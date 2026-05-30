import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ACCOUNT_ID = Deno.env.get('NETSUITE_ACCOUNT_ID') || '';
const TOKEN_KEY = Deno.env.get('NETSUITE_TOKEN_KEY') || '';
const TOKEN_SECRET = Deno.env.get('NETSUITE_TOKEN_SECRET') || '';
const CONSUMER_KEY = Deno.env.get('NETSUITE_CONSUMER_KEY') || '';
const CONSUMER_SECRET = Deno.env.get('NETSUITE_CONSUMER_SECRET') || '';

const NS_HOST = `${ACCOUNT_ID.toLowerCase().replace(/_/g, '-')}.suitetalk.api.netsuite.com`;

function hasCreds() {
  return !!(ACCOUNT_ID && TOKEN_KEY && TOKEN_SECRET && CONSUMER_KEY && CONSUMER_SECRET);
}

function enc(input: string): string {
  return encodeURIComponent(input)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function nonce(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}

async function hmacSha256Base64(key: string, value: string): Promise<string> {
  const keyData = new TextEncoder().encode(key);
  const valueData = new TextEncoder().encode(value);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, valueData);
  const bytes = new Uint8Array(sig);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function authHeader(params: Record<string, string>): string {
  return 'OAuth ' + Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${enc(k)}="${enc(v)}"`)
    .join(', ');
}

async function netsuiteRequest(method: string, path: string, body?: unknown, query?: Record<string, string | number>): Promise<any> {
  if (!hasCreds()) throw new Error('Missing NetSuite credentials');

  const url = new URL(`https://${NS_HOST}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  }

  const oauth: Record<string, string> = {
    realm: ACCOUNT_ID,
    oauth_consumer_key: CONSUMER_KEY,
    oauth_token: TOKEN_KEY,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: nonce(),
    oauth_version: '1.0',
  };

  const queryParams: Array<[string, string]> = [];
  url.searchParams.forEach((v, k) => queryParams.push([k, v]));
  const signParams: Array<[string, string]> = [
    ...queryParams,
    ...Object.entries(oauth).filter(([k]) => k !== 'realm'),
  ].sort(([a], [b]) => a.localeCompare(b));

  const normalizedParams = signParams.map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&');
  const baseString = [method.toUpperCase(), enc(`${url.origin}${url.pathname}`), enc(normalizedParams)].join('&');
  const signingKey = `${enc(CONSUMER_SECRET)}&${enc(TOKEN_SECRET)}`;
  oauth.oauth_signature = await hmacSha256Base64(signingKey, baseString);

  const headers: Record<string, string> = {
    Authorization: authHeader(oauth),
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }

  if (!res.ok) {
    throw new Error(`NetSuite ${method} ${path} failed (${res.status}): ${JSON.stringify(parsed)}`);
  }

  return parsed;
}

async function logSync(payload: any) {
  await supabase.from('netsuite_sync_log').insert(payload);
}

async function upsertExternalMap(entityType: string, internalId: string, externalId: string) {
  await supabase
    .from('external_id_map')
    .upsert({
      system: 'netsuite',
      entity_type: entityType,
      internal_id: internalId,
      external_id: externalId,
      sync_status: 'synced',
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'system,entity_type,internal_id' });
}

async function lookupCustomerInternalIdFromOpportunity(opportunityId: string): Promise<string> {
  const { data: opp, error: oppErr } = await supabase
    .from('opportunities')
    .select('id, name, company_id')
    .eq('id', opportunityId)
    .single();
  if (oppErr) throw oppErr;

  if (!opp.company_id) throw new Error('Opportunity has no company_id; cannot determine NetSuite customer');

  const { data: company, error: coErr } = await supabase
    .from('companies')
    .select('id, name, netsuite_entity_id')
    .eq('id', opp.company_id)
    .single();
  if (coErr) throw coErr;

  if (!company.netsuite_entity_id) {
    throw new Error(`Company ${company.name} is missing netsuite_entity_id`);
  }

  return String(company.netsuite_entity_id);
}

async function resolveLineItemsForQuote(quoteId: string) {
  const { data: qli, error } = await supabase
    .from('quote_line_items')
    .select('id, description, quantity, unit_price, part_number')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });
  if (error) throw error;

  const lines = qli || [];
  if (lines.length === 0) throw new Error('Quote has no line items');

  const partNumbers = Array.from(new Set(lines.map((l) => l.part_number).filter(Boolean)));
  const netsuiteItemByPart = new Map<string, string>();

  if (partNumbers.length) {
    const { data: mats, error: matErr } = await supabase
      .from('materials')
      .select('part_number, netsuite_item_id')
      .in('part_number', partNumbers);
    if (matErr) throw matErr;

    for (const m of mats || []) {
      if (m.part_number && m.netsuite_item_id) netsuiteItemByPart.set(m.part_number, String(m.netsuite_item_id));
    }
  }

  const mapped = lines.map((l, idx) => {
    const itemId = l.part_number ? netsuiteItemByPart.get(l.part_number) : undefined;
    if (!itemId) {
      throw new Error(`Missing netsuite_item_id mapping for quote line ${idx + 1} (${l.part_number || l.description})`);
    }

    return {
      item: { id: itemId },
      quantity: Number(l.quantity || 0),
      rate: Number(l.unit_price || 0),
      description: l.description || undefined,
    };
  });

  return mapped;
}

async function handlePushQuote(quoteId: string) {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select('id, quote_number, title, opportunity_id, notes')
    .eq('id', quoteId)
    .single();
  if (error) throw error;

  const customerId = await lookupCustomerInternalIdFromOpportunity(quote.opportunity_id);
  const items = await resolveLineItemsForQuote(quoteId);

  const payload = {
    entity: { id: customerId },
    tranId: quote.quote_number || undefined,
    memo: quote.title || quote.notes || 'Generated from SCM quote',
    item: { items },
  };

  const created = await netsuiteRequest('POST', '/services/rest/record/v1/salesOrder', payload);
  const externalId = String(created?.id || created?.tranId || created?.tranid || '');
  if (!externalId) throw new Error('NetSuite sales order response missing id');

  await upsertExternalMap('quote', quoteId, externalId);
  await supabase.from('quotes').update({ netsuite_so_id: externalId }).eq('id', quoteId);

  await logSync({
    direction: 'outbound',
    entity_type: 'quote',
    internal_id: quoteId,
    operation: 'push_quote',
    status: 'success',
    external_id: externalId,
    payload,
    response: created,
  });

  return { external_id: externalId, raw: created };
}

async function handlePushPO(poId: string) {
  const { data: po, error: poErr } = await supabase
    .from('procurement_orders')
    .select('*')
    .eq('id', poId)
    .single();
  if (poErr) throw poErr;

  const vendorIdFromPayload = po?.netsuite_vendor_id ? String(po.netsuite_vendor_id) : '';
  let vendorId = vendorIdFromPayload;
  if (!vendorId) {
    const { data: companyByName } = await supabase
      .from('companies')
      .select('id, name, netsuite_entity_id')
      .eq('name', po.supplier_name)
      .maybeSingle();
    if (companyByName?.netsuite_entity_id) vendorId = String(companyByName.netsuite_entity_id);
  }
  if (!vendorId) {
    const { data: extMap } = await supabase
      .from('external_id_map')
      .select('external_id')
      .eq('system', 'netsuite')
      .eq('entity_type', 'vendor')
      .eq('internal_id', po.supplier_name)
      .maybeSingle();
    if (extMap?.external_id) vendorId = String(extMap.external_id);
  }
  if (!vendorId) throw new Error(`Unable to resolve NetSuite vendor for supplier_name='${po.supplier_name}'`);

  const { data: lines, error: lineErr } = await supabase
    .from('procurement_order_lines')
    .select('*')
    .eq('po_id', poId)
    .order('line_no', { ascending: true });
  if (lineErr) throw lineErr;

  const materialIds = Array.from(new Set((lines || []).map((l: any) => l.material_id).filter(Boolean)));
  const partNumbers = Array.from(new Set((lines || []).map((l: any) => l.part_number).filter(Boolean)));
  const materialItemMap = new Map<string, string>();
  const partItemMap = new Map<string, string>();
  if (materialIds.length || partNumbers.length) {
    let q = supabase.from('materials').select('id, part_number, netsuite_item_id');
    if (materialIds.length) q = q.in('id', materialIds);
    else q = q.in('part_number', partNumbers);
    const { data: mats, error: matErr } = await q;
    if (matErr) throw matErr;
    for (const m of mats || []) {
      if (m.id && m.netsuite_item_id) materialItemMap.set(String(m.id), String(m.netsuite_item_id));
      if (m.part_number && m.netsuite_item_id) partItemMap.set(String(m.part_number), String(m.netsuite_item_id));
    }
  }

  const mappedLines = (lines || []).map((l, idx) => {
    const resolvedItemId = (l.material_id && materialItemMap.get(String(l.material_id))) || (l.part_number && partItemMap.get(String(l.part_number)));
    if (!resolvedItemId) throw new Error(`Cannot resolve netsuite_item_id for PO line ${idx + 1} (${l.part_number || l.description})`);
    return {
      item: { id: String(resolvedItemId) },
      quantity: Number(l.quantity_ordered || 0),
      rate: Number(l.unit_cost || 0),
      description: l.description || undefined,
    };
  });

  const payload = {
    entity: { id: vendorId },
    tranId: po.po_number || undefined,
    memo: po.notes || 'Generated from SCM procurement order',
    item: { items: mappedLines },
  };

  const created = await netsuiteRequest('POST', '/services/rest/record/v1/purchaseOrder', payload);
  const externalId = String(created?.id || created?.tranId || created?.tranid || '');
  if (!externalId) throw new Error('NetSuite purchase order response missing id');

  await upsertExternalMap('po', poId, externalId);
  await supabase.from('procurement_orders').update({ netsuite_po_id: externalId }).eq('id', poId);

  await logSync({
    direction: 'outbound',
    entity_type: 'po',
    internal_id: poId,
    operation: 'push_po',
    status: 'success',
    external_id: externalId,
    payload,
    response: created,
  });

  return { external_id: externalId, raw: created };
}

async function runSuiteQL(q: string) {
  const res = await netsuiteRequest('POST', '/services/rest/query/v1/suiteql', { q });
  return res?.items || res?.results || [];
}

async function handlePullItems() {
  const items = await runSuiteQL(`
    SELECT id, itemid, displayname, salesdescription, baseprice
    FROM item
    WHERE isinactive = 'F'
  `);

  const upserts = (items || []).map((it: any) => ({
    part_number: String(it.itemid || it.id),
    name: String(it.displayname || it.itemid || `Item ${it.id}`),
    description: it.salesdescription ? String(it.salesdescription) : null,
    unit_cost: it.baseprice != null ? Number(it.baseprice) : null,
    netsuite_item_id: String(it.id),
    is_active: true,
  }));

  if (upserts.length) {
    const { error } = await supabase
      .from('materials')
      .upsert(upserts, { onConflict: 'part_number' });
    if (error) throw error;
  }

  await logSync({
    direction: 'inbound',
    entity_type: 'item',
    operation: 'pull_items',
    status: 'success',
    payload: { count: upserts.length },
  });

  return { count: upserts.length };
}

async function handlePullCustomers() {
  const customers = await runSuiteQL(`
    SELECT id, entityid, companyname, phone, url, isinactive
    FROM customer
  `);

  const upserts = (customers || []).map((c: any) => ({
    name: String(c.companyname || c.entityid || `Customer ${c.id}`),
    short_name: c.entityid ? String(c.entityid) : null,
    phone: c.phone ? String(c.phone) : null,
    website: c.url ? String(c.url) : null,
    netsuite_entity_id: String(c.id),
    is_active: String(c.isinactive || '').toUpperCase() !== 'T',
    type: 'other',
  }));

  if (upserts.length) {
    const { error } = await supabase
      .from('companies')
      .upsert(upserts, { onConflict: 'name' });
    if (error) throw error;
  }

  await logSync({
    direction: 'inbound',
    entity_type: 'customer',
    operation: 'pull_customers',
    status: 'success',
    payload: { count: upserts.length },
  });

  return { count: upserts.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
    });
  }

  try {
    const body = await req.json();
    const action = String(body.action || '');

    if (!hasCreds()) {
      throw new Error('NetSuite credentials are not configured');
    }

    let result: any;
    if (action === 'push_quote') result = await handlePushQuote(body.payload?.quote_id || body.quote_id);
    else if (action === 'push_po') result = await handlePushPO(body.payload?.po_id || body.po_id);
    else if (action === 'pull_items') result = await handlePullItems();
    else if (action === 'pull_customers') result = await handlePullCustomers();
    else throw new Error(`Unsupported action: ${action}`);

    return new Response(JSON.stringify({ ok: true, action, result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    const message = err?.message || String(err);
    try {
      await logSync({
        direction: 'system',
        entity_type: 'system',
        operation: 'netsuite_sync',
        status: 'failed',
        error_message: message,
      });
    } catch {
      // no-op
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
