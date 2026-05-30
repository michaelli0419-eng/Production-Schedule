import { NavLink, Navigate, Route, Routes } from "react-router-dom";
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

const tabs = [
  { to: "dashboard", label: "Dashboard" },
  { to: "companies", label: "Companies" },
  { to: "contacts", label: "Contacts" },
  { to: "leads", label: "Leads" },
  { to: "opportunities", label: "Opportunities" },
  { to: "activities", label: "Activities" },
];

export default function CrmModule() {
  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>CRM</h2>
      <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            style={({ isActive }) => ({
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              color: isActive ? "#111827" : "#6b7280",
              background: isActive ? "#f3f4f6" : "#fff",
              fontWeight: 600,
              fontSize: 14,
            })}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

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
