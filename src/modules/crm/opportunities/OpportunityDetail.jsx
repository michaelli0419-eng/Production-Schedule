import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../../../components/ui/Button.jsx';
import SectionHeader from '../../../components/ui/SectionHeader.jsx';
import { useOpportunity } from '../hooks/useOpportunities.js';

export default function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { opportunity, isLoading, error } = useOpportunity(id);

  const canConvert = useMemo(() => {
    if (!opportunity) return false;
    const stageOk = ['award', 'handoff'].includes(opportunity.stage);
    const hasApprovedQuote = (opportunity.quotes || []).some((q) => q.status === 'approved');
    const notConverted = !opportunity.converted_job_id;
    return stageOk && hasApprovedQuote && notConverted;
  }, [opportunity]);

  if (isLoading) return <div style={{ padding: 24 }}>Loading opportunity...</div>;
  if (error) return <div style={{ padding: 24, color: '#b91c1c' }}>Failed to load opportunity: {error.message}</div>;
  if (!opportunity) return <div style={{ padding: 24 }}>Opportunity not found.</div>;

  return (
    <div style={{ padding: 24, display: 'grid', gap: 12 }}>
      <SectionHeader
        title={opportunity.name || 'Opportunity'}
        subtitle={`${opportunity.opportunity_number || ''} - Stage: ${opportunity.stage}`}
        back
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(`/quoting/quotes/new?opportunityId=${opportunity.id}`)}>New Quote</Button>
            <Button onClick={() => navigate('/workflow')} disabled={!canConvert}>
              Convert to Job
            </Button>
          </>
        }
      />

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
        <div><strong>Company:</strong> {opportunity.company?.name || '-'}</div>
        <div><strong>Contract Value:</strong> ${Number(opportunity.contract_value || 0).toLocaleString()}</div>
        <div><strong>Expected Start:</strong> {opportunity.expected_start_date || '-'}</div>
        <div><strong>Expected Occupancy:</strong> {opportunity.expected_occupancy_date || '-'}</div>
        <div><strong>Quotes:</strong> {(opportunity.quotes || []).length}</div>
        <div><strong>Approved Quotes:</strong> {(opportunity.quotes || []).filter((q) => q.status === 'approved').length}</div>
        {opportunity.converted_job_id && <div><strong>Converted Job:</strong> {opportunity.converted_job_id}</div>}
      </div>

      {!canConvert && !opportunity.converted_job_id && (
        <div style={{ color: '#6b7280', fontSize: 13 }}>
          Conversion becomes available at stage Award/Handoff and after at least one approved quote.
        </div>
      )}
    </div>
  );
}
