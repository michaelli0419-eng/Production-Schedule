import { useMemo, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import { useDepartments } from './hooks/useDepartments.js';
import { useRoutingTemplate, useRoutingTemplates, useSaveRoutingTemplate } from './hooks/useRoutingTemplates.js';
import TemplateBuilder from './builder/TemplateBuilder.jsx';
import DepartmentManager from './departments/DepartmentManager.jsx';
import RoutingPreview from './RoutingPreview.jsx';

export default function TemplateList() {
  const { templates, isLoading } = useRoutingTemplates();
  const { departments } = useDepartments();
  const saveTemplate = useSaveRoutingTemplate();
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) || templates[0], [templates, selectedId]);
  const { template } = useRoutingTemplate(selected?.id);

  async function createTemplate() {
    const created = await saveTemplate.mutateAsync({
      payload: {
        name: `Template ${new Date().toISOString().slice(0, 10)}`,
        code: `TPL-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        description: 'New routing template',
        is_active: true,
      },
    });
    setSelectedId(created.id);
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 12 }}>
      <SectionHeader
        title="Routing Engine"
        subtitle="Templates and department sequencing"
        actions={<Button onClick={createTemplate} loading={saveTemplate.isPending}>New Template</Button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 8, alignContent: 'start' }}>
          <div style={{ fontWeight: 700 }}>Templates</div>
          {isLoading && <div>Loading...</div>}
          {!isLoading && templates.length === 0 && <div style={{ color: '#6b7280' }}>No templates yet.</div>}
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              style={{ textAlign: 'left', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: selected?.id === t.id ? '#eff6ff' : '#fff', cursor: 'pointer' }}
            >
              <div style={{ fontWeight: 700 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{t.code || '-'} - v{t.version || 1}</div>
            </button>
          ))}

          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Departments</div>
            <DepartmentManager departments={departments} />
          </div>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, display: 'grid', gap: 12 }}>
          {!template && <div style={{ color: '#6b7280' }}>Select or create a template.</div>}
          {template && (
            <>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{template.name}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{template.description || 'No description'}</div>
              </div>
              <RoutingPreview template={template} />
              <TemplateBuilder template={template} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
