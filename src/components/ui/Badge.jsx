import React from 'react';

const VARIANT_CLASSES = {
  default: 'ui-badge--default',
  blue: 'ui-badge--blue',
  green: 'ui-badge--green',
  amber: 'ui-badge--amber',
  red: 'ui-badge--red',
  purple: 'ui-badge--purple',
  gray: 'ui-badge--gray',
};

const SIZE_CLASSES = {
  sm: 'ui-badge--sm',
  md: 'ui-badge--md',
};

function Badge({ variant = 'default', size = 'md', dot = false, children }) {
  const classes = [
    'ui-badge',
    VARIANT_CLASSES[variant] || VARIANT_CLASSES.default,
    SIZE_CLASSES[size] || SIZE_CLASSES.md,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {dot && <span className="ui-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export default Badge;
