import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import DataTable from '../../../components/ui/DataTable.jsx';
import SlideOver from '../../../components/ui/SlideOver.jsx';
import SearchInput from '../../../components/ui/SearchInput.jsx';
import Select from '../../../components/ui/Select.jsx';
import SectionHeader from '../../../components/ui/SectionHeader.jsx';
import { useCompanies } from '../hooks/useCompanies.js';
import { usePagination } from '../../../hooks/usePagination.js';
import CompanyForm from './CompanyForm.jsx';

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'district', label: 'District' },
  { value: 'charter', label: 'Charter' },
  { value: 'private', label: 'Private' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'other', label: 'Other' },
];

const TYPE_COLORS = {
  district: 'blue',
  charter: 'purple',
  private: 'indigo',
  contractor: 'orange',
  subcontractor: 'yellow',
  vendor: 'green',
  other: 'gray',
};

export default function CompanyList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { page, pageSize, setPage } = usePagination({ pageSize: 25 });

  const filters = {
    search: search || undefined,
    type: typeFilter || undefined,
    page: page + 1,
    pageSize,
  };

  const { companies, total, isLoading } = useCompanies(filters);

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (_value, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 500, color: '#111827' }}>{row.name}</span>
          {row.source_type === 'clients_fallback' && (
            <Badge color="yellow">Clients Fallback</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'short_name',
      label: 'Short Name',
      render: (value) => value || <span style={{ color: '#9ca3af' }}>?</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (value) =>
        value ? (
          <Badge color={TYPE_COLORS[value] || 'gray'}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Badge>
        ) : (
          <span style={{ color: '#9ca3af' }}>—</span>
        ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (value) => value || <span style={{ color: '#9ca3af' }}>?</span>,
    },
    {
      key: 'contacts_count',
      label: 'Contacts',
      render: (value) => (
        <span style={{ color: '#374151' }}>{value ?? 0}</span>
      ),
    },
    {
      key: 'active',
      label: 'Active',
      render: (value) => (
        <Badge color={value !== false ? 'green' : 'gray'}>
          {value !== false ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="crm-company-list">
      <SectionHeader
        title="Companies"
        subtitle={`${total} total`}
        actions={
          <Button variant="primary" onClick={() => setShowForm(true)}>
            + New Company
          </Button>
        }
      />

      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: '1 1 240px', minWidth: 200 }}>
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(0);
            }}
            placeholder="Search companies…"
          />
        </div>
        <div style={{ minWidth: 160 }}>
          <Select
            value={typeFilter}
            onChange={(val) => {
              setTypeFilter(val);
              setPage(0);
            }}
            options={TYPE_OPTIONS}
            placeholder="All Types"
            clearable
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={companies}
        loading={isLoading}
        emptyText="No companies found."
        onRowClick={(row) => navigate(`/crm/companies/${row.id}`)}
      />

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
          }}
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <SlideOver
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Company"
        size="md"
      >
        <CompanyForm
          company={null}
          onSuccess={() => setShowForm(false)}
          onClose={() => setShowForm(false)}
        />
      </SlideOver>
    </div>
  );
}
