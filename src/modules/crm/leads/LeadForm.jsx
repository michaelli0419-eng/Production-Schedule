import { useState } from "react";
import Button from "../../../components/ui/Button.jsx";
import FormField from "../../../components/ui/FormField.jsx";
import Select from "../../../components/ui/Select.jsx";
import CurrencyInput from "../../../components/ui/CurrencyInput.jsx";
import DatePicker from "../../../components/ui/DatePicker.jsx";
import { useCreateLead, useUpdateLead } from "../hooks/useLeads.js";
import { SOURCE_TYPES } from "../../../utils/constants.js";

const SOURCE_OPTIONS = [{ value: "", label: "Select source..." }, ...SOURCE_TYPES.map((s) => ({ value: s, label: s }))];

export default function LeadForm({ lead, onSuccess, onClose }) {
  const isEdit = Boolean(lead?.id);
  const [form, setForm] = useState({
    title: lead?.title ?? "",
    source: lead?.source ?? "",
    estimated_value: lead?.estimated_value ?? "",
    delivery_date: lead?.delivery_date ?? "",
  });

  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const mutation = isEdit ? updateLead : createLead;

  const onField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      title: form.title,
      source: form.source || null,
      estimated_value: form.estimated_value === "" ? null : Number(form.estimated_value),
      delivery_date: form.delivery_date || null,
    };

    if (isEdit) await mutation.mutateAsync({ id: lead.id, data: payload });
    else await mutation.mutateAsync(payload);
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FormField label="Title" required>
        <input value={form.title} onChange={(e) => onField("title", e.target.value)} required />
      </FormField>
      <FormField label="Source">
        <Select value={form.source} onChange={(value) => onField("source", value)} options={SOURCE_OPTIONS} />
      </FormField>
      <FormField label="Estimated Value">
        <CurrencyInput value={form.estimated_value} onChange={(value) => onField("estimated_value", value)} />
      </FormField>
      <FormField label="Delivery Date">
        <DatePicker value={form.delivery_date} onChange={(value) => onField("delivery_date", value)} />
      </FormField>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Lead"}</Button>
      </div>
    </form>
  );
}
