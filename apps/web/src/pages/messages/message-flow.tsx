import { observer, useService } from "@rabjs/react";
import { Link } from "react-router";
import { ChannelIcon, Icon, Panel, Pill } from "@/components";
import { providerText } from "@/lib/text";
import { MessagesPageService } from "./messages.service";

export const MessageFlow = observer(function MessageFlow() {
  const s = useService(MessagesPageService);
  const stats = s.stats;
  return (
    <>
      <Panel as="div" className="flow-strip">
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
      </Panel>
      <Panel as="div" className="stats">
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
      </Panel>
      <div className="stat-caption">
        统计与筛选范围：最近 200 条上报记录。失败和重试的消息可能重叠。
      </div>
    </>
  );
});
