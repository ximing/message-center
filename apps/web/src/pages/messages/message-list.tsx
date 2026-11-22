import { observer, useService } from "@rabjs/react";
import { type KeyboardEvent } from "react";
import { Link } from "react-router";
import {
  Button,
  ChannelIcon,
  EmptyState,
  Icon,
  IconButton,
  Input,
  Loading,
  Panel,
  Pill,
  Select,
  Tabs,
  buttonClass,
} from "@/components";
import { deliveryState } from "@/lib/delivery";
import { formatTime, ingressText, kindText, providerText } from "@/lib/text";
import { MessagesPageService } from "./messages.service";

export const MessageList = observer(function MessageList() {
  const s = useService(MessagesPageService);
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
    <Panel>
      <div className="list-head">
        <div className="between">
          <h2>收件记录</h2>
          <span className="muted">最新在前</span>
        </div>
        <Tabs
          label="消息分类"
          value={s.filter}
          onChange={(value) => s.setFilter(value)}
          options={[
            { value: "all", label: "全部消息", count: s.items.length },
            { value: "attention", label: "需要关注", count: stats.attention },
            { value: "unmatched", label: "未匹配", count: stats.unmatched },
          ]}
        />
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
          title={s.items.length ? "没有找到符合条件的消息" : "还没有收到消息"}
          description={
            s.items.length
              ? "试试其他发送者，或清除筛选条件。"
              : "创建接入密钥，配置微信模块或 Webhook 后，消息会出现在这里。"
          }
        >
          {s.items.length ? (
            <Button size="small" onClick={() => s.clearFilters()}>
              清除筛选
            </Button>
          ) : (
            <Link className={buttonClass("primary")} to="/keys">
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
                              {d.status !== "delivered" && ` · ${state.label}`}
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
          <IconButton
            className="prev"
            label="上一页"
            disabled={s.page <= 1}
            onClick={() => s.setPage(s.page - 1)}
          >
            <Icon name="chevron" />
          </IconButton>
          <span>
            {s.page} / {s.totalPages} 页
          </span>
          <IconButton
            label="下一页"
            disabled={s.page >= s.totalPages}
            onClick={() => s.setPage(s.page + 1)}
          >
            <Icon name="chevron" />
          </IconButton>
        </div>
      </div>
    </Panel>
  );
});
