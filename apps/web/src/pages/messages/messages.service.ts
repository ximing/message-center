import { apiMessage, isUnauthorized } from "@/api/http";
import { getMessage, listMessages } from "@/api/messages";
import { listConnections } from "@/api/connections";
import { listRules } from "@/api/rules";
import type { Connection, MessageItem, Rule } from "@/api/types";
import { needsAttention } from "@/lib/delivery";
import { ManagementService } from "@/services/management.service";

function deliveryStamp(item: MessageItem | undefined): string {
  return (item?.deliveries ?? [])
    .map((delivery) =>
      [
        delivery.id,
        delivery.status,
        delivery.attempts,
        delivery.errorCode,
        delivery.skipReason,
        delivery.remoteId,
        delivery.connectionId,
      ].join(":"),
    )
    .join("|");
}

export class MessagesPageService extends ManagementService {
  items: MessageItem[] = [];
  connections: Connection[] = [];
  rules: Rule[] = [];
  contextError: string | null = null;
  openId: string | null = null;
  body: string | null = null;
  bodyError: string | null = null;
  detailSeq = 0;
  detailLoading = false;
  refreshing = false;
  search = "";
  source = "";
  kind = "";
  filter: "all" | "attention" | "unmatched" = "all";
  page = 1;
  pageSize = 10;
  get filtered(): MessageItem[] {
    const query = this.search.trim().toLowerCase();
    return this.items.filter(
      (m) =>
        (!this.source || m.ingress === this.source) &&
        (!this.kind || m.kind === this.kind) &&
        (!query ||
          `${m.sender ?? ""} ${m.room ?? ""}`.toLowerCase().includes(query)) &&
        (this.filter === "all" ||
          (this.filter === "attention" && needsAttention(m)) ||
          (this.filter === "unmatched" && !m.deliveries?.length)),
    );
  }
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }
  get visible(): MessageItem[] {
    return this.filtered.slice(
      (this.page - 1) * this.pageSize,
      this.page * this.pageSize,
    );
  }
  get selected(): MessageItem | undefined {
    return this.items.find((m) => m.id === this.openId);
  }
  get stats() {
    const deliveries = this.items.flatMap((m) => m.deliveries ?? []);
    return {
      wechat: this.items.filter((m) => m.ingress === "wechat").length,
      webhook: this.items.filter((m) => m.ingress === "webhook").length,
      delivered: deliveries.filter((d) => d.status === "delivered").length,
      attention: this.items.filter(needsAttention).length,
      failed: this.items.filter((m) =>
        m.deliveries?.some((d) => d.status === "failed"),
      ).length,
      retry: this.items.filter((m) =>
        m.deliveries?.some(
          (d) => d.status === "queued" && (d.attempts ?? 0) > 0,
        ),
      ).length,
      unmatched: this.items.filter((m) => !m.deliveries?.length).length,
    };
  }
  setSearch(value: string): void {
    this.search = value;
    this.filtersChanged();
  }
  setSource(value: string): void {
    this.source = value;
    this.filtersChanged();
  }
  setKind(value: string): void {
    this.kind = value;
    this.filtersChanged();
  }
  setFilter(value: typeof this.filter): void {
    this.filter = value;
    this.filtersChanged();
  }
  clearFilters(): void {
    this.search = "";
    this.source = "";
    this.kind = "";
    this.filter = "all";
    this.filtersChanged();
  }
  filtersChanged(): void {
    this.page = 1;
    this.reconcileSelection();
  }
  setPage(value: number): void {
    this.page = Math.min(this.totalPages, Math.max(1, value));
    this.reconcileSelection();
  }
  reconcileSelection(): void {
    if (this.page > this.totalPages) this.page = this.totalPages;
    if (this.visible.some((m) => m.id === this.openId)) return;
    const first = this.visible[0];
    if (first) void this.select(first.id);
    else {
      this.detailSeq++;
      this.openId = null;
      this.body = null;
      this.bodyError = null;
      this.detailLoading = false;
    }
  }
  /** Reload the list without the manual-refresh spinner. Returns false when a load is already running. */
  async refreshQuiet(): Promise<boolean> {
    if (this.loading || this.refreshing || this.detailLoading) return false;
    this.refreshing = true;
    try {
      const next = await listMessages();
      const open = this.openId;
      const before = deliveryStamp(this.items.find((item) => item.id === open));
      this.items = next;
      if (this.page > this.totalPages) this.page = this.totalPages;
      if (open && !next.some((item) => item.id === open)) {
        this.reconcileSelection();
        return true;
      }
      const after = deliveryStamp(next.find((item) => item.id === open));
      if (open && before !== after) await this.select(open, true);
      return true;
    } catch (err) {
      if (!isUnauthorized(err)) return false;
      return false;
    } finally {
      this.refreshing = false;
    }
  }
  async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.error = null;
    this.contextError = null;
    try {
      const [messages, connections, rules] = await Promise.allSettled([
        listMessages(),
        listConnections(),
        listRules(),
      ]);
      if (messages.status === "rejected") throw messages.reason;
      this.items = messages.value;
      if (connections.status === "fulfilled")
        this.connections = connections.value;
      if (rules.status === "fulfilled") this.rules = rules.value;
      if (connections.status === "rejected" || rules.status === "rejected")
        this.contextError = "连接或规则信息暂时不可用，投递状态仍正常展示。";
      this.loaded = true;
      this.page = Math.min(this.page, this.totalPages);
      const id =
        this.visible.find((m) => m.id === this.openId)?.id ||
        this.visible[0]?.id;
      if (id) void this.select(id, true);
      else this.reconcileSelection();
    } catch (err) {
      this.report(err);
    } finally {
      this.loading = false;
      this.loaded = true;
    }
  }
  async select(id: string, refresh = false): Promise<void> {
    if (
      this.openId === id &&
      !refresh &&
      (this.body !== null || this.detailLoading)
    )
      return;
    const seq = ++this.detailSeq;
    this.openId = id;
    this.body = null;
    this.bodyError = null;
    this.detailLoading = true;
    try {
      const detail = await getMessage(id);
      if (seq !== this.detailSeq || this.openId !== id) return;
      this.body = detail.body ?? "";
      this.items = this.items.map((item) =>
        item.id === id
          ? { ...item, deliveries: detail.deliveries ?? [] }
          : item,
      );
      this.reconcileSelection();
    } catch (err) {
      if (seq === this.detailSeq && this.openId === id && !isUnauthorized(err))
        this.bodyError = apiMessage(err);
    } finally {
      if (seq === this.detailSeq) this.detailLoading = false;
    }
  }
}
