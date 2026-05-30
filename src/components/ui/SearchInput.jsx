import React, { useState, useEffect, useRef } from 'react';

export default function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  debounce = 300,
  loading,
  size = 'md',
}) {
  const [internalValue, setInternalValue] = useState(value ?? '');
  const timerRef = useRef(null);
  const isControlled = value !== undefined;

  useEffect(() => {
    if (isControlled) {
      setInternalValue(value ?? '');
    }
  }, [value, isControlled]);

  const handleChange = (e) => {
    const next = e.target.value;
    setInternalValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange && onChange(next);
    }, debounce);
  };

  const handleClear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setInternalValue('');
    onChange && onChange('');
    onClear && onClear();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const displayValue = isControlled ? (value ?? '') : internalValue;

  return (
    <div className={`ui-search-input ui-search-input--${size}`}>
      <span className="ui-search-input__icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="text"
        className="ui-search-input__input"
        value={isControlled ? displayValue : internalValue}
        onChange={handleChange}
        placeholder={placeholder}
      />
      {loading && (
        <span className="ui-search-input__loading" aria-label="Loading">
          <span className="ui-search-input__spinner" />
        </span>
      )}
      {!loading && (isControlled ? displayValue : internalValue) !== '' && (
        <button
          type="button"
          className="ui-search-input__clear"
          onClick={handleClear}
          aria-label="Clear search"
          tabIndex={-1}
        >
          &#x2715;
        </button>
      )}
    </div>
  );
}
