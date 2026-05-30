import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button.jsx';
import { useConversionWizard } from '../hooks/useConversionWizard.js';
import { useConvertOpportunity } from '../hooks/useConvertOpportunity.js';
import Step1ReviewDeal from './Step1ReviewDeal.jsx';
import Step2AssignDetails from './Step2AssignDetails.jsx';
import Step3SetSchedule from './Step3SetSchedule.jsx';
import Step4SelectRouting from './Step4SelectRouting.jsx';
import Step5Confirm from './Step5Confirm.jsx';

function Stepper({ step }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      {[1,2,3,4,5].map((n) => (
        <div key={n} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: n === step ? '#111827' : '#fff', color: n === step ? '#fff' : '#374151', fontSize: 12, fontWeight: 700 }}>Step {n}</div>
      ))}
    </div>
  );
}

export default function ConversionWizard({ opportunity }) {
  const navigate = useNavigate();
  const { step, state, patch, next, prev, canSubmit } = useConversionWizard(opportunity);
  const convert = useConvertOpportunity();

  async function submit() {
    const result = await convert.mutateAsync({ opportunityId: opportunity.id, jobData: state });
    navigate(`/production/jobs/${result.jobId}`);
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
      <Stepper step={step} />

      {step === 1 && <Step1ReviewDeal opportunity={opportunity} />}
      {step === 2 && <Step2AssignDetails state={state} patch={patch} />}
      {step === 3 && <Step3SetSchedule state={state} patch={patch} />}
      {step === 4 && <Step4SelectRouting state={state} patch={patch} />}
      {step === 5 && <Step5Confirm opportunity={opportunity} state={state} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <Button variant="secondary" onClick={prev} disabled={step === 1 || convert.isPending}>Back</Button>
        {step < 5 ? (
          <Button onClick={next}>Next</Button>
        ) : (
          <Button onClick={submit} loading={convert.isPending} disabled={!canSubmit}>Create Job</Button>
        )}
      </div>
    </div>
  );
}
