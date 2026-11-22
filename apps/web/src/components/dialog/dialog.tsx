import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button, IconButton } from "../button";
import { Icon } from "../icon";
import { ErrorNotice } from "../notice";

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  compact = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={compact ? "confirm" : "drawer"}
      aria-labelledby={id}
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget || busy) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id={id}>{title}</h2>
        <IconButton label="关闭" disabled={busy} onClick={onClose}>
          <Icon name="close" />
        </IconButton>
      </div>
      {open && (
        <>
          <div className="dialog-body">{children}</div>
          {footer && <div className="dialog-foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  onClose,
  onConfirm,
  busy,
  error,
  action = "确认删除",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  error: string | null;
  action?: string;
}) {
  return (
    <Dialog
      compact
      open={open}
      title={title}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {busy ? "正在处理…" : action}
          </Button>
        </>
      }
    >
      <p className="muted">{children}</p>
      <ErrorNotice message={error} />
    </Dialog>
  );
}
