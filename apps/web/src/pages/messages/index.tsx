import { Input, Select } from "@/components/controls";
import { bindServices, observer, useService } from "@rabjs/react";
import { useEffect, type KeyboardEvent } from "react";
import { Link } from "react-router";
import {
  ChannelIcon,
  EmptyState,
  ErrorNotice,
  Icon,
  Loading,
  PageHeader,
  Pill,
} from "@/components/ui";
import { deliveryState } from "@/lib/delivery";
import { formatTime, ingressText, kindText, providerText } from "@/lib/text";
import { MessagesPageService } from "./messages.service";

const MessageDetail = observer(function MessageDetail() {
  const s = useService(MessagesPageService);
  const m = s.selected;
  if (!m)
    return (
      <aside className="panel detail-panel">
        <EmptyState
          title="选择一条消息"
          description="查看正文与每个目的地的投递结果。"
        />
      </aside>
    );
  return (
    <aside
      className="panel detail-panel"
      aria-label="消息详情"
      aria-busy={s.detailLoading}
    >
      <div className="detail-top">
        <div className="between">
          <h2>消息详情</h2>
          <Pill dot={false}>{kindText(m.kind)}</Pill>
        </div>
        <div className="mono muted detail-id">{m.id}</div>
      </div>
      <div className="detail-section">
        <h3>上报信息</h3>
        <dl className="detail-meta">
          <dt>来源</dt>
          <dd className="row">
            <ChannelIcon provider={m.ingress || ""} small />
            {ingressText(m.ingress)}
          </dd>
          <dt>发送者</dt>
          <dd className="mono">{m.sender || "未提供"}</dd>
          <dt>房间</dt>
          <dd className="mono">{m.room || "无房间"}</dd>
          <dt>上报时间</dt>
          <dd>{formatTime(m.createdAt)}</dd>
        </dl>
        <h3 className="body-title">消息正文</h3>
        {s.detailLoading ? (
          <Loading text="正在读取正文…" />
        ) : s.bodyError ? (
          <ErrorNotice
            message={s.bodyError}
            retry={() => void s.select(m.id, true)}
          />
        ) : (
          <div className="body-preview">
            {s.body || (
              <span className="muted">
                {m.kind === "image" || m.kind === "voice"
                  ? `${kindText(m.kind)}消息仅记录类型，本期未接收文件。`
                  : "这条消息没有正文。"}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="detail-section">
        <div className="between delivery-section-title">
          <h3>投递轨迹</h3>
          <span className="muted">{m.deliveries?.length ?? 0} 个目的地</span>
        </div>
        {m.deliveries?.length ? (
          m.deliveries.map((d) => {
            const state = deliveryState(d),
              c = s.connections.find((c) => c.id === d.connectionId),
              rule = s.rules.find((r) => r.id === d.ruleId);
            return (
              <div key={d.id} className={`delivery ${state.state}`}>
                <div className="delivery-head">
                  <span className="row delivery-title">
                    <ChannelIcon
                      provider={d.provider || c?.provider || ""}
                      small
                    />
                    {c?.label || providerText(d.provider)}
                  </span>
                  <Pill tone={state.tone}>{state.label}</Pill>
                </div>
                <p>
                  规则：
                  {rule?.name || (d.ruleId ? "规则信息暂不可用" : "历史规则")}
                </p>
                {d.remoteId && <p className="mono">记录 ID：{d.remoteId}</p>}
                {(d.httpStatus || d.errorCode) && (
                  <p className="delivery-code mono">
                    {d.httpStatus && <span>HTTP {d.httpStatus}</span>}
                    {d.errorCode && <span>{d.errorCode}</span>}
                  </p>
                )}
                {d.status === "failed" && (
                  <>
                    <div className="error-note">
                      {d.httpStatus === 401 ||
                      d.errorCode === "CONNECTION_UNAUTHORIZED" ||
                      d.errorCode === "unauthorized"
                        ? "目的地令牌已失效，此连接已停止投递。"
                        : "本次投递失败。请检查错误码及目的地服务状态。"}
                    </div>
                    {c?.status === "unauthorized" && (
                      <Link
                        className="text-link"
                        to={`/connections?edit=${encodeURIComponent(c.id)}`}
                      >
                        更新连接令牌 <Icon name="arrow" />
                      </Link>
                    )}
                  </>
                )}
                {d.status === "queued" && (
                  <p>
                    {(d.attempts ?? 0) > 0
                      ? `已尝试 ${d.attempts} 次${d.nextAttemptAt ? `，下次重试：${formatTime(d.nextAttemptAt)}` : "，等待自动重试"}`
                      : "已进入转发队列，等待处理。"}
                  </p>
                )}
                {d.status === "skipped" && (
                  <>
                    <p>
                      {d.skipReason === "media_transport_pending"
                        ? "接收开关已开启，等待后续文件转存能力。"
                        : d.skipReason === "media_disabled"
                          ? `连接未开启接收${kindText(m.kind)}。`
                          : "本次投递已跳过。"}
                    </p>
                    {d.skipReason && <p className="mono">{d.skipReason}</p>}
                  </>
                )}
              </div>
            );
          })
        ) : (
          <>
            <div className="scope-preview">
              没有启用的规则匹配这条消息。
              <br />
              消息已保存，添加规则只影响后续新消息。
            </div>
            <Link
              className="text-link new-rule-link"
              to={`/rules?message=${encodeURIComponent(m.id)}`}
            >
              为此发送者创建规则 <Icon name="arrow" />
            </Link>
          </>
        )}
      </div>
      <div className="detail-bottom">
        <Icon name="lock" /> 投递详情不会展示目的地令牌
      </div>
    </aside>
  );
});

const MessagesContent = observer(function MessagesContent() {
  const s = useService(MessagesPageService);
  useEffect(() => {
    document.title = "消息记录 · 消息中心";
    void s.load();
  }, [s]);
  const stats = s.stats;
  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void s.select(id);
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const index = s.visible.findIndex((m) => m.id === id),
        next =
          s.visible[
            Math.max(
              0,
              Math.min(
                s.visible.length - 1,
                index + (e.key === "ArrowDown" ? 1 : -1),
              ),
            )
          ];
      if (next) {
        void s.select(next.id);
        document
          .querySelector<HTMLTableRowElement>(
            `[data-message-id="${CSS.escape(next.id)}"]`,
          )
          ?.focus();
      }
    }
  };
  return (
    <>
      <PageHeader
        title="消息记录"
        description="查看每一次上报，追踪消息的每一个去向。"
      >
        <button
          className="btn"
          disabled={s.loading}
          onClick={() => void s.load()}
        >
          <Icon name="refresh" className={s.loading ? "loading-refresh" : ""} />
          {s.loading ? "正在刷新…" : "刷新记录"}
        </button>
      </PageHeader>
      <ErrorNotice message={s.error} retry={() => void s.load()} />
      <ErrorNotice message={s.contextError} retry={() => void s.load()} />
      <div className="panel flow-strip">
        <div>
          <div className="flow-label">上报来源</div>
          <div className="channel-line">
            <span className="row">
              <ChannelIcon provider="wechat" small />
              微信
            </span>
            <span className="row">
              <ChannelIcon provider="webhook" small />
              Webhook
            </span>
          </div>
        </div>
        <div className="flow-connector">
          <Icon name="chevron" />
        </div>
        <Link to="/rules" className="flow-hub">
          <Icon name="route" />
          <span>
            {s.contextError
              ? "查看转发规则"
              : `${s.rules.filter((r) => r.enabled !== false).length} 条规则已启用`}
          </span>
        </Link>
        <div className="flow-connector">
          <Icon name="chevron" />
        </div>
        <div>
          <div className="flow-label">支持的转发目的地</div>
          <div className="channel-line">
            {["vital", "inwit", "aimo"].map((p) => (
              <span className="row" key={p}>
                <ChannelIcon provider={p} small />
                {providerText(p)}
              </span>
            ))}
          </div>
        </div>
        <div className="flow-end">
          <Link to="/connections">
            <Pill
              tone={
                s.connections.some((c) => c.status === "unauthorized")
                  ? "amber"
                  : ""
              }
            >
              {s.contextError
                ? "查看连接"
                : `${s.connections.length} 个目的地连接`}
            </Pill>
          </Link>
        </div>
      </div>
      <div className="panel stats">
        <div className="stat">
          <div className="stat-label">
            <Icon name="inbox" />
            最近上报
          </div>
          <div className="stat-value">
            {s.loaded ? s.items.length : "—"}
            <small>条消息</small>
          </div>
          <div className="stat-note">
            微信 {stats.wechat} 条 · Webhook {stats.webhook} 条
          </div>
        </div>
        <div className="stat success">
          <div className="stat-label">
            <Icon name="check" />
            已送达
          </div>
          <div className="stat-value">
            {s.loaded ? stats.delivered : "—"}
            <small>次投递</small>
          </div>
          <div className="stat-note">每个目的地分别计数</div>
        </div>
        <div className="stat warning">
          <div className="stat-label">
            <Icon name="alert" />
            需要关注
          </div>
          <div className="stat-value">
            {s.loaded ? stats.attention : "—"}
            <small>条消息</small>
          </div>
          <div className="stat-note">
            失败 {stats.failed} 条 · 重试 {stats.retry} 条
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">
            <Icon name="route" />
            未匹配
          </div>
          <div className="stat-value">
            {s.loaded ? stats.unmatched : "—"}
            <small>条消息</small>
          </div>
          <div className="stat-note">添加规则后作用于新消息</div>
        </div>
      </div>
      <div className="stat-caption">
        统计与筛选范围：最近 200 条上报记录。失败和重试的消息可能重叠。
      </div>
      <div className="message-workbench">
        <section className="panel">
          <div className="list-head">
            <div className="between">
              <h2>收件记录</h2>
              <span className="muted">最新在前</span>
            </div>
            <div className="tabs" aria-label="消息分类">
              {(
                [
                  ["all", "全部消息", s.items.length],
                  ["attention", "需要关注", stats.attention],
                  ["unmatched", "未匹配", stats.unmatched],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  className={`tab ${s.filter === key ? "active" : ""}`}
                  aria-pressed={s.filter === key}
                  onClick={() => s.setFilter(key)}
                >
                  {label}
                  <span className="num">{count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="filterbar">
            <label className="search">
              <Input
                leadingIcon="search"
                aria-label="搜索发送者或房间"
                placeholder="搜索发送者、房间…"
                value={s.search}
                onChange={(e) => s.setSearch(e.target.value)}
              />
            </label>
            <Select
              aria-label="上报渠道"
              value={s.source}
              onValueChange={(value) => s.setSource(value)}
              options={[
                { value: "", label: "全部来源" },
                { value: "wechat", label: "微信" },
                { value: "webhook", label: "Webhook" },
              ]}
            />
            <Select
              aria-label="消息类型"
              value={s.kind}
              onValueChange={(value) => s.setKind(value)}
              options={[
                { value: "", label: "全部类型" },
                ...["text", "link", "image", "voice"].map((k) => ({
                  value: k,
                  label: kindText(k),
                })),
              ]}
            />
          </div>
          {!s.loaded ? (
            <Loading />
          ) : s.visible.length === 0 ? (
            <EmptyState
              title={
                s.items.length ? "没有找到符合条件的消息" : "还没有收到消息"
              }
              description={
                s.items.length
                  ? "试试其他发送者，或清除筛选条件。"
                  : "创建接入密钥，配置微信模块或 Webhook 后，消息会出现在这里。"
              }
            >
              {s.items.length ? (
                <button className="btn small" onClick={() => s.clearFilters()}>
                  清除筛选
                </button>
              ) : (
                <Link className="btn primary" to="/keys">
                  配置消息接入
                </Link>
              )}
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="messages">
                <thead>
                  <tr>
                    <th>来源 / 发送者</th>
                    <th>类型</th>
                    <th>投递结果</th>
                    <th>上报时间</th>
                  </tr>
                </thead>
                <tbody>
                  {s.visible.map((m) => (
                    <tr
                      key={m.id}
                      data-message-id={m.id}
                      className={`message-row ${m.id === s.openId ? "selected" : ""}`}
                      tabIndex={0}
                      aria-label={`查看 ${m.sender || "未提供发送者"} ${formatTime(m.createdAt)} 的${kindText(m.kind)}消息`}
                      onClick={() => void s.select(m.id)}
                      onKeyDown={(e) => onRowKey(e, m.id)}
                    >
                      <td>
                        <div className="row">
                          <ChannelIcon provider={m.ingress || ""} small />
                          <div>
                            <div className="sender" title={m.sender || ""}>
                              {m.sender || "未提供发送者"}
                            </div>
                            <div className="subline" title={m.room || ""}>
                              {m.room ||
                                `${ingressText(m.ingress)} · ${m.ingress === "wechat" ? "单聊" : "外部上报"}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="muted">{kindText(m.kind)}</span>
                      </td>
                      <td>
                        <div className="delivery-chips">
                          {m.deliveries?.length ? (
                            m.deliveries.map((d) => {
                              const state = deliveryState(d);
                              return (
                                <span
                                  key={d.id}
                                  className={`pill ${state.tone}`}
                                  title={`${s.connections.find((c) => c.id === d.connectionId)?.label || providerText(d.provider)}：${state.label}`}
                                >
                                  {providerText(d.provider)}
                                  {d.status !== "delivered" &&
                                    ` · ${state.label}`}
                                </span>
                              );
                            })
                          ) : (
                            <Pill dot={false}>未匹配</Pill>
                          )}
                        </div>
                      </td>
                      <td className="time">{formatTime(m.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="table-footer">
            <span>共 {s.filtered.length} 条记录</span>
            <div className="pagination">
              <button
                className="icon-btn prev"
                aria-label="上一页"
                disabled={s.page <= 1}
                onClick={() => s.setPage(s.page - 1)}
              >
                <Icon name="chevron" />
              </button>
              <span>
                {s.page} / {s.totalPages} 页
              </span>
              <button
                className="icon-btn"
                aria-label="下一页"
                disabled={s.page >= s.totalPages}
                onClick={() => s.setPage(s.page + 1)}
              >
                <Icon name="chevron" />
              </button>
            </div>
          </div>
        </section>
        <MessageDetail />
      </div>
      <div className="footer-note">
        <Icon name="shield" />
        消息按账号隔离保存。投递结果按目的地独立记录，正文仅在打开详情时读取。
      </div>
    </>
  );
});
export default bindServices(MessagesContent, [MessagesPageService]);
