import {
  createKey,
  listKeys,
  patchKey,
  revealKey,
  revokeKey,
} from "@/api/keys";
import type { ApiKey } from "@/api/types";
import { ManagementService } from "@/services/management.service";

export class KeysPageService extends ManagementService {
  items: ApiKey[] = [];
  editorOpen = false;
  editingId: string | null = null;
  form = { name: "", note: "" };
  tokenOpen = false;
  tokenName = "";
  token: string | null = null;
  tokenError: string | null = null;
  revealing = false;
  revealSeq = 0;
  copied = false;
  revokeTarget: ApiKey | null = null;

  changeForm(patch: Partial<typeof this.form>): void {
    this.form = { ...this.form, ...patch };
  }
  edit(item?: ApiKey): void {
    this.editingId = item?.id ?? null;
    this.form = { name: item?.name ?? "", note: item?.note ?? "" };
    this.formError = null;
    this.editorOpen = true;
  }
  closeEditor(): void {
    if (!this.saving) {
      this.editorOpen = false;
      this.form = { name: "", note: "" };
    }
  }
  closeToken(): void {
    this.tokenOpen = false;
    this.token = null;
    this.copied = false;
    this.revealSeq++;
    this.revealing = false;
  }
  confirmRevoke(item: ApiKey | null): void {
    if (!this.saving) {
      this.revokeTarget = item;
      this.confirmError = null;
    }
  }

  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.error = null;
    try {
      this.items = await listKeys();
    } catch (err) {
      this.report(err);
    } finally {
      this.loaded = true;
      this.loading = false;
    }
  }
  async save(): Promise<void> {
    if (this.saving) return;
    this.formError = null;
    const input = { name: this.form.name.trim(), note: this.form.note.trim() };
    if (!input.name) {
      this.formError = "请填写密钥名称";
      return;
    }
    if (!this.editingId && this.items.length >= 20) {
      this.formError = "有效密钥已达 20 把，请先吊销不再使用的密钥";
      return;
    }
    this.saving = true;
    try {
      if (this.editingId) {
        const updated = await patchKey(this.editingId, input);
        this.items = this.items.map((item) =>
          item.id === updated.id ? updated : item,
        );
        this.ui.notify("密钥信息已保存");
      } else {
        const created = await createKey(input);
        const { token, ...item } = created;
        this.items = [item, ...this.items];
        this.token = token;
        this.tokenName = created.name;
        this.tokenError = null;
        this.copied = false;
        this.tokenOpen = true;
      }
      this.editorOpen = false;
      this.form = { name: "", note: "" };
    } catch (err) {
      this.report(err, "formError");
    } finally {
      this.saving = false;
    }
  }
  async reveal(item: ApiKey): Promise<void> {
    const seq = ++this.revealSeq;
    this.tokenName = item.name;
    this.tokenOpen = true;
    this.token = null;
    this.tokenError = null;
    this.copied = false;
    this.revealing = true;
    try {
      const result = await revealKey(item.id);
      if (seq === this.revealSeq && this.tokenOpen) this.token = result.token;
    } catch (err) {
      if (seq === this.revealSeq) {
        this.report(err, "formError");
        this.tokenError = this.formError;
      }
    } finally {
      if (seq === this.revealSeq) this.revealing = false;
    }
  }
  async revoke(): Promise<void> {
    if (this.saving || !this.revokeTarget) return;
    const id = this.revokeTarget.id;
    this.saving = true;
    this.confirmError = null;
    try {
      await revokeKey(id);
      this.items = this.items.filter((item) => item.id !== id);
      this.revokeTarget = null;
      this.ui.notify("密钥已吊销");
    } catch (err) {
      this.report(err, "confirmError");
    } finally {
      this.saving = false;
    }
  }
  async copyToken(): Promise<void> {
    if (!this.token) return;
    const token = this.token;
    try {
      await navigator.clipboard.writeText(token);
      if (this.token === token) this.copied = true;
    } catch {
      this.tokenError = "浏览器不允许自动复制，请手动选择完整密钥复制。";
    }
  }
}
