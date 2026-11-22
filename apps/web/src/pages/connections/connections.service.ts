import {
  createConnection,
  deleteConnection,
  listConnections,
  patchConnection,
} from "@/api/connections";
import { listRules } from "@/api/rules";
import type { Connection, Provider, Rule } from "@/api/types";
import { defaultApiBase, isProvider } from "@/lib/text";
import { isUnauthorized } from "@/api/http";
import { ManagementService } from "@/services/management.service";

interface ConnectionForm {
  provider: Provider;
  label: string;
  apiBase: string;
  token: string;
  allowImage: boolean;
  allowVoice: boolean;
}
const emptyForm = (): ConnectionForm => ({
  provider: "vital",
  label: "",
  apiBase: defaultApiBase("vital"),
  token: "",
  allowImage: false,
  allowVoice: false,
});
export class ConnectionsPageService extends ManagementService {
  items: Connection[] = [];
  rules: Rule[] = [];
  editorOpen = false;
  editingId: string | null = null;
  form = emptyForm();
  removeTarget: Connection | null = null;
  flagsBusy = false;
  refreshing = false;
  get unavailable(): Connection[] {
    return this.items.filter((item) => item.status === "unauthorized");
  }
  changeForm(patch: Partial<ConnectionForm>): void {
    this.form = { ...this.form, ...patch };
  }
  changeProvider(value: string): void {
    if (isProvider(value))
      this.form = {
        ...this.form,
        provider: value,
        apiBase: defaultApiBase(value),
        token: "",
      };
  }
  edit(item?: Connection): void {
    this.editingId = item?.id ?? null;
    this.formError = null;
    this.form = item
      ? {
          provider: isProvider(item.provider) ? item.provider : "vital",
          label: item.label,
          apiBase: item.apiBase || defaultApiBase(item.provider),
          token: "",
          allowImage: !!item.allowImage,
          allowVoice: !!item.allowVoice,
        }
      : emptyForm();
    this.editorOpen = true;
  }
  closeEditor(): void {
    if (!this.saving) {
      this.editorOpen = false;
      this.form = emptyForm();
    }
  }
  confirmRemove(item: Connection | null): void {
    if (!this.saving) {
      this.removeTarget = item;
      this.confirmError = null;
    }
  }
  async refreshQuiet(): Promise<boolean> {
    if (
      this.loading ||
      this.refreshing ||
      this.saving ||
      this.flagsBusy ||
      this.editorOpen ||
      this.removeTarget
    ) {
      return false;
    }
    this.refreshing = true;
    try {
      const [items, rules] = await Promise.all([
        listConnections(),
        listRules(),
      ]);
      this.items = items;
      this.rules = rules;
      return true;
    } catch (err) {
      if (!isUnauthorized(err)) return false;
      return false;
    } finally {
      this.refreshing = false;
    }
  }
  async load(editId?: string | null): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.error = null;
    try {
      const [items, rules] = await Promise.all([
        listConnections(),
        listRules(),
      ]);
      this.items = items;
      this.rules = rules;
      const item = editId
        ? items.find((item) => item.id === editId)
        : undefined;
      if (item) this.edit(item);
    } catch (err) {
      this.report(err);
    } finally {
      this.loaded = true;
      this.loading = false;
    }
  }
  async save(): Promise<void> {
    if (this.saving || this.flagsBusy) return;
    this.formError = null;
    const label = this.form.label.trim(),
      token = this.form.token.trim();
    if (!label) {
      this.formError = "请填写连接名称";
      return;
    }
    if (!this.editingId && !token) {
      this.formError = "请填写目的地访问令牌";
      return;
    }
    let origin: string;
    try {
      const url = new URL(this.form.apiBase.trim());
      if (
        url.protocol !== "https:" ||
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        url.username ||
        url.password
      )
        throw new Error();
      origin = url.origin;
    } catch {
      this.formError = "请输入不含路径、参数或账号信息的 HTTPS 服务地址";
      return;
    }
    const prefix = { vital: "vt_", inwit: "iwt_", aimo: "aimo_tk_" }[
      this.form.provider
    ];
    if (token && !token.startsWith(prefix)) {
      this.formError = `这个渠道的令牌必须以 ${prefix} 开头`;
      return;
    }
    this.saving = true;
    try {
      const common = {
        label,
        allowImage: this.form.allowImage,
        allowVoice: this.form.allowVoice,
      };
      const item = this.editingId
        ? await patchConnection(this.editingId, {
            ...common,
            ...(token ? { token } : {}),
          })
        : await createConnection({
            ...common,
            provider: this.form.provider,
            apiBase: origin,
            token,
          });
      this.items = this.editingId
        ? this.items.map((c) => (c.id === item.id ? item : c))
        : [item, ...this.items];
      this.editorOpen = false;
      this.form = emptyForm();
      this.ui.notify(token ? "令牌验证通过，连接已保存" : "连接设置已保存");
    } catch (err) {
      this.report(err, "formError");
    } finally {
      this.saving = false;
    }
  }
  async updateMedia(
    id: string,
    field: "allowImage" | "allowVoice",
    value: boolean,
  ): Promise<void> {
    if (this.flagsBusy || this.saving) return;
    this.flagsBusy = true;
    this.error = null;
    try {
      const item = await patchConnection(id, { [field]: value });
      this.items = this.items.map((c) => (c.id === id ? item : c));
      this.ui.notify(
        value
          ? "已开启接收；本期仅记录为等待转存"
          : "已关闭接收；新消息的该类投递将跳过",
      );
    } catch (err) {
      this.report(err);
    } finally {
      this.flagsBusy = false;
    }
  }
  async remove(): Promise<void> {
    if (this.saving || !this.removeTarget) return;
    const id = this.removeTarget.id;
    this.saving = true;
    this.confirmError = null;
    try {
      await deleteConnection(id);
      this.items = this.items.filter((c) => c.id !== id);
      this.removeTarget = null;
      this.editorOpen = false;
      this.form = emptyForm();
      this.ui.notify("连接已删除");
    } catch (err) {
      this.report(err, "confirmError");
    } finally {
      this.saving = false;
    }
  }
}
