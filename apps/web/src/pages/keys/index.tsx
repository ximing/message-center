import { bindServices, observer, useService } from "@rabjs/react";
import { useEffect } from "react";
import {
  Button,
  ChannelIcon,
  EmptyState,
  ErrorNotice,
  HelpBox,
  Icon,
  Loading,
  PageHeader,
  Panel,
  TextLink,
} from "@/components";
import { formatTime } from "@/lib/text";
import { KeyDialogs } from "./key-dialogs";
import { KeysPageService } from "./keys.service";

const KeysContent = observer(function KeysContent() {
  const service = useService(KeysPageService);
  useEffect(() => {
    document.title = "接入密钥 · 消息中心";
    void service.load();
  }, [service]);
  return (
    <>
      <PageHeader
        title="接入密钥"
        description="为微信模块和 Webhook 创建凭证，统一接收你的消息。"
      >
        <Button
          variant="primary"
          onClick={() => service.edit()}
          disabled={!service.loaded || service.items.length >= 20}
        >
          <Icon name="plus" />
          创建密钥
        </Button>
      </PageHeader>
      <div className="intro-grid">
        {(["wechat", "webhook"] as const).map((p) => (
          <Panel as="div" className="ingress-card" key={p}>
            <ChannelIcon provider={p} />
            <div className="grow">
              <h3>{p === "wechat" ? "微信模块" : "Webhook"}</h3>
              <p>
                {p === "wechat"
                  ? "配置消息中心地址和密钥，上报收到的消息。"
                  : "用同一套账号密钥，接入外部服务与自动化。"}
              </p>
              <div className="endpoint">
                <b>POST</b>
                <span className="mono">/api/v1/ingest/{p}</span>
              </div>
            </div>
          </Panel>
        ))}
      </div>
      <ErrorNotice message={service.error} retry={() => void service.load()} />
      <Panel>
        <div className="section-title between">
          <h2>
            账号密钥{" "}
            <span className="count-label">
              {service.loaded
                ? `${service.items.length} / 20 把有效`
                : "加载中"}
            </span>
          </h2>
          <TextLink onClick={() => service.ui.openGuide()}>
            接入指南 <Icon name="arrow-up" />
          </TextLink>
        </div>
        {!service.loaded ? (
          <Loading />
        ) : service.items.length === 0 ? (
          <EmptyState
            icon="key"
            title="还没有接入密钥"
            description="创建一把密钥，开始接收微信或 Webhook 消息。"
          >
            <Button variant="primary" onClick={() => service.edit()}>
              创建第一把密钥
            </Button>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="key-table">
              <thead>
                <tr>
                  <th>密钥名称 / 备注</th>
                  <th>密钥预览</th>
                  <th>最近使用</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {service.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong className="key-title">{item.name}</strong>
                      <div className="subline">{item.note || "无备注"}</div>
                    </td>
                    <td className="mono">{item.preview}</td>
                    <td className="time">
                      {item.lastUsedAt
                        ? formatTime(item.lastUsedAt)
                        : "尚未使用"}
                    </td>
                    <td className="time">{formatTime(item.createdAt)}</td>
                    <td className="actions">
                      <TextLink onClick={() => void service.reveal(item)}>
                        显示
                      </TextLink>
                      <TextLink onClick={() => service.edit(item)}>
                        编辑
                      </TextLink>
                      <TextLink
                        className="danger"
                        onClick={() => service.confirmRevoke(item)}
                      >
                        吊销
                      </TextLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <HelpBox icon="shield" title="一套密钥，两个上报渠道">
        每把 mck_ 密钥都可以用于微信和
        Webhook，也可以分别创建以便管理。密钥只能上报消息，不能读取消息或修改规则。
      </HelpBox>
      <KeyDialogs />
    </>
  );
});

export default bindServices(KeysContent, [KeysPageService]);
