import React, { useState, useEffect } from 'react';

function formatCurrency(num) {
  if (num == null || num === '' || isNaN(num)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function parseRaw(str) {
  if (str == null || str === '') return null;
  const cleaned = str.replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export default function CurrencyInput({
  value,
  onChange,
  disabled,
  error,
  size = 'md',
  placeholder = '$0.00',
}) {
  const [focused, setFocused] = useState(false);
  const [rawText, setRawText] = useState('');

  useEffect(() => {
    if (!focused) {
      setRawText(value != null && value !== '' ? String(value) : '');
    }
  }, [value, focused]);

  const handleFocus = () => {
    setFocused(true);
    setRawText(value != null && value !== '' ? String(value) : '');
  };

  const handleBlur = () => {
    setFocused(false);
    const num = parseRaw(rawText);
    onChange && onChange(num);
    setRawText(num != null ? String(num) : '');
  };

  const handleChange = (e) => {
    setRawText(e.target.value);
  };

  const displayValue = focused
    ? rawText
    : value != null && value !== ''
    ? formatCurrency(value)
    : '';

  return (
    <div className={`ui-currency-input ui-currency-input--${size}${error ? ' ui-currency-input--error' : ''}${disabled ? ' ui-currency-input--disabled' : ''}`}>
      <span className="ui-currency-input__symbol" aria-hidden="true">$</span>
      <input
        type="text"
        className="ui-currency-input__input"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        inputMode="decimal"
      />
    </div>
  );
}
