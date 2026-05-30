import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Delete',
  confirmVariant = 'danger',
  loading,
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && open && !loading) {
        onCancel && onCancel();
      }
    },
    [open, loading, onCancel]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onCancel && onCancel();
    }
  };

  return createPortal(
    <div
      className="ui-confirm-dialog__overlay"
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        className="ui-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ui-confirm-dialog-title"
        aria-describedby={message ? 'ui-confirm-dialog-message' : undefined}
      >
        {title && (
          <h2 id="ui-confirm-dialog-title" className="ui-confirm-dialog__title">
            {title}
          </h2>
        )}
        {message && (
          <p id="ui-confirm-dialog-message" className="ui-confirm-dialog__message">
            {message}
          </p>
        )}
        <div className="ui-confirm-dialog__actions">
          <button
            type="button"
            className="ui-confirm-dialog__btn ui-confirm-dialog__btn--cancel"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`ui-confirm-dialog__btn ui-confirm-dialog__btn--${confirmVariant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="ui-confirm-dialog__spinner" aria-label="Loading" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
