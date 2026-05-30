import { useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import ScheduleRunConfig from './ScheduleRunConfig.jsx';
import ScheduleDiffTable from './ScheduleDiffTable.jsx';
import ConflictList from './conflicts/ConflictList.jsx';
import TaskBoard from './tasks/TaskBoard.jsx';
import { useAutoScheduleRun } from './hooks/useAutoScheduleRun.js';

export default function AutoSchedulePanel() {
  const [strategy, setStrategy] = useState('leveled');
  const [tab, setTab] = useState('diff');
  const [result, setResult] = useState({ schedule: [], conflicts: [] });
  const { run, apply } = useAutoScheduleRun();

  async function handleRun() {
    const out = await run.mutateAsync({ strategy });
    setResult(out);
  }

  async function handleApply() {
    if (!result.schedule.length) return;
    await apply.mutateAsync(result.schedule);
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 12 }}>
      <SectionHeader
        title="Auto Scheduling"
        subtitle="Generate routing schedules and detect conflicts"
        actions={<Button onClick={handleApply} loading={apply.isPending} disabled={!result.schedule.length}>Apply Schedule</Button>}
      />

      <ScheduleRunConfig strategy={strategy} setStrategy={setStrategy} onRun={handleRun} running={run.isPending} />

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'diff', label: 'Schedule Diff', badge: result.schedule.length },
          { id: 'conflicts', label: 'Conflicts', badge: result.conflicts.length },
          { id: 'tasks', label: 'Task Board' },
        ]}
      />

      {run.error && <div style={{ color: '#b91c1c' }}>Run failed: {run.error.message}</div>}

      {tab === 'diff' && <ScheduleDiffTable rows={result.schedule} />}
      {tab === 'conflicts' && <ConflictList conflicts={result.conflicts} />}
      {tab === 'tasks' && <TaskBoard rows={result.schedule} />}
    </div>
  );
}
