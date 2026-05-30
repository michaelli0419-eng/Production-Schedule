import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const SIZE_CLASSES = {
  sm: 'ui-slideover--sm',
  md: 'ui-slideover--md',
  lg: 'ui-slideover--lg',
};

export default function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
}) {
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  const getFocusableElements = useCallback(() => {
    if (!panelRef.current) return [];
    return Array.from(
      panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) { e.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    },
    [onClose, getFocusableElements]
  );

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        const focusable = getFocusableElements();
        if (focusable.length > 0) focusable[0].focus();
        else panelRef.current?.focus();
      });
    } else {
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, getFocusableElements]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  return createPortal(
    <div
      className={`ui-slideover-backdrop ${open ? 'ui-slideover-backdrop--open' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      aria-hidden={!open}
    >
      <div
        className={`ui-slideover ${SIZE_CLASSES[size] || SIZE_CLASSES.md} ${open ? 'ui-slideover--open' : ''}`}
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-slideover-title"
      >
        <div className="ui-slideover__header">
          <div className="ui-slideover__header-text">
            <h2 className="ui-slideover__title" id="ui-slideover-title">{title}</h2>
            {subtitle && <p className="ui-slideover__subtitle">{subtitle}</p>}
          </div>
          <button className="ui-slideover__close" onClick={onClose} aria-label="Close panel">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="ui-slideover__body">{children}</div>
        {footer && <div className="ui-slideover__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
