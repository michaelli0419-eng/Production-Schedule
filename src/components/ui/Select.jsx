import React from 'react';

export default function Select({
  value,
  onChange,
  options = [],
  placeholder,
  disabled,
  error,
  size = 'md',
  clearable,
}) {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  const showClear = clearable && value !== '' && value != null && !disabled;

  return (
    <div className={`ui-select-wrapper ui-select-wrapper--${size}${error ? ' ui-select-wrapper--error' : ''}`}>
      <select
        className={`ui-select ui-select--${size}${error ? ' ui-select--error' : ''}${showClear ? ' ui-select--clearable' : ''}`}
        value={value ?? ''}
        onChange={handleChange}
        disabled={disabled}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="ui-select__arrow" aria-hidden="true">&#9660;</span>
      {showClear && (
        <button
          type="button"
          className="ui-select__clear"
          onClick={handleClear}
          aria-label="Clear selection"
          tabIndex={-1}
        >
          &#x2715;
        </button>
      )}
    </div>
  );
}
