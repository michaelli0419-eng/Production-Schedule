import { useId } from 'react';

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled = false,
  error,
  placeholder,
  label,
  required = false,
}) {
  const id = useId();

  const handleChange = (e) => {
    onChange?.(e.target.value);
  };

  return (
    <div className={`ui-datepicker ${disabled ? 'ui-datepicker--disabled' : ''} ${error ? 'ui-datepicker--error' : ''}`}>
      {label && (
        <label className="ui-datepicker__label" htmlFor={id}>
          {label}
          {required && <span className="ui-datepicker__required" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className="ui-datepicker__input-wrap">
        <input
          id={id}
          type="date"
          className="ui-datepicker__input"
          value={value || ''}
          onChange={handleChange}
          min={min}
          max={max}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span className="ui-datepicker__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 1.5v2M11 1.5v2M1.5 6.5h13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </span>
      </div>
      {error && (
        <p className="ui-datepicker__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
