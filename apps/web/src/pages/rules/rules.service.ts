import { listConnections } from "@/api/connections";
import { listMessages } from "@/api/messages";
import { createRule, deleteRule, listRules, patchRule } from "@/api/rules";
import type { Connection, MessageItem, Rule, RuleInput } from "@/api/types";
import { matchesAll } from "@/lib/text";
import { previewRules, type MatchInput } from "@/lib/rule-preview";
import { ManagementService } from "@/services/management.service";

const emptyForm = (): RuleInput => ({
  name: "",
  enabled: true,
  exclusive: false,
  matchIngress: null,
  matchRoom: "",
  matchSender: "",
  connectionId: "",
});
export class RulesPageService extends ManagementService {
  rules: Rule[] = [];
  connections: Connection[] = [];
  search = "";
  filter: "all" | "exclusive" | "disabled" = "all";
  editorOpen = false;
  editingId: string | null = null;
  form = emptyForm();
  removeTarget: Rule | null = null;
  toggling = false;
  simulatorOpen = false;
  samplesLoading = false;
  samplesError: string | null = null;
  samples: MessageItem[] = [];
  sampleId = "";
  match: MatchInput = { ingress: "wechat", sender: "", room: "", kind: "text" };
  get visibleRules(): Rule[] {
    const query = this.search.trim().toLowerCase();
    return this.rules.filter(
      (r) =>
        (this.filter === "all" ||
          (this.filter === "exclusive" && r.exclusive) ||
          (this.filter === "disabled" && r.enabled === false)) &&
        (!query ||
          `${r.name} ${r.matchSender ?? ""} ${r.matchRoom ?? ""}`
            .toLowerCase()
            .includes(query)),
    );
  }
  get broadScope(): boolean {
    return matchesAll(this.form.matchRoom, this.form.matchSender);
  }
  get preview() {
    return previewRules(this.rules, this.match);
  }
  setSearch(value: string): void {
    this.search = value;
  }
  setFilter(value: typeof this.filter): void {
    this.filter = value;
  }
  changeForm(patch: Partial<RuleInput>): void {
    this.form = { ...this.form, ...patch };
  }
  changeMatch(patch: Partial<MatchInput>): void {
    this.sampleId = "";
    this.match = { ...this.match, ...patch };
  }
  edit(rule?: Rule, message?: MessageItem): void {
    this.editingId = rule?.id ?? null;
    this.form = rule
      ? {
          name: rule.name,
          enabled: rule.enabled !== false,
          exclusive: !!rule.exclusive,
          matchIngress:
            rule.matchIngress === "wechat" || rule.matchIngress === "webhook"
              ? rule.matchIngress
              : null,
          matchRoom: rule.matchRoom ?? "",
          matchSender: rule.matchSender ?? "",
          connectionId: rule.connectionId,
        }
      : {
          ...emptyForm(),
          connectionId:
            this.connections.find((c) => c.status === "active")?.id ??
            this.connections[0]?.id ??
            "",
          matchIngress:
            message?.ingress === "wechat" || message?.ingress === "webhook"
              ? message.ingress
              : null,
          matchSender: message?.sender ?? "",
        };
    this.formError = null;
    this.editorOpen = true;
  }
  closeEditor(): void {
    if (!this.saving) {
      this.editorOpen = false;
      this.form = emptyForm();
    }
  }
  confirmRemove(rule: Rule | null): void {
    if (!this.saving) {
      this.removeTarget = rule;
      this.confirmError = null;
    }
  }
  async load(messageId?: string | null): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.error = null;
    try {
      const [rules, connections] = await Promise.all([
        listRules(),
        listConnections(),
      ]);
      this.rules = rules;
      this.connections = connections;
      if (messageId) {
        const messages = await listMessages();
        const message = messages.find((m) => m.id === messageId);
        if (message) this.edit(undefined, message);
        else this.error = "这条消息不在最近 200 条记录中，请手动填写匹配条件。";
      }
    } catch (err) {
      this.report(err);
    } finally {
      this.loaded = true;
      this.loading = false;
    }
  }
  async save(): Promise<void> {
    if (this.saving || this.toggling) return;
    this.formError = null;
    const input: RuleInput = {
      ...this.form,
      name: this.form.name.trim(),
      matchRoom: this.form.matchRoom?.trim() || null,
      matchSender: this.form.matchSender?.trim() || null,
    };
    if (!input.name) {
      this.formError = "请填写规则名称";
      return;
    }
    if (!input.connectionId) {
      this.formError = "请先添加目的地连接，再保存规则";
      return;
    }
    this.saving = true;
    try {
      const rule = this.editingId
        ? await patchRule(this.editingId, input)
        : await createRule(input);
      this.rules = this.editingId
        ? this.rules.map((r) => (r.id === rule.id ? rule : r))
        : [...this.rules, rule];
      this.editorOpen = false;
      this.form = emptyForm();
      this.ui.notify("规则已保存，仅影响后续新消息");
    } catch (err) {
      this.report(err, "formError");
    } finally {
      this.saving = false;
    }
  }
  async toggle(rule: Rule, value: boolean): Promise<void> {
    if (this.toggling || this.saving) return;
    this.toggling = true;
    this.error = null;
    try {
      const updated = await patchRule(rule.id, { enabled: value });
      this.rules = this.rules.map((r) => (r.id === rule.id ? updated : r));
      this.ui.notify(value ? "规则已启用" : "规则已停用");
    } catch (err) {
      this.report(err);
    } finally {
      this.toggling = false;
    }
  }
  async remove(): Promise<void> {
    if (this.saving || !this.removeTarget) return;
    const id = this.removeTarget.id;
    this.saving = true;
    this.confirmError = null;
    try {
      await deleteRule(id);
      this.rules = this.rules.filter((r) => r.id !== id);
      this.removeTarget = null;
      this.editorOpen = false;
      this.ui.notify("规则已删除");
    } catch (err) {
      this.report(err, "confirmError");
    } finally {
      this.saving = false;
    }
  }
  async openSimulator(): Promise<void> {
    this.simulatorOpen = true;
    if (this.samplesLoading) return;
    this.samplesError = null;
    this.samplesLoading = true;
    try {
      this.samples = await listMessages();
    } catch {
      this.samplesError = "无法读取最近消息，你仍可以手动填写条件进行模拟。";
    } finally {
      this.samplesLoading = false;
    }
  }
  closeSimulator(): void {
    this.simulatorOpen = false;
  }
  chooseSample(id: string): void {
    this.sampleId = id;
    const m = this.samples.find((m) => m.id === id);
    if (m)
      this.match = {
        ingress: m.ingress || "wechat",
        room: m.room || "",
        sender: m.sender || "",
        kind: m.kind || "text",
      };
  }
}
