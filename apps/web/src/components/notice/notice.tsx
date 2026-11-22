import { Icon } from "../icon";

export function Notice({
  children,
  tone = "",
}: {
  children: React.ReactNode;
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
        <button className="text-link" type="button" onClick={retry}>
          重新加载
        </button>
      )}
    </div>
  );
}
