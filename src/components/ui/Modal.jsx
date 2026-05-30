import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const SIZE_CLASSES = {
  sm: 'ui-modal--sm',
  md: 'ui-modal--md',
  lg: 'ui-modal--lg',
  xl: 'ui-modal--xl',
  full: 'ui-modal--full',
};

export default function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
  footer,
}) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll(
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
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
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
        else dialogRef.current?.focus();
      });
    } else {
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, getFocusableElements]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return createPortal(
    <div className="ui-modal-backdrop" onClick={handleBackdropClick} aria-modal="true" role="dialog" aria-labelledby="ui-modal-title">
      <div
        className={`ui-modal ${SIZE_CLASSES[size] || SIZE_CLASSES.md}`}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="ui-modal__header">
          <h2 className="ui-modal__title" id="ui-modal-title">{title}</h2>
          <button className="ui-modal__close" onClick={onClose} aria-label="Close modal">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer && <div className="ui-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
