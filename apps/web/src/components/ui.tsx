import { useEffect, useId, useRef, type ReactNode } from "react";
import { observer, useService } from "@rabjs/react";
import { UiService } from "@/services/ui.service";
import { Icon, type IconName } from "./icon";

export { Icon } from "./icon";
export function ChannelIcon({
  provider,
  small = false,
}: {
  provider: string;
  small?: boolean;
}) {
  const known = ["wechat", "webhook", "vital", "inwit", "aimo"].includes(
    provider,
  );
  return (
    <span
      className={`provider ${known ? provider : ""} ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      {provider === "wechat" || provider === "webhook" ? (
        <Icon name={provider} />
      ) : (
        ({ vital: "v", inwit: "i", aimo: "a" }[provider] ?? "·")
      )}
    </span>
  );
}
export function Pill({
  children,
  tone = "",
  dot = true,
}: {
  children: ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={`pill ${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-tools">{children}</div>
    </div>
  );
}
export function Notice({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div className={`notice ${tone}`}>
      <Icon name={tone === "amber" ? "alert" : "info"} />
      <div>{children}</div>
    </div>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string | null;
  retry?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="error-notice" role="alert">
      <Icon name="alert" />
      <span className="grow">{message}</span>
      {retry && (
        <button className="text-link" onClick={retry}>
          重新加载
        </button>
      )}
    </div>
  );
}
export function Loading({ text = "正在加载…" }: { text?: string }) {
  return (
    <div className="empty" role="status">
      <span className="spinner" />
      <p>{text}</p>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  icon = "inbox",
  children,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
export { Input, Textarea, Select, Checkbox, Switch } from "./controls";
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
        <button
          type="button"
          className="icon-btn"
          aria-label="关闭"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
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
          <button className="btn" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button className="btn danger" disabled={busy} onClick={onConfirm}>
            {busy ? "正在处理…" : action}
          </button>
        </>
      }
    >
      <p className="muted">{children}</p>
      <ErrorNotice message={error} />
    </Dialog>
  );
}
export const Notifications = observer(function Notifications() {
  const ui = useService(UiService);
  useEffect(() => {
    if (!ui.message) return;
    const timer = window.setTimeout(() => ui.dismiss(), 4500);
    return () => window.clearTimeout(timer);
  }, [ui, ui.message]);
  return (
    <div role="status" aria-live="polite">
      {ui.message && (
        <div className="toast">
          <Icon name="check" />
          <span>{ui.message}</span>
          <button aria-label="关闭提示" onClick={() => ui.dismiss()}>
            <Icon name="close" />
          </button>
        </div>
      )}
    </div>
  );
});
export const Guide = observer(function Guide() {
  const ui = useService(UiService);
  return (
    <Dialog
      open={ui.guideOpen}
      title="接入指南"
      onClose={() => ui.closeGuide()}
      footer={
        <button className="btn primary" onClick={() => ui.closeGuide()}>
          知道了
        </button>
      }
    >
      <div className="stack guide-content">
        <section>
          <h3>1. 创建账号密钥</h3>
          <p>在接入密钥页面生成 mck_ 密钥。同一把密钥可用于微信与 Webhook。</p>
        </section>
        <section>
          <h3>2. 配置消息上报</h3>
          <p>微信模块的打包配置：</p>
          <pre className="body-preview mono">{`MESSAGE_CENTER_URL=https://你的消息中心域名\nMESSAGE_CENTER_APP_KEY=mck_...`}</pre>
          <p>Webhook 请求示例：</p>
          <pre className="body-preview mono">{`POST /api/v1/ingest/webhook\nAuthorization: Bearer mck_...\nContent-Type: application/json\n\n{\n  "eventId": "unique-event-001",\n  "kind": "text",\n  "sender": "browser-clipper",\n  "text": "一条值得保存的消息"\n}`}</pre>
          <p>eventId 在当前账号下必须唯一，重复上报不会新增投递。</p>
        </section>
        <section>
          <h3>3. 添加目的地与规则</h3>
          <p>
            先验证目的地连接，再配置匹配条件。没有命中规则的消息会保留为「未匹配」，新规则仅作用于后续消息。
          </p>
        </section>
      </div>
    </Dialog>
  );
});
