import { observer, useService } from "@rabjs/react";
import { Link } from "react-router";
import {
  ChannelIcon,
  EmptyState,
  ErrorNotice,
  Icon,
  Loading,
  Panel,
  Pill,
  textLinkClass,
} from "@/components";
import { deliveryState } from "@/lib/delivery";
import { formatTime, ingressText, kindText, providerText } from "@/lib/text";
import { MessagesPageService } from "./messages.service";

export const MessageDetail = observer(function MessageDetail() {
  const s = useService(MessagesPageService);
  const m = s.selected;
  if (!m)
    return (
      <Panel as="aside" className="detail-panel">
        <EmptyState
          title="选择一条消息"
          description="查看正文与每个目的地的投递结果。"
        />
      </Panel>
    );
  return (
    <Panel
      as="aside"
      className="detail-panel"
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
                        className={textLinkClass()}
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
              className={textLinkClass("new-rule-link")}
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
    </Panel>
  );
});
