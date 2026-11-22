import { observer, useService } from "@rabjs/react";
import { useEffect } from "react";
import { UiService } from "@/services/ui.service";
import { Icon } from "../icon";

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
