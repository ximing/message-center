import { observer, useService } from "@rabjs/react";
import {
  ChannelIcon,
  Icon,
  IconButton,
  Panel,
  Pill,
  Switch,
  TextLink,
} from "@/components";
import { providerText } from "@/lib/text";
import { ConnectionsPageService } from "./connections.service";

export const ConnectionList = observer(function ConnectionList() {
  const service = useService(ConnectionsPageService);
  return (
    <div className="cards">
      {service.items.map((item) => (
        <Panel
          as="article"
          className={`connection${item.status === "unauthorized" ? " invalid" : ""}`}
          key={item.id}
        >
          <div className="connection-head">
            <ChannelIcon provider={item.provider} />
            <div className="grow">
              <h3>{item.label}</h3>
              <p>
                {providerText(item.provider)}{" "}
                {item.provider === "inwit"
                  ? "文档"
                  : item.provider === "aimo"
                    ? "笔记"
                    : "收集箱"}
              </p>
            </div>
            <IconButton
              label={`编辑${item.label}`}
              disabled={service.flagsBusy}
              onClick={() => service.edit(item)}
            >
              <Icon name="edit" />
            </IconButton>
          </div>
          <Pill
            tone={
              item.status === "unauthorized"
                ? "red"
                : item.status === "active"
                  ? "green"
                  : ""
            }
          >
            {item.status === "unauthorized"
              ? "令牌失效"
              : item.status === "active"
                ? "连接正常"
                : "状态未知"}
          </Pill>
          <dl className="connection-meta">
            <dt>对方账号</dt>
            <dd>{item.remoteDisplayName || item.remoteUserId || "—"}</dd>
            <dt>服务地址</dt>
            <dd>{item.apiBase?.replace(/^https:\/\//, "") || "—"}</dd>
            <dt>令牌预览</dt>
            <dd className="mono">
              {item.tokenPreview || item.preview || "—"}
            </dd>
          </dl>
          <div className="connection-options">
            <label>
              <Switch
                checked={!!item.allowImage}
                label={`${item.label}接收图片`}
                disabled={service.flagsBusy}
                onChange={(v) =>
                  void service.updateMedia(item.id, "allowImage", v)
                }
              />
              接收图片
            </label>
            <label>
              <Switch
                checked={!!item.allowVoice}
                label={`${item.label}接收语音`}
                disabled={service.flagsBusy}
                onChange={(v) =>
                  void service.updateMedia(item.id, "allowVoice", v)
                }
              />
              接收语音
            </label>
          </div>
          <div className="card-bottom">
            <span className="muted">
              {service.rules.filter((r) => r.connectionId === item.id).length}{" "}
              条关联规则
            </span>
            <TextLink
              className={item.status === "unauthorized" ? "danger" : undefined}
              disabled={service.flagsBusy}
              onClick={() => service.edit(item)}
            >
              {item.status === "unauthorized" ? "更新令牌" : "管理连接"}{" "}
              <Icon name="chevron" />
            </TextLink>
          </div>
        </Panel>
      ))}
      <button className="add-card" type="button" onClick={() => service.edit()}>
        <span>
          <Icon name="plus" />
        </span>
        <strong>
          {service.items.length ? "添加目的地连接" : "添加第一个目的地"}
        </strong>
        <small>支持 inwit、Vital 和 aimo</small>
      </button>
    </div>
  );
});
