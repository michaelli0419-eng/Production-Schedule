import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import SlideOver from "../../../components/ui/SlideOver.jsx";
import SectionHeader from "../../../components/ui/SectionHeader.jsx";
import FormField from "../../../components/ui/FormField.jsx";
import { useLead, useConvertLead } from "../hooks/useLeads.js";
import { useCrmActivities } from "../hooks/useCrmActivities.js";
import LeadForm from "./LeadForm.jsx";

const STATUS_COLORS = {
  new: "blue",
  contacted: "amber",
  qualified: "green",
  unqualified: "gray",
  converted: "purple",
  dead: "red",
};

const STAGE_OPTIONS = [
  { value: "prospecting", label: "Prospecting" },
  { value: "qualification", label: "Qualification" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
];

function ConvertModal({ lead, onClose, onConverted }) {
  const [oppName, setOppName] = useState(lead?.title || "");
  const [stage, setStage] = useState("prospecting");
  const [error, setError] = useState("");
  const convertLead = useConvertLead();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!oppName.trim()) {
      setError("Opportunity name is required.");
      return;
    }
    try {
      await convertLead.mutateAsync({ id: lead.id, data: { name: oppName, stage } });
      onConverted();
    } catch (err) {
      setError(err?.message || "Conversion failed.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">Convert to Opportunity</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Opportunity Name" required>
            <input
              type="text"
              className="input w-full"
              value={oppName}
              onChange={(e) => setOppName(e.target.value)}
              placeholder="Opportunity name"
            />
          </FormField>
          <FormField label="Stage" required>
            <select
              className="input w-full"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              {STAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FormField>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={convertLead.isLoading}>
              {convertLead.isLoading ? "Converting…" : "Convert"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailsTab({ lead }) {
  const fields = [
    { label: "Company", value: lead.company },
    {
      label: "Contact",
      value:
        [lead.contact_first_name, lead.contact_last_name].filter(Boolean).join(" ") || null,
    },
    { label: "Source", value: lead.source },
    { label: "Source Detail", value: lead.source_detail },
    { label: "Description", value: lead.description },
    {
      label: "Estimated Value",
      value:
        lead.estimated_value != null
          ? `$${Number(lead.estimated_value).toLocaleString()}`
          : null,
    },
    { label: "Estimated Modules", value: lead.estimated_modules },
    { label: "Building Type", value: lead.building_type },
    {
      label: "Location",
      value: [lead.location_city, lead.location_state].filter(Boolean).join(", ") || null,
    },
    {
      label: "Delivery Date",
      value: lead.delivery_date
        ? new Date(lead.delivery_date).toLocaleDateString()
        : null,
    },
    { label: "Assigned To", value: lead.assigned_to },
  ];

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 py-4">
      {fields.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
          <dd className="mt-1 text-sm text-gray-900">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActivitiesTab({ leadId }) {
  const { data: activities = [], isLoading } = useCrmActivities({ leadId });

  if (isLoading) return <p className="py-4 text-sm text-gray-500">Loading activities…</p>;
  if (!activities.length)
    return <p className="py-4 text-sm text-gray-500">No activities yet.</p>;

  return (
    <ul className="divide-y divide-gray-100 py-2">
      {activities.map((act) => (
        <li key={act.id} className="py-3 flex gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{act.type || "Activity"}</p>
            <p className="text-sm text-gray-600">{act.notes || act.description || "—"}</p>
            {act.created_at && (
              <p className="text-xs text-gray-400 mt-1">
                {new Date(act.created_at).toLocaleString()}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: lead, isLoading, isError } = useLead(id);
  const [activeTab, setActiveTab] = useState("details");
  const [showEdit, setShowEdit] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  if (isLoading) return <p className="p-6 text-sm text-gray-500">Loading…</p>;
  if (isError || !lead) return <p className="p-6 text-sm text-red-500">Lead not found.</p>;

  const statusColor = STATUS_COLORS[lead.status] ?? "gray";

  return (
    <div className="space-y-4">
      <SectionHeader
        title={lead.title || "Lead"}
        onBack={() => navigate("/crm/leads")}
      >
        <Badge color={statusColor}>
          {lead.status
            ? lead.status.charAt(0).toUpperCase() + lead.status.slice(1)
            : "—"}
        </Badge>
        <Button variant="secondary" onClick={() => setShowEdit(true)}>
          Edit
        </Button>
        {lead.status === "qualified" && (
          <Button onClick={() => setShowConvert(true)}>Convert to Opportunity</Button>
        )}
      </SectionHeader>

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {["details", "activities"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "details" && <DetailsTab lead={lead} />}
      {activeTab === "activities" && <ActivitiesTab leadId={id} />}

      <SlideOver open={showEdit} onClose={() => setShowEdit(false)} title="Edit Lead">
        <LeadForm
          lead={lead}
          onSuccess={() => setShowEdit(false)}
          onClose={() => setShowEdit(false)}
        />
      </SlideOver>

      {showConvert && (
        <ConvertModal
          lead={lead}
          onClose={() => setShowConvert(false)}
          onConverted={() => {
            setShowConvert(false);
            navigate("/crm/leads");
          }}
        />
      )}
    </div>
  );
}
