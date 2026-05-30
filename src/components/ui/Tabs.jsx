import React from 'react';

export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  variant = 'line',
  size = 'md',
}) {
  return (
    <div
      className={`ui-tabs ui-tabs--${variant} ui-tabs--${size}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-disabled={tab.disabled}
            disabled={tab.disabled}
            className={`ui-tabs__tab${isActive ? ' ui-tabs__tab--active' : ''}${tab.disabled ? ' ui-tabs__tab--disabled' : ''}`}
            onClick={() => !tab.disabled && onChange && onChange(tab.id)}
            tabIndex={isActive ? 0 : -1}
          >
            <span className="ui-tabs__label">{tab.label}</span>
            {tab.badge != null && (
              <span className={`ui-tabs__badge${isActive ? ' ui-tabs__badge--active' : ''}`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
