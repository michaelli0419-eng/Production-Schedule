import { supabase } from "./supabase.js";

export function dbRowToClient(row) {
  return {
    id:           row.id,
    name:         row.name,
    district:     row.district      ?? "",
    region:       row.region        ?? "",
    contactName:  row.contact_name  ?? "",
    contactEmail: row.contact_email ?? "",
    contactPhone: row.contact_phone ?? "",
    notes:        row.notes         ?? "",
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  };
}

export function clientToDbRow(client) {
  return {
    id:            client.id,
    name:          client.name,
    district:      client.district      || null,
    region:        client.region        || null,
    contact_name:  client.contactName   || null,
    contact_email: client.contactEmail  || null,
    contact_phone: client.contactPhone  || null,
    notes:         client.notes         || null,
  };
}

export async function fetchAllClients() {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(`fetchAllClients: ${error.message}`);
  return (data ?? []).map(dbRowToClient);
}

export async function upsertClient(client) {
  const { data, error } = await supabase
    .from("clients")
    .upsert(clientToDbRow(client), { onConflict: "id" })
    .select()
    .single();
  if (error) throw new Error(`upsertClient: ${error.message}`);
  return dbRowToClient(data);
}

export async function deleteClient(id) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw new Error(`deleteClient(${id}): ${error.message}`);
}
