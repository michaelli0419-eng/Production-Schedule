import React, { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import AppShell from './AppShell.jsx';

// All modules lazy-loaded — keeps main bundle lean
const DashboardShell       = lazy(() => import('../modules/dashboards/DashboardShell.jsx'));
const CrmModule            = lazy(() => import('../modules/crm/CrmModule.jsx'));
const QuoteList            = lazy(() => import('../modules/quoting/QuoteList.jsx'));
const JobList              = lazy(() => import('../modules/production/jobs/JobList.jsx'));
const SchedulerPage        = lazy(() => import('../modules/scheduler/SchedulerPage.jsx'));
const TemplateList         = lazy(() => import('../modules/routing/TemplateList.jsx'));
const CapacityHeatmap      = lazy(() => import('../modules/capacity/CapacityHeatmap.jsx'));
const AutoSchedulePanel    = lazy(() => import('../modules/scheduling/AutoSchedulePanel.jsx'));
const RequirementsList     = lazy(() => import('../modules/materials/requirements/RequirementsList.jsx'));
const SyncLogViewer        = lazy(() => import('../modules/integrations/SyncLogViewer.jsx'));
const IntakeInbox          = lazy(() => import('../modules/ai-intake/IntakeInbox.jsx'));
const ConversionQueue      = lazy(() => import('../modules/workflow/ConversionQueue.jsx'));

function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: 300,
      gap: 16,
      color: '#6b7280',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        width: 36,
        height: 36,
        border: '3px solid #e5e7eb',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'shell-spin 0.7s linear infinite',
      }} />
      <span style={{ fontSize: 14 }}>Loading…</span>
      <style>{`@keyframes shell-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function withSuspense(element) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

export function createAppRoutes({ currentUser, permissions, onLogout }) {
  return [
    {
      path: '/',
      element: <AppShell currentUser={currentUser} onLogout={onLogout} />,
      children: [
        // Dashboard — landing page
        { index: true,                    element: withSuspense(<DashboardShell currentUser={currentUser} permissions={permissions} />) },
        { path: 'dashboard',              element: <Navigate to="/" replace /> },
        { path: 'dashboard/*',            element: withSuspense(<DashboardShell currentUser={currentUser} permissions={permissions} />) },

        // CRM — all sub-routes handled internally by CrmModule
        { path: 'crm/*',                  element: withSuspense(<CrmModule currentUser={currentUser} permissions={permissions} />) },

        // Quoting
        { path: 'quoting/*',              element: withSuspense(<QuoteList currentUser={currentUser} permissions={permissions} />) },

        // Production
        { path: 'production/jobs/*',      element: withSuspense(<JobList currentUser={currentUser} permissions={permissions} />) },
        { path: 'production/scheduler',   element: <Navigate to="/scheduler" replace /> },

        // Scheduler — lazy-loaded wrapper around ProductionScheduler
        {
          path: 'scheduler',
          element: withSuspense(
            <SchedulerPage
              currentUser={currentUser}
              permissions={permissions}
              onLogout={onLogout}
            />
          ),
        },

        // Conversion workflow
        { path: 'workflow/*',             element: withSuspense(<ConversionQueue currentUser={currentUser} permissions={permissions} />) },

        // Operations modules
        { path: 'routing-engine/*',       element: withSuspense(<TemplateList currentUser={currentUser} permissions={permissions} />) },
        { path: 'capacity/*',             element: withSuspense(<CapacityHeatmap currentUser={currentUser} permissions={permissions} />) },
        { path: 'scheduling/*',           element: withSuspense(<AutoSchedulePanel currentUser={currentUser} permissions={permissions} />) },
        { path: 'materials/*',            element: withSuspense(<RequirementsList currentUser={currentUser} permissions={permissions} />) },

        // System
        { path: 'integrations/*',         element: withSuspense(<SyncLogViewer currentUser={currentUser} permissions={permissions} />) },
        { path: 'ai-intake/*',            element: withSuspense(<IntakeInbox currentUser={currentUser} permissions={permissions} />) },

        // Catch-all
        { path: '*',                      element: <Navigate to="/" replace /> },
      ],
    },
  ];
}

export { PageLoader };
