import React, { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore.js';

const Icons = {
  Dashboard: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  CRM: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Quoting: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10,9 9,9 8,9" />
    </svg>
  ),
  Jobs: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="16" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  ),
  Scheduler: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  RoutingEngine: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
    </svg>
  ),
  Capacity: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
    </svg>
  ),
  Scheduling: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  ),
  SalesPipeline: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h8v4H3z" />
      <path d="M13 10h8v4h-8z" />
      <path d="M7 14h10v4H7z" />
    </svg>
  ),
  Workflow: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3h12a2 2 0 0 1 2 2v4H4V5a2 2 0 0 1 2-2z" />
      <path d="M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z" />
      <path d="M9 13h6M9 17h3" />
    </svg>
  ),
  Materials: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Integrations: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  AIIntake: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
      <circle cx="9" cy="14" r="1" />
      <circle cx="15" cy="14" r="1" />
    </svg>
  ),
  ChevronDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6,9 12,15 18,9" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9,18 15,12 9,6" />
    </svg>
  ),
  MenuCollapse: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  User: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Logout: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Bell: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

const CRM_SUB_ITEMS = [
  { label: 'Companies', path: '/crm/companies' },
  { label: 'Contacts', path: '/crm/contacts' },
  { label: 'Leads', path: '/crm/leads' },
  { label: 'Opportunities', path: '/crm/opportunities' },
];

const PAGE_META = [
  { match: /^\/$|^\/dashboard/, title: 'Dashboard', subtitle: 'Operational command center for backlog, blockers, readiness, and capacity.', chips: ['Production Backlog', 'Blocked Jobs', 'Utilization'] },
  { match: /^\/crm/, title: 'CRM Workspace', subtitle: 'Manage companies, leads, opportunities, and activity timelines.', chips: ['Pipeline Health', 'Owner Routing', 'Activity Feed'] },
  { match: /^\/quotes|^\/quoting/, title: 'Quotes', subtitle: 'Manage quote approvals and revisions before production release.', chips: ['Approval Status', 'Revisions', 'Margin'] },
  { match: /^\/jobs|^\/production\/jobs/, title: 'Production Jobs', subtitle: 'Control object for release gates, references, and execution readiness.', chips: ['Release Gates', 'Blockers', 'Readiness'] },
  { match: /^\/scheduler|^\/production\/scheduler/, title: 'Scheduler', subtitle: 'Schedule routed tasks only, with conflict and capacity visibility.', chips: ['Scheduled Tasks', 'Conflicts', 'Lanes'] },
  { match: /^\/routing-engine/, title: 'Routing Engine', subtitle: 'Standardize templates and optimize departmental throughput.', chips: ['Template Library', 'Cycle Time', 'Dependencies'] },
  { match: /^\/capacity/, title: 'Capacity Planning', subtitle: 'Monitor load balancing and utilization by line and crew.', chips: ['Utilization', 'Bottlenecks', 'Forecast'] },
  { match: /^\/sales-pipeline/, title: 'Sales Pipeline', subtitle: 'Understand deal progression and conversion risk at a glance.', chips: ['Deal Velocity', 'Stage Aging', 'Win Probability'] },
  { match: /^\/scheduling/, title: 'Scheduling Studio', subtitle: 'Run auto-scheduling, compare proposed changes, and apply updates.', chips: ['Auto-Run', 'Diff Review', 'Exception Queue'] },
  { match: /^\/materials|^\/bom-intake/, title: 'Materials & BOM', subtitle: 'Track estimating BOM intake, validation, and material readiness.', chips: ['BOM Intake', 'Item Mapping', 'Material Risk'] },
  { match: /^\/workflow/, title: 'Workflow Handoff', subtitle: 'Coordinate sales-to-production transitions with validated checkpoints.', chips: ['Conversion Queue', 'Handoff Steps', 'Audit Trail'] },
  { match: /^\/integrations/, title: 'Integrations Hub', subtitle: 'Monitor external syncs, events, and system reliability.', chips: ['Sync Health', 'Webhook Events', 'Retry Queue'] },
  { match: /^\/ai-intake/, title: 'AI Intake Queue', subtitle: 'Review parsed inbound requests and convert into structured records.', chips: ['Inbox', 'Draft Review', 'Confidence Signals'] },
];

function Badge({ count }) {
  if (!count || count === 0) return null;
  return <span className="shell-badge">{count > 99 ? '99+' : count}</span>;
}

function NavItem({ icon: Icon, label, path, collapsed, badge, children, exact }) {
  const location = useLocation();
  // Derive expanded from location so programmatic navigation opens the accordion
  const expanded = location.pathname.startsWith(path) || location.pathname.startsWith(path + '/');
  const hasChildren = children && children.length > 0;
  const isActive = exact
    ? location.pathname === path
    : location.pathname === path || location.pathname.startsWith(path + '/');

  function handleExpandToggle(e) {
    // accordion is now location-derived; click just navigates
    if (hasChildren && !collapsed && expanded) e.preventDefault();
  }

  return (
    <div className="shell-nav-item-group">
      <NavLink
        to={path}
        end={exact}
        className={({ isActive: routerActive }) =>
          'shell-nav-item' + (routerActive || isActive ? ' shell-nav-item--active' : '')
        }
        title={collapsed ? label : undefined}
        onClick={hasChildren && !collapsed ? handleExpandToggle : undefined}
      >
        <span className="shell-nav-icon"><Icon /></span>
        {!collapsed && (
          <>
            <span className="shell-nav-label">{label}</span>
            {badge != null && <Badge count={badge} />}
            {hasChildren && (
              <span className="shell-nav-chevron">
                {expanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
              </span>
            )}
          </>
        )}
      </NavLink>

      {hasChildren && expanded && !collapsed && (
        <div className="shell-nav-subitems">
          {children.map(sub => (
            <NavLink
              key={sub.path}
              to={sub.path}
              className={({ isActive }) =>
                'shell-nav-subitem' + (isActive ? ' shell-nav-subitem--active' : '')
              }
            >
              {sub.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function usePageMeta(pathname) {
  return useMemo(() => {
    const resolved = PAGE_META.find(item => item.match.test(pathname));
    return resolved || {
      title: 'SCM Operations',
      subtitle: 'Unified planning, execution, and visibility for modular production.',
      chips: ['Operations', 'Planning', 'Execution'],
    };
  }, [pathname]);
}

function getUserInitials(user) {
  if (!user) return 'U';
  const name = user.name || user.email || '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'U';
}

export default function AppShell({ currentUser, onLogout, badgeCounts = {} }) {
  const location = useLocation();
  const [globalSearch, setGlobalSearch] = useState('');
  const { title, subtitle, chips } = usePageMeta(location.pathname);
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore(state => ({
    sidebarCollapsed: state.sidebarCollapsed,
    setSidebarCollapsed: state.setSidebarCollapsed,
  }));

  const isScheduler = /^\/scheduler|^\/production\/scheduler/.test(location.pathname);

  function toggleSidebar() {
    setSidebarCollapsed(!sidebarCollapsed);
  }

  return (
    <div className="shell-root">
      <aside className={'shell-sidebar' + (sidebarCollapsed ? ' shell-sidebar--collapsed' : '')}>
        <div className="shell-sidebar-header">
          {!sidebarCollapsed && (
            <div className="shell-brand">
              <span className="shell-brand-name">SCM Hub</span>
              <span className="shell-brand-sub">Silver Creek Modular</span>
            </div>
          )}
          <button
            className="shell-toggle-btn"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icons.MenuCollapse />
          </button>
        </div>

        <nav className="shell-nav">
          <NavItem icon={Icons.Dashboard} label="Dashboard" path="/dashboard" collapsed={sidebarCollapsed} />
          <NavItem icon={Icons.CRM} label="CRM" path="/crm" collapsed={sidebarCollapsed}>{CRM_SUB_ITEMS}</NavItem>
          <NavItem icon={Icons.SalesPipeline} label="Opportunities" path="/opportunities" collapsed={sidebarCollapsed} />
          <NavItem icon={Icons.Quoting} label="Quotes" path="/quotes" collapsed={sidebarCollapsed} />
          <NavItem icon={Icons.Materials} label="BOM Intake" path="/bom-intake" collapsed={sidebarCollapsed} />
          <div className="shell-nav-section-label">{!sidebarCollapsed && <span>Production</span>}</div>
          <NavItem icon={Icons.Jobs} label="Production Jobs" path="/jobs" collapsed={sidebarCollapsed} />
          <NavItem icon={Icons.Scheduler} label="Scheduler" path="/scheduler" collapsed={sidebarCollapsed} />
          <div className="shell-nav-section-label">{!sidebarCollapsed && <span>Planning</span>}</div>
          <NavItem icon={Icons.RoutingEngine} label="Routing Engine" path="/routing-engine" collapsed={sidebarCollapsed} />
          <NavItem icon={Icons.Capacity} label="Capacity" path="/capacity" collapsed={sidebarCollapsed} />
          <NavItem icon={Icons.SalesPipeline} label="Sales Pipeline" path="/sales-pipeline" collapsed={sidebarCollapsed} />
          <NavItem icon={Icons.Scheduling} label="Scheduling" path="/scheduling" collapsed={sidebarCollapsed} />
          <NavItem icon={Icons.Materials} label="Materials" path="/materials" collapsed={sidebarCollapsed} badge={badgeCounts.materials} />
          <NavItem icon={Icons.Workflow} label="Workflow" path="/workflow" collapsed={sidebarCollapsed} />
          <div className="shell-nav-section-label">{!sidebarCollapsed && <span>System</span>}</div>
          <NavItem icon={Icons.Integrations} label="Integrations" path="/integrations" collapsed={sidebarCollapsed} />
          <NavItem icon={Icons.AIIntake} label="AI Intake" path="/ai-intake" collapsed={sidebarCollapsed} badge={badgeCounts.aiIntake} />
        </nav>

        <div className="shell-sidebar-footer">
          <div className="shell-user-info">
            <span className="shell-user-icon"><Icons.User /></span>
            {!sidebarCollapsed && (
              <div className="shell-user-details">
                <span className="shell-user-name">{currentUser?.name || currentUser?.email || 'User'}</span>
                {currentUser?.role && <span className="shell-user-role">{currentUser.role}</span>}
              </div>
            )}
          </div>
          <button className="shell-logout-btn" onClick={onLogout} title="Log out" aria-label="Log out">
            <Icons.Logout />
            {!sidebarCollapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      <main className="shell-main">
        <header className="shell-topbar">
          <div className="shell-breadcrumbs">SCM Hub / {title}</div>
          <div className="shell-topbar-actions">
            <div className="shell-global-search">
              <span className="shell-search-icon"><Icons.Search /></span>
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search jobs, contacts, opportunities…"
                aria-label="Global search"
              />
            </div>
            <button className="shell-ghost-btn shell-icon-btn" type="button" aria-label="Notifications">
              <Icons.Bell />
            </button>
            <div className="shell-avatar" aria-label={currentUser?.name || 'User'} title={currentUser?.name || currentUser?.email || 'User'}>
              {getUserInitials(currentUser)}
            </div>
          </div>
        </header>

        {!isScheduler && (
          <>
            <section className="shell-page-head">
              <div>
                <h1>{title}</h1>
                <p>{subtitle}</p>
              </div>
              <div className="shell-page-meta" />
            </section>

            <section className="shell-feature-row">
              {chips.map((chip) => (
                <span key={chip} className="shell-feature-chip">{chip}</span>
              ))}
            </section>
          </>
        )}

        <div className="shell-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
