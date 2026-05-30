import React from 'react';

const VARIANT_CLASSES = {
  primary: 'ui-btn--primary',
  secondary: 'ui-btn--secondary',
  ghost: 'ui-btn--ghost',
  danger: 'ui-btn--danger',
};

const SIZE_CLASSES = {
  sm: 'ui-btn--sm',
  md: 'ui-btn--md',
  lg: 'ui-btn--lg',
};

function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  onClick,
  type = 'button',
  children,
  className = '',
}) {
  const isDisabled = disabled || loading;

  const classes = [
    'ui-btn',
    VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
    SIZE_CLASSES[size] || SIZE_CLASSES.md,
    loading ? 'ui-btn--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      onClick={onClick}
    >
      {loading && <span className="ui-btn__spinner" aria-hidden="true" />}
      {!loading && icon && <span className="ui-btn__icon-left">{icon}</span>}
      {children && <span className="ui-btn__label">{children}</span>}
      {!loading && iconRight && <span className="ui-btn__icon-right">{iconRight}</span>}
    </button>
  );
}

export function IconButton({
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  onClick,
  type = 'button',
  className = '',
  title,
}) {
  const isDisabled = disabled || loading;

  const classes = [
    'ui-btn',
    'ui-btn--icon-only',
    VARIANT_CLASSES[variant] || VARIANT_CLASSES.ghost,
    SIZE_CLASSES[size] || SIZE_CLASSES.md,
    loading ? 'ui-btn--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabled}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {loading ? <span className="ui-btn__spinner" aria-hidden="true" /> : icon}
    </button>
  );
}

export default Button;
