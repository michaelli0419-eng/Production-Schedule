export default function ScheduleRunConfig({ strategy, setStrategy, onRun, running }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <strong>Run Config</strong>
      <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
        <option value="leveled">leveled</option>
        <option value="asap">asap</option>
      </select>
      <button onClick={onRun} disabled={running}>{running ? 'Running...' : 'Run Scheduler'}</button>
    </div>
  );
}
