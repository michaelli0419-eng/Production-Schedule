import React from 'react';

export default function FormField({ label, required, error, hint, children, horizontal }) {
  return (
    <div className={`ui-form-field${horizontal ? ' ui-form-field--horizontal' : ''}${error ? ' ui-form-field--error' : ''}`}>
      {label && (
        <label className="ui-form-field__label">
          {label}
          {required && <span className="ui-form-field__required" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className="ui-form-field__control">
        {children}
        {error && (
          <p className="ui-form-field__error" role="alert">{error}</p>
        )}
        {!error && hint && (
          <p className="ui-form-field__hint">{hint}</p>
        )}
      </div>
    </div>
  );
}
