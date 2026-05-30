import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import ExecutiveDashboard from './ExecutiveDashboard.jsx';
import SalesDashboard from './SalesDashboard.jsx';
import ProductionDashboard from './ProductionDashboard.jsx';
import CapacityDashboard from './CapacityDashboard.jsx';
import OTDDashboard from './OTDDashboard.jsx';
import { defaultDateRange } from './dashboardsApi.js';

function DashboardTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const [range, setRange] = useState(defaultDateRange());
  const path = location.pathname;
  const tab =
    path.includes('/dashboard/sales') ? 'sales' :
    path.includes('/dashboard/production') ? 'production' :
    path.includes('/dashboard/capacity') ? 'capacity' :
    path.includes('/dashboard/otd') ? 'otd' : 'executive';

  function onTabChange(next) {
    const p = next === 'executive' ? '/dashboard/executive' : `/dashboard/${next}`;
    navigate(p);
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 12 }}>
      <SectionHeader
        title="Dashboards"
        subtitle="Executive, sales, production, capacity, and OTD insights"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            <Button variant="secondary" onClick={() => setRange(defaultDateRange())}>Reset</Button>
          </div>
        }
      />

      <Tabs
        activeTab={tab}
        onChange={onTabChange}
        tabs={[
          { id: 'executive', label: 'Executive' },
          { id: 'sales', label: 'Sales' },
          { id: 'production', label: 'Production' },
          { id: 'capacity', label: 'Capacity' },
          { id: 'otd', label: 'OTD' },
        ]}
      />

      {tab === 'executive' && <ExecutiveDashboard range={range} />}
      {tab === 'sales' && <SalesDashboard range={range} />}
      {tab === 'production' && <ProductionDashboard range={range} />}
      {tab === 'capacity' && <CapacityDashboard range={range} />}
      {tab === 'otd' && <OTDDashboard range={range} />}
    </div>
  );
}

export default function DashboardShell() {
  return <DashboardTabs />;
}
