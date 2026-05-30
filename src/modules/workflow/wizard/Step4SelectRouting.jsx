import { useRoutingTemplates } from '../../routing/hooks/useRoutingTemplates.js';

export default function Step4SelectRouting({ state, patch }) {
  const { templates, isLoading } = useRoutingTemplates();

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <h3 style={{ margin: 0 }}>Select Routing Template</h3>
      <p style={{ margin: 0, color: '#6b7280' }}>Template steps will be copied into job routing steps at conversion.</p>
      <select value={state.routing_template_id} onChange={(e) => patch({ routing_template_id: e.target.value })}>
        <option value="">{isLoading ? 'Loading templates...' : 'No template selected'}</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.code ? `${t.code} - ` : ''}{t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
