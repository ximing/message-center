import { bindServices, observer, useService } from "@rabjs/react";
import { useEffect } from "react";
import {
  Button,
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
import { TokenDialogs } from "./token-dialogs";
import { TokensPageService } from "./tokens.service";

const TokensContent = observer(function TokensContent() {
  const service = useService(TokensPageService);
  useEffect(() => {
    document.title = "接口令牌 · 消息中心";
    void service.load();
  }, [service]);
  return (
    <>
      <PageHeader
        title="接口令牌"
        description="给脚本和 agent 的长期凭证，用来管理这个账号。"
      >
        <Button
          variant="primary"
          onClick={() => service.edit()}
          disabled={!service.loaded || service.items.length >= 20}
        >
          <Icon name="plus" />
          创建令牌
        </Button>
      </PageHeader>
      <ErrorNotice message={service.error} retry={() => void service.load()} />
      <Panel>
        <div className="section-title between">
          <h2>
            接口令牌{" "}
            <span className="count-label">
              {service.loaded
                ? `${service.items.length} / 20 个有效`
                : "加载中"}
            </span>
          </h2>
        </div>
        {!service.loaded ? (
          <Loading />
        ) : service.items.length === 0 ? (
          <EmptyState
            icon="lock"
            title="还没有接口令牌"
            description="创建一个 mct_ 令牌，让 agent 管理钥匙、连接和规则。"
          >
            <Button variant="primary" onClick={() => service.edit()}>
              创建第一个令牌
            </Button>
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="key-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>令牌预览</th>
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
                        重命名
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
      <HelpBox icon="shield" title="管理用令牌，不是上报密钥">
        mct_ 可以调用管理接口。微信和 Webhook 上报仍然只用接入密钥里的 mck_。退出登录不会吊销接口令牌。
      </HelpBox>
      <TokenDialogs />
    </>
  );
});

export default bindServices(TokensContent, [TokensPageService]);
