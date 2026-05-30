import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import CrmDashboard from "./CrmDashboard.jsx";
import CompanyList from "./companies/CompanyList.jsx";
import CompanyDetail from "./companies/CompanyDetail.jsx";
import ContactList from "./contacts/ContactList.jsx";
import ContactDetail from "./contacts/ContactDetail.jsx";
import LeadList from "./leads/LeadList.jsx";
import LeadDetail from "./leads/LeadDetail.jsx";
import OpportunityList from "./opportunities/OpportunityList.jsx";
import OpportunityDetail from "./opportunities/OpportunityDetail.jsx";
import ActivityList from "./activities/ActivityList.jsx";

const TABS = [
  { to: "dashboard",     label: "Dashboard" },
  { to: "companies",     label: "Companies" },
  { to: "contacts",      label: "Contacts" },
  { to: "leads",         label: "Leads" },
  { to: "opportunities", label: "Opportunities" },
  { to: "activities",    label: "Activities" },
];

export default function CrmModule() {
  const location = useLocation();

  return (
    <div className="scm-module">
      <nav className="crm-tabs">
        {TABS.map((tab) => {
          const active =
            tab.to === "dashboard"
              ? location.pathname === "/crm" || location.pathname === "/crm/dashboard"
              : location.pathname.startsWith(`/crm/${tab.to}`);
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={`crm-tab${active ? " crm-tab--active" : ""}`}
            >
              {tab.label}
            </NavLink>
          );
        })}
      </nav>

      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CrmDashboard />} />
        <Route path="companies" element={<CompanyList />} />
        <Route path="companies/:id" element={<CompanyDetail />} />
        <Route path="contacts" element={<ContactList />} />
        <Route path="contacts/:id" element={<ContactDetail />} />
        <Route path="leads" element={<LeadList />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="opportunities" element={<OpportunityList />} />
        <Route path="opportunities/:id" element={<OpportunityDetail />} />
        <Route path="activities" element={<ActivityList />} />
      </Routes>
    </div>
  );
}
