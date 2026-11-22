import {
  createToken,
  listTokens,
  renameToken,
  revealToken,
  revokeToken,
} from "@/api/tokens";
import type { AccessToken } from "@/api/types";
import { ManagementService } from "@/services/management.service";

export class TokensPageService extends ManagementService {
  items: AccessToken[] = [];
  editorOpen = false;
  editingId: string | null = null;
  form = { name: "" };
  tokenOpen = false;
  tokenName = "";
  token: string | null = null;
  tokenError: string | null = null;
  revealing = false;
  revealSeq = 0;
  copied = false;
  revokeTarget: AccessToken | null = null;

  changeForm(patch: Partial<typeof this.form>): void {
    this.form = { ...this.form, ...patch };
  }
  edit(item?: AccessToken): void {
    this.editingId = item?.id ?? null;
    this.form = { name: item?.name ?? "" };
    this.formError = null;
    this.editorOpen = true;
  }
  closeEditor(): void {
    if (!this.saving) {
      this.editorOpen = false;
      this.form = { name: "" };
    }
  }
  closeToken(): void {
    this.tokenOpen = false;
    this.token = null;
    this.copied = false;
    this.revealSeq++;
    this.revealing = false;
  }
  confirmRevoke(item: AccessToken | null): void {
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
      this.items = await listTokens();
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
    const name = this.form.name.trim();
    if (!name) {
      this.formError = "请填写令牌名称";
      return;
    }
    if (!this.editingId && this.items.length >= 20) {
      this.formError = "有效接口令牌已达 20 个，请先吊销不再使用的令牌";
      return;
    }
    this.saving = true;
    try {
      if (this.editingId) {
        const updated = await renameToken(this.editingId, name);
        this.items = this.items.map((item) =>
          item.id === updated.id ? updated : item,
        );
        this.ui.notify("令牌名称已保存");
      } else {
        const created = await createToken({ name });
        const { token, ...item } = created;
        this.items = [item, ...this.items];
        this.token = token;
        this.tokenName = created.name;
        this.tokenError = null;
        this.copied = false;
        this.tokenOpen = true;
      }
      this.editorOpen = false;
      this.form = { name: "" };
    } catch (err) {
      this.report(err, "formError");
    } finally {
      this.saving = false;
    }
  }
  async reveal(item: AccessToken): Promise<void> {
    const seq = ++this.revealSeq;
    this.tokenName = item.name;
    this.tokenOpen = true;
    this.token = null;
    this.tokenError = null;
    this.copied = false;
    this.revealing = true;
    try {
      const result = await revealToken(item.id);
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
      await revokeToken(id);
      this.items = this.items.filter((item) => item.id !== id);
      this.revokeTarget = null;
      this.ui.notify("接口令牌已吊销");
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
      this.tokenError = "浏览器不允许自动复制，请手动选择完整令牌复制。";
    }
  }
}
