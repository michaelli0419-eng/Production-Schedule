import React from 'react';

function EmptyState({ icon, title, description, action }) {
  return (
    <div className="ui-empty-state">
      {icon && (
        <div className="ui-empty-state__icon" aria-hidden="true">
          {typeof icon === 'string' ? (
            <span className="ui-empty-state__emoji">{icon}</span>
          ) : (
            icon
          )}
        </div>
      )}
      {title && <h3 className="ui-empty-state__title">{title}</h3>}
      {description && (
        <p className="ui-empty-state__description">{description}</p>
      )}
      {action && <div className="ui-empty-state__action">{action}</div>}
    </div>
  );
}

export default EmptyState;
