import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="modal__header">
        <h2 id={titleId} className="modal__title">{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Close dialog"
          title="Close dialog"
          onClick={onClose}
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>
      <div className="modal__body">{children}</div>
      {footer && <div className="modal__footer">{footer}</div>}
    </dialog>
  );
}
