import { useState } from 'react';
import Tabs from '../../components/ui/Tabs.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import NetSuitePanel from './netsuite/NetSuitePanel.jsx';
import ProcorePanel from './procore/ProcorePanel.jsx';
import UnifiedSyncLog from './UnifiedSyncLog.jsx';
import WebhookEventList from './WebhookEventList.jsx';

export default function SyncLogViewer() {
  const [tab, setTab] = useState('netsuite');

  return (
    <div style={{ padding: 20, display: 'grid', gap: 12 }}>
      <SectionHeader title="Integrations" subtitle="NetSuite, Procore, sync logs, and webhooks" />
      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'netsuite', label: 'NetSuite' },
          { id: 'procore', label: 'Procore' },
          { id: 'logs', label: 'Sync Logs' },
          { id: 'webhooks', label: 'Webhooks' },
        ]}
      />

      {tab === 'netsuite' && <NetSuitePanel />}
      {tab === 'procore' && <ProcorePanel />}
      {tab === 'logs' && <UnifiedSyncLog />}
      {tab === 'webhooks' && <WebhookEventList />}
    </div>
  );
}
