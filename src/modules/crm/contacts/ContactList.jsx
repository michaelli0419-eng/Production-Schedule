import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import DataTable from "../../../components/ui/DataTable.jsx";
import SlideOver from "../../../components/ui/SlideOver.jsx";
import SearchInput from "../../../components/ui/SearchInput.jsx";
import SectionHeader from "../../../components/ui/SectionHeader.jsx";
import Select from "../../../components/ui/Select.jsx";
import { useContacts } from "../hooks/useContacts.js";
import ContactForm from "./ContactForm.jsx";

export default function ContactList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { contacts, isLoading } = useContacts({
    search: search || undefined,
    companyId: companyFilter || undefined,
  });

  // Build unique company options from loaded contacts for the filter dropdown
  const companyOptions = (() => {
    const seen = new Map();
    contacts.forEach((c) => {
      if (c.company?.id && !seen.has(c.company.id)) {
        seen.set(c.company.id, c.company.name);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name }));
  })();

  const handleExport = () => {
    const headers = ["First Name", "Last Name", "Company", "Title", "Department", "Email", "Phone"];
    const rows = contacts.map((c) => [
      c.first_name ?? "",
      c.last_name ?? "",
      c.company?.name ?? "",
      c.title ?? "",
      c.department ?? "",
      c.email ?? "",
      c.phone ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      key: "full_name",
      label: "Full Name",
      sortable: true,
      render: (_, row) => (
        <span className="crm-contact-list__name">
          {[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}
          {row.is_primary && (
            <Badge variant="blue" size="sm" className="crm-contact-list__primary-badge">
              Primary
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "company",
      label: "Company",
      render: (_, row) =>
        row.company ? (
          <a
            href={`/crm/companies/${row.company.id}`}
            className="crm-contact-list__company-link"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/crm/companies/${row.company.id}`);
            }}
          >
            {row.company.name}
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "title_dept",
      label: "Title / Dept",
      render: (_, row) => {
        const parts = [row.title, row.department].filter(Boolean);
        return parts.length ? parts.join(" · ") : "—";
      },
    },
    {
      key: "email",
      label: "Email",
      render: (val) =>
        val ? (
          <a
            href={`mailto:${val}`}
            className="crm-contact-list__email-link"
            onClick={(e) => e.stopPropagation()}
          >
            {val}
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (val) => val || "—",
    },
  ];

  return (
    <div className="crm-contact-list">
      <SectionHeader
        title="Contacts"
        subtitle={`${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={isLoading || contacts.length === 0}>
              Export CSV
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
              New Contact
            </Button>
          </>
        }
      />

      <div className="crm-contact-list__filters">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search contacts…"
        />
        <Select
          value={companyFilter}
          onChange={setCompanyFilter}
          options={companyOptions}
          placeholder="All Companies"
          clearable
        />
      </div>

      <DataTable
        columns={columns}
        data={contacts}
        loading={isLoading}
        emptyText="No contacts found."
        onRowClick={(row) => navigate(`/crm/contacts/${row.id}`)}
        stickyHeader
      />

      <SlideOver
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Contact"
        size="md"
      >
        <ContactForm
          onSuccess={() => setShowForm(false)}
          onClose={() => setShowForm(false)}
        />
      </SlideOver>
    </div>
  );
}
