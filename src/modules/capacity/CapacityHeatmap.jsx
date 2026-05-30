import { useMemo, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import { useCapacityData, useCreateCapacityBlock, useSaveCapacityRule } from './hooks/useCapacityData.js';

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKey(date) {
  const d = startOfWeek(date);
  return d.toISOString().slice(0, 10);
}

function addWeeks(date, count) {
  const d = new Date(date);
  d.setDate(d.getDate() + count * 7);
  return d;
}

function overlapsWeek(stepStart, stepEnd, weekStart) {
  const ws = new Date(weekStart);
  const we = addWeeks(ws, 1);
  return new Date(stepStart) < we && new Date(stepEnd || stepStart) >= ws;
}

function cellTone(util) {
  if (util > 0.9) return '#fee2e2';
  if (util > 0.7) return '#fef3c7';
  return '#dcfce7';
}

function lineLabel(code) {
  if (!code) return 'Unassigned';
  const [line] = code.split('-');
  return line;
}

export default function CapacityHeatmap() {
  const { departments, rules, blocks, routingSteps, isLoading, error } = useCapacityData();
  const saveRule = useSaveCapacityRule();
  const createBlock = useCreateCapacityBlock();

  const [selectedDept, setSelectedDept] = useState('');
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockType, setNewBlockType] = useState('holiday');
  const [newBlockPct, setNewBlockPct] = useState(0);

  const weeks = useMemo(() => {
    const base = startOfWeek(new Date());
    return Array.from({ length: 13 }).map((_, i) => addWeeks(base, i));
  }, []);

  const latestRuleByDept = useMemo(() => {
    const map = new Map();
    for (const rule of rules) {
      if (!map.has(rule.department_id)) map.set(rule.department_id, rule);
    }
    return map;
  }, [rules]);

  const blockByDeptWeek = useMemo(() => {
    const map = new Map();
    for (const block of blocks) {
      const key = `${block.department_id || 'ALL'}::${weekKey(block.block_date)}`;
      map.set(key, block);
    }
    return map;
  }, [blocks]);

  const rows = useMemo(() => {
    return departments.map((dept) => {
      const rule = latestRuleByDept.get(dept.id);
      const capHoursPerWeek = Number(rule?.shifts_per_day || 1) * Number(rule?.hours_per_shift || 8) * Number(rule?.days_per_week || 5) * Number(rule?.crew_size || 1);

      const weekCells = weeks.map((w) => {
        const wk = weekKey(w);
        const demand = routingSteps
          .filter((s) => s.department_id === dept.id)
          .filter((s) => overlapsWeek(s.planned_start, s.planned_end, w))
          .reduce((sum, s) => sum + Number(s.planned_hours || 0), 0);

        const deptBlock = blockByDeptWeek.get(`${dept.id}::${wk}`);
        const globalBlock = blockByDeptWeek.get(`ALL::${wk}`);
        const block = deptBlock || globalBlock;
        const multiplier = block ? Number(block.capacity_pct || 0) / 100 : 1;
        const capacity = capHoursPerWeek * multiplier;
        const utilization = capacity > 0 ? demand / capacity : 0;

        return { wk, demand, capacity, utilization, block };
      });

      return { dept, rule, capHoursPerWeek, weekCells };
    });
  }, [departments, latestRuleByDept, weeks, routingSteps, blockByDeptWeek]);

  async function saveRuleForDept(deptId, patch) {
    const existing = latestRuleByDept.get(deptId);
    const payload = {
      id: existing?.id,
      department_id: deptId,
      effective_date: existing?.effective_date || new Date().toISOString().slice(0, 10),
      shifts_per_day: Number(patch.shifts_per_day ?? existing?.shifts_per_day ?? 1),
      hours_per_shift: Number(patch.hours_per_shift ?? existing?.hours_per_shift ?? 8),
      days_per_week: Number(patch.days_per_week ?? existing?.days_per_week ?? 5),
      crew_size: Number(patch.crew_size ?? existing?.crew_size ?? 1),
      notes: existing?.notes || null,
    };
    await saveRule.mutateAsync(payload);
  }

  async function addCapacityBlock() {
    if (!newBlockDate || !newBlockName) return;
    await createBlock.mutateAsync({
      department_id: selectedDept || null,
      block_date: newBlockDate,
      block_type: newBlockType,
      capacity_pct: Number(newBlockPct),
      name: newBlockName,
    });
    setNewBlockName('');
  }

  if (isLoading) return <div style={{ padding: 24 }}>Loading capacity data...</div>;
  if (error) return <div style={{ padding: 24, color: '#b91c1c' }}>Capacity load failed: {error.message}</div>;

  return (
    <div style={{ padding: 20, display: 'grid', gap: 14 }}>
      <SectionHeader title="Capacity Planning" subtitle="Department labor capacity vs routing demand (13 weeks)" />

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Capacity Blocks / Holidays</div>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 180px 160px 140px 1fr auto', gap: 8 }}>
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
          </select>
          <input type="date" value={newBlockDate} onChange={(e) => setNewBlockDate(e.target.value)} />
          <select value={newBlockType} onChange={(e) => setNewBlockType(e.target.value)}>
            <option value="holiday">holiday</option>
            <option value="shutdown">shutdown</option>
            <option value="reduced">reduced</option>
            <option value="overtime">overtime</option>
            <option value="training">training</option>
          </select>
          <input type="number" min="0" max="200" value={newBlockPct} onChange={(e) => setNewBlockPct(e.target.value)} placeholder="capacity %" />
          <input value={newBlockName} onChange={(e) => setNewBlockName(e.target.value)} placeholder="Block name" />
          <Button onClick={addCapacityBlock} loading={createBlock.isPending}>Add</Button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb', minWidth: 260 }}>Department</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Rule</th>
              {weeks.map((w) => (
                <th key={w.toISOString()} style={{ textAlign: 'center', padding: 8, borderBottom: '1px solid #e5e7eb', minWidth: 88 }}>
                  {w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.dept.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontWeight: 700 }}>{row.dept.code}</div>
                  <div style={{ color: '#6b7280' }}>{row.dept.name} · {lineLabel(row.dept.code)}</div>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '50px 50px 50px 50px', gap: 4 }}>
                    <input type="number" value={row.rule?.shifts_per_day || 1} min="1" onBlur={(e) => saveRuleForDept(row.dept.id, { shifts_per_day: e.target.value })} />
                    <input type="number" value={row.rule?.hours_per_shift || 8} min="1" onBlur={(e) => saveRuleForDept(row.dept.id, { hours_per_shift: e.target.value })} />
                    <input type="number" value={row.rule?.days_per_week || 5} min="1" max="7" onBlur={(e) => saveRuleForDept(row.dept.id, { days_per_week: e.target.value })} />
                    <input type="number" value={row.rule?.crew_size || 1} min="1" onBlur={(e) => saveRuleForDept(row.dept.id, { crew_size: e.target.value })} />
                  </div>
                </td>
                {row.weekCells.map((cell) => (
                  <td key={cell.wk} style={{ padding: 6, borderBottom: '1px solid #f3f4f6', textAlign: 'center', background: cellTone(cell.utilization) }}>
                    <div style={{ fontWeight: 700 }}>{Math.round(cell.utilization * 100)}%</div>
                    <div style={{ color: '#6b7280' }}>{Math.round(cell.demand)}h / {Math.round(cell.capacity)}h</div>
                    {cell.block && <div style={{ color: '#92400e' }}>{cell.block.block_type}</div>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 12, color: '#6b7280' }}>
        Rule columns are: shifts/day, hours/shift, days/week, crew size. Edit values and click out to save.
      </div>
    </div>
  );
}
