import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Badge from "../../../components/ui/Badge.jsx";
import Button from "../../../components/ui/Button.jsx";
import SlideOver from "../../../components/ui/SlideOver.jsx";
import { useContact } from "../hooks/useContacts.js";
import ContactForm from "./ContactForm.jsx";

const TABS = ["Overview", "Activities"];

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { contact, isLoading } = useContact(id);
  const [activeTab, setActiveTab] = useState("Overview");
  const [showEdit, setShowEdit] = useState(false);

  if (isLoading) {
    return (
      <div className="crm-contact-detail crm-contact-detail--loading">
        <div className="crm-contact-detail__skeleton" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="crm-contact-detail crm-contact-detail--empty">
        <p>Contact not found.</p>
        <Button variant="secondary" onClick={() => navigate("/crm/contacts")}>
          Back to Contacts
        </Button>
      </div>
    );
  }

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unnamed Contact";

  return (
    <div className="crm-contact-detail">
      {/* Do Not Contact Banner */}
      {contact.do_not_contact && (
        <div className="crm-contact-detail__dnc-banner" role="alert">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Do Not Contact — this person has opted out of all communications.
        </div>
      )}

      {/* Header */}
      <div className="crm-contact-detail__header">
        <div className="crm-contact-detail__header-left">
          <div className="crm-contact-detail__avatar" aria-hidden="true">
            {(contact.first_name?.[0] ?? "") + (contact.last_name?.[0] ?? "") || "?"}
          </div>
          <div className="crm-contact-detail__header-info">
            <div className="crm-contact-detail__title-row">
              <h1 className="crm-contact-detail__name">{fullName}</h1>
              {contact.is_primary && (
                <Badge variant="blue" size="sm">Primary</Badge>
              )}
            </div>
            {contact.company && (
              <button
                className="crm-contact-detail__company-link"
                onClick={() => navigate(`/crm/companies/${contact.company.id}`)}
              >
                {contact.company.name}
              </button>
            )}
            {contact.title && (
              <p className="crm-contact-detail__subtitle">
                {[contact.title, contact.department].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="crm-contact-detail__header-actions">
          <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
            Edit Contact
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="crm-contact-detail__tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`crm-contact-detail__tab ${activeTab === tab ? "crm-contact-detail__tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="crm-contact-detail__tab-content" role="tabpanel">
        {activeTab === "Overview" && (
          <div className="crm-contact-detail__overview">
            <div className="crm-contact-detail__info-card">
              <h2 className="crm-contact-detail__card-title">Contact Info</h2>
              <dl className="crm-contact-detail__info-grid">
                <dt>Email</dt>
                <dd>
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="crm-contact-detail__link">
                      {contact.email}
                    </a>
                  ) : "—"}
                </dd>

                <dt>Phone</dt>
                <dd>{contact.phone || "—"}</dd>

                <dt>Mobile</dt>
                <dd>{contact.mobile || "—"}</dd>

                <dt>Department</dt>
                <dd>{contact.department || "—"}</dd>

                <dt>Title</dt>
                <dd>{contact.title || "—"}</dd>

                <dt>LinkedIn</dt>
                <dd>
                  {contact.linkedin ? (
                    <a
                      href={contact.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="crm-contact-detail__link"
                    >
                      {contact.linkedin}
                    </a>
                  ) : "—"}
                </dd>
              </dl>
            </div>
          </div>
        )}

        {activeTab === "Activities" && (
          <div className="crm-contact-detail__activities">
            <p className="crm-contact-detail__empty-activities">No activities recorded yet.</p>
          </div>
        )}
      </div>

      {/* Edit SlideOver */}
      <SlideOver
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit Contact"
        size="md"
      >
        <ContactForm
          contact={contact}
          onSuccess={() => setShowEdit(false)}
          onClose={() => setShowEdit(false)}
        />
      </SlideOver>
    </div>
  );
}
