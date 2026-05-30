import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import DataTable from "../../../components/ui/DataTable.jsx";
import SlideOver from "../../../components/ui/SlideOver.jsx";
import Select from "../../../components/ui/Select.jsx";
import SearchInput from "../../../components/ui/SearchInput.jsx";
import SectionHeader from "../../../components/ui/SectionHeader.jsx";
import { useLeads } from "../hooks/useLeads.js";
import LeadForm from "./LeadForm.jsx";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "unqualified", label: "Unqualified" },
  { value: "converted", label: "Converted" },
  { value: "dead", label: "Dead" },
];

const STATUS_COLORS = {
  new: "blue",
  contacted: "amber",
  qualified: "green",
  unqualified: "gray",
  converted: "purple",
  dead: "red",
};

function StatusChip({ status }) {
  const color = STATUS_COLORS[status] ?? "gray";
  return (
    <Badge color={color}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : "-"}
    </Badge>
  );
}

export default function LeadList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { leads = [], isLoading } = useLeads({ search, status: statusFilter });

  const columns = [
    {
      key: "title",
      label: "Title",
      render: (value) => <span className="font-medium">{value || "-"}</span>,
    },
    {
      key: "company",
      label: "Company",
      render: (value) => value || "-",
    },
    {
      key: "contact",
      label: "Contact",
      render: (_value, row) =>
        [row.contact_first_name, row.contact_last_name].filter(Boolean).join(" ") || "-",
    },
    {
      key: "source",
      label: "Source",
      render: (value) => (value ? <Badge color="gray">{value}</Badge> : "-"),
    },
    {
      key: "status",
      label: "Status",
      render: (value) => <StatusChip status={value} />,
    },
    {
      key: "estimated_value",
      label: "Est. Value",
      render: (value) => (value != null ? `$${Number(value).toLocaleString()}` : "-"),
    },
    {
      key: "assigned_to",
      label: "Assigned To",
      render: (value) => value || "-",
    },
    {
      key: "created_at",
      label: "Created",
      render: (value) => (value ? new Date(value).toLocaleDateString() : "-"),
    },
  ];

  function handleRowClick(row) {
    navigate(`/crm/leads/${row.id}`);
  }

  function handleFormSuccess() {
    setShowForm(false);
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Leads">
        <Button onClick={() => setShowForm(true)}>New Lead</Button>
      </SectionHeader>

      <div className="flex gap-3 items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search leads..."
          className="flex-1"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          className="w-48"
        />
      </div>

      <DataTable
        columns={columns}
        data={leads}
        loading={isLoading}
        onRowClick={handleRowClick}
        emptyText="No leads found."
      />

      <SlideOver
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Lead"
      >
        <LeadForm onSuccess={handleFormSuccess} onClose={() => setShowForm(false)} />
      </SlideOver>
    </div>
  );
}
