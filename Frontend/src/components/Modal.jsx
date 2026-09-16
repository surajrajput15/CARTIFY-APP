import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal = ({ title, labelledBy, onClose, blockClose = false, children, className = '' }) => {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Held in refs so the mount effect below runs once — inline arrow `onClose`
  // props from parents would otherwise tear down and re-run the effect (and
  // re-lock scroll / yank focus) on every parent re-render.
  const onCloseRef = useRef(onClose);
  const blockCloseRef = useRef(Boolean(blockClose));

  useEffect(() => {
    onCloseRef.current = onClose;
    blockCloseRef.current = Boolean(blockClose);
  });

  useEffect(() => {
    previousFocusRef.current = document.activeElement;

    // Lock body scroll while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    if (dialog) {
      const focusables = dialog.querySelectorAll(FOCUSABLE);
      (focusables[0] || dialog).focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!blockCloseRef.current) onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;

      const focusables = Array.from(dialog.querySelectorAll(FOCUSABLE));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={() => {
        if (!blockCloseRef.current) onCloseRef.current();
      }}
      role="presentation"
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        className={`bg-white rounded-2xl shadow-2xl w-full my-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;