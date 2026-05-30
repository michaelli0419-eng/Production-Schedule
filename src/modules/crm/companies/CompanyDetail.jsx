import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import SlideOver from '../../../components/ui/SlideOver.jsx';
import SectionHeader from '../../../components/ui/SectionHeader.jsx';
import ActivityFeed from '../../../components/ui/ActivityFeed.jsx';
import StatusChip from '../../../components/ui/StatusChip.jsx';
import { useCompany } from '../hooks/useCompanies.js';
import CompanyForm from './CompanyForm.jsx';

const TYPE_COLORS = {
  district: 'blue',
  charter: 'purple',
  private: 'indigo',
  contractor: 'orange',
  subcontractor: 'yellow',
  vendor: 'green',
  other: 'gray',
};

const TABS = ['Overview', 'Contacts', 'Opportunities', 'Activities'];

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 8, paddingBottom: 10 }}>
      <span
        style={{
          minWidth: 140,
          fontSize: '0.8125rem',
          color: '#6b7280',
          fontWeight: 500,
          paddingTop: 1,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: '0.875rem', color: '#111827', flex: 1 }}>{value}</span>
    </div>
  );
}

function ContactsTab({ contacts = [] }) {
  if (contacts.length === 0) {
    return (
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 16 }}>
        No contacts linked to this company.
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 8 }}>
      {contacts.map((c) => (
        <div
          key={c.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 6,
            background: '#f9fafb',
            fontSize: '0.875rem',
          }}
        >
          <span style={{ fontWeight: 500, color: '#111827' }}>
            {c.first_name} {c.last_name}
          </span>
          <span style={{ color: '#6b7280' }}>{c.title || '—'}</span>
          <span style={{ color: '#2563eb' }}>
            {c.email ? (
              <a href={`mailto:${c.email}`} style={{ color: 'inherit' }}>
                {c.email}
              </a>
            ) : (
              '—'
            )}
          </span>
          <span style={{ color: '#374151' }}>{c.phone || '—'}</span>
        </div>
      ))}
    </div>
  );
}

function OpportunitiesTab({ opportunities = [] }) {
  const STAGE_COLORS = {
    prospecting: 'gray',
    qualification: 'blue',
    proposal: 'indigo',
    negotiation: 'yellow',
    'closed-won': 'green',
    'closed-lost': 'red',
  };

  if (opportunities.length === 0) {
    return (
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 16 }}>
        No opportunities linked to this company.
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 8 }}>
      {opportunities.map((opp) => (
        <div
          key={opp.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 6,
            background: '#f9fafb',
            fontSize: '0.875rem',
            alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 500, color: '#111827' }}>{opp.name}</span>
          <Badge color={STAGE_COLORS[opp.stage] || 'gray'}>
            {opp.stage
              ? opp.stage.charAt(0).toUpperCase() + opp.stage.slice(1)
              : '—'}
          </Badge>
          <span style={{ color: '#374151' }}>
            {opp.value != null
              ? `$${Number(opp.value).toLocaleString()}`
              : '—'}
          </span>
          <span style={{ color: '#6b7280' }}>
            {opp.close_date
              ? new Date(opp.close_date).toLocaleDateString()
              : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CompanyDetail() {
  const { id } = useParams();
  const { company, isLoading } = useCompany(id);
  const [activeTab, setActiveTab] = useState('Overview');
  const [showEdit, setShowEdit] = useState(false);

  if (isLoading) {
    return (
      <div style={{ padding: 32, color: '#6b7280', fontSize: '0.875rem' }}>
        Loading…
      </div>
    );
  }

  if (!company) {
    return (
      <div style={{ padding: 32, color: '#6b7280', fontSize: '0.875rem' }}>
        Company not found.
      </div>
    );
  }

  const addressParts = [
    company.billing_city,
    company.billing_state,
    company.billing_zip,
  ].filter(Boolean);

  return (
    <div className="crm-company-detail">
      <SectionHeader
        title={company.name}
        subtitle={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {company.type ? (
              <Badge color={TYPE_COLORS[company.type] || 'gray'}>
                {company.type.charAt(0).toUpperCase() + company.type.slice(1)}
              </Badge>
            ) : null}
            {company.source_type === 'clients_fallback' ? (
              <Badge color="yellow">Clients Fallback</Badge>
            ) : null}
          </div>
        }
        back
        actions={
          <Button variant="secondary" onClick={() => setShowEdit(true)}>
            Edit
          </Button>
        }
      />

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid #e5e7eb',
          marginBottom: 20,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 18px',
              fontSize: '0.875rem',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#2563eb' : '#6b7280',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'Overview' && (
        <div style={{ maxWidth: 600 }}>
          <InfoRow label="Short Name" value={company.short_name} />
          <InfoRow label="Phone" value={company.phone} />
          <InfoRow
            label="Website"
            value={
              company.website ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2563eb' }}
                >
                  {company.website}
                </a>
              ) : null
            }
          />
          <InfoRow label="Territory" value={company.territory} />
          <InfoRow
            label="Billing Address"
            value={addressParts.length > 0 ? addressParts.join(', ') : null}
          />
          <InfoRow label="NetSuite ID" value={company.netsuite_id} />
          {company.notes && (
            <div style={{ marginTop: 16 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  color: '#6b7280',
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                Notes
              </span>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: '#374151',
                  background: '#f9fafb',
                  borderRadius: 6,
                  padding: '10px 12px',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {company.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Contacts' && (
        <ContactsTab contacts={company.contacts} />
      )}

      {activeTab === 'Opportunities' && (
        <OpportunitiesTab opportunities={company.opportunities} />
      )}

      {activeTab === 'Activities' && (
        <div style={{ marginTop: 8 }}>
          <ActivityFeed entityType="company" entityId={id} />
        </div>
      )}

      <SlideOver
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit Company"
        size="md"
      >
        <CompanyForm
          company={company}
          onSuccess={() => setShowEdit(false)}
          onClose={() => setShowEdit(false)}
        />
      </SlideOver>
    </div>
  );
}
